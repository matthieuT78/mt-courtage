#!/usr/bin/env python3
"""
process-dvf.py — Recalcule city_market_benchmarks depuis les données DVF officielles.

Source : https://files.data.gouv.fr/geo-dvf/latest/csv/<annee>/full.csv.gz
(publié par Etalab/DGFiP, mises à jour semestrielles en avril et octobre)

Usage :
  python3 scripts/process-dvf.py --year 2024                # génère le CSV seulement
  python3 scripts/process-dvf.py --year 2024 --upload        # génère + upsert Supabase
  python3 scripts/process-dvf.py --year 2024 --local data/valeursfoncieres-2024.txt --raw
                                                               # utilise un fichier DGFiP brut déjà téléchargé

Méthode :
  - Filtre les ventes de maisons/appartements avec surface bâtie > 0.
  - Prix médian au m² par commune (code INSEE).
  - Loyer estimé par heuristique de rendement brut : 3,2 %/an à Paris (CP 75xxx), 5,5 % ailleurs.
    (Le loyer n'est PAS une donnée observée — DVF ne couvre que les ventes, pas les locations.)
"""

import argparse
import gzip
import os
import sys
import urllib.request

import pandas as pd

GEO_DVF_URL_TEMPLATE = "https://files.data.gouv.fr/geo-dvf/latest/csv/{year}/full.csv.gz"
TYPES_LOCAL_RETENUS = ["Maison", "Appartement"]
YIELD_PARIS = 0.032
YIELD_PROVINCE = 0.055


def download_geo_dvf(year: int, dest_path: str) -> str:
    url = GEO_DVF_URL_TEMPLATE.format(year=year)
    print(f"Téléchargement : {url}")
    req = urllib.request.Request(url, headers={"User-Agent": "lokt.fr-dvf-refresh/1.0"})
    with urllib.request.urlopen(req, timeout=300) as resp, open(dest_path, "wb") as out:
        total = 0
        while True:
            chunk = resp.read(1024 * 1024)
            if not chunk:
                break
            out.write(chunk)
            total += len(chunk)
        print(f"Téléchargé : {total / 1_000_000:.1f} Mo")
    return dest_path


def load_geo_dvf(path: str) -> pd.DataFrame:
    opener = gzip.open if path.endswith(".gz") else open
    with opener(path, "rt", encoding="utf-8") as f:
        df = pd.read_csv(
            f,
            usecols=[
                "nature_mutation",
                "valeur_fonciere",
                "code_commune",
                "nom_commune",
                "code_postal",
                "type_local",
                "surface_reelle_bati",
                "nombre_lots",
            ],
            dtype={"code_commune": str, "code_postal": str},
            low_memory=False,
        )
    return df


def load_raw_dgfip(path: str) -> pd.DataFrame:
    """Fallback : parse le fichier brut DGFiP (pipe-delimited, virgule décimale)."""
    df = pd.read_csv(
        path,
        sep="|",
        dtype=str,
        low_memory=False,
        encoding="latin1",
    )
    df = df.rename(
        columns={
            "Nature mutation": "nature_mutation",
            "Valeur fonciere": "valeur_fonciere",
            "Code commune": "code_commune_raw",
            "Code departement": "code_departement",
            "Commune": "nom_commune",
            "Code postal": "code_postal",
            "Type local": "type_local",
            "Surface reelle bati": "surface_reelle_bati",
            "Nombre de lots": "nombre_lots",
        }
    )
    df["code_commune"] = df["code_departement"].str.zfill(2) + df["code_commune_raw"].str.zfill(3)
    # Le fichier brut DGFiP stocke le code postal comme un nombre, sans zéro
    # initial (ex. "1400" pour Ambérieu-en-Bugey) — contrairement à geo-dvf qui
    # le zéro-remplit déjà à 5 chiffres.
    df["code_postal"] = df["code_postal"].str.zfill(5)
    df["valeur_fonciere"] = df["valeur_fonciere"].str.replace(",", ".", regex=False).astype(float)
    df["surface_reelle_bati"] = pd.to_numeric(df["surface_reelle_bati"], errors="coerce")
    df["nombre_lots"] = pd.to_numeric(df["nombre_lots"], errors="coerce")
    return df[["nature_mutation", "valeur_fonciere", "code_commune", "nom_commune", "code_postal", "type_local", "surface_reelle_bati", "nombre_lots"]]


def compute_benchmarks(df: pd.DataFrame, year: int) -> pd.DataFrame:
    df = df[df["nature_mutation"] == "Vente"]
    df = df[df["type_local"].isin(TYPES_LOCAL_RETENUS)]
    df["surface_reelle_bati"] = pd.to_numeric(df["surface_reelle_bati"], errors="coerce")
    df["valeur_fonciere"] = pd.to_numeric(df["valeur_fonciere"], errors="coerce")
    df = df[(df["surface_reelle_bati"] > 0) & (df["valeur_fonciere"] > 0)]
    df = df.dropna(subset=["code_commune"])
    df["prix_m2"] = df["valeur_fonciere"] / df["surface_reelle_bati"]

    grouped = df.groupby("code_commune").agg(
        reference_price_m2_sale=("prix_m2", "median"),
        city_name=("nom_commune", lambda s: s.mode().iat[0] if not s.mode().empty else (s.iloc[0] if len(s) else None)),
        postal_code=("code_postal", lambda s: s.mode().iat[0] if not s.mode().empty else None),
        n_transactions=("prix_m2", "count"),
    )
    grouped = grouped.reset_index().rename(columns={"code_commune": "insee_code"})

    def yield_rate(postal_code):
        return YIELD_PARIS if isinstance(postal_code, str) and postal_code.startswith("75") else YIELD_PROVINCE

    grouped["reference_rent_m2"] = grouped.apply(
        lambda row: row["reference_price_m2_sale"] * yield_rate(row["postal_code"]) / 12, axis=1
    )
    grouped["source"] = (
        f"DVF {year} (prix m² médian sur maisons/appartements) + loyer estimé par heuristique de rendement brut."
    )
    return grouped[["insee_code", "city_name", "postal_code", "reference_price_m2_sale", "reference_rent_m2", "source", "n_transactions"]]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--year", type=int, required=True)
    parser.add_argument("--local", type=str, default=None, help="Chemin vers un fichier déjà téléchargé (geo-dvf .csv.gz ou DGFiP brut avec --raw)")
    parser.add_argument("--raw", action="store_true", help="Le fichier --local est le format brut DGFiP (pipe-delimited), pas geo-dvf")
    parser.add_argument("--upload", action="store_true", help="Upsert le résultat dans Supabase (city_market_benchmarks)")
    parser.add_argument("--out", type=str, default=None, help="Chemin du CSV de sortie")
    args = parser.parse_args()

    out_path = args.out or f"data/city_market_benchmarks_from_dvf_{args.year}.csv"

    if args.local:
        print(f"Utilisation du fichier local : {args.local}")
        df = load_raw_dgfip(args.local) if args.raw else load_geo_dvf(args.local)
    else:
        dest = f"data/geo-dvf-{args.year}-full.csv.gz"
        os.makedirs("data", exist_ok=True)
        if not os.path.exists(dest):
            download_geo_dvf(args.year, dest)
        else:
            print(f"Fichier déjà présent : {dest}")
        df = load_geo_dvf(dest)

    print(f"Lignes chargées : {len(df)}")
    result = compute_benchmarks(df, args.year)
    print(f"Communes agrégées : {len(result)}")
    print(result.drop(columns=["n_transactions"]).head(5).to_string())

    result.drop(columns=["n_transactions"]).to_csv(out_path, index=False)
    print(f"CSV écrit : {out_path}")

    if args.upload:
        upload_to_supabase(result)


def upload_to_supabase(result: pd.DataFrame):
    from supabase import create_client

    url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print("ERREUR : SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent être définis dans l'environnement.", file=sys.stderr)
        sys.exit(1)

    client = create_client(url, key)
    rows = result.drop(columns=["n_transactions"]).where(pd.notnull(result), None).to_dict(orient="records")

    # Pas de contrainte unique sur insee_code en base (upsert impossible tel
    # quel) : la table n'est qu'un cache de lecture pour /api/market-benchmarks,
    # sans clé étrangère pointant vers elle (RLS verrouillée, accès service-role
    # uniquement) — un remplacement complet à chaque refresh biannuel est donc
    # sûr et plus simple qu'une contrainte + upsert.
    print("Suppression des lignes existantes...")
    client.table("city_market_benchmarks").delete().neq("insee_code", "__never__").execute()

    print(f"Insertion de {len(rows)} lignes dans city_market_benchmarks...")
    batch_size = 500
    for i in range(0, len(rows), batch_size):
        batch = rows[i : i + batch_size]
        client.table("city_market_benchmarks").insert(batch).execute()
        print(f"  {min(i + batch_size, len(rows))}/{len(rows)}")
    print("Terminé.")


if __name__ == "__main__":
    main()
