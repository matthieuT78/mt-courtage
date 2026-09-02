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
PRIX_M2_PLANCHER = 100

# Miroir de lib/frenchGeo.ts (DEPARTMENT_TO_REGION) — stable depuis la réforme
# territoriale de 2016 (13 régions métropolitaines). Dupliqué plutôt que
# partagé entre Python et TypeScript pour éviter un couplage inter-langages
# sur un fichier de config qui ne change pour ainsi dire jamais.
DEPARTMENT_TO_REGION = {
    "01": "Auvergne-Rhône-Alpes", "03": "Auvergne-Rhône-Alpes", "07": "Auvergne-Rhône-Alpes",
    "15": "Auvergne-Rhône-Alpes", "26": "Auvergne-Rhône-Alpes", "38": "Auvergne-Rhône-Alpes",
    "42": "Auvergne-Rhône-Alpes", "43": "Auvergne-Rhône-Alpes", "63": "Auvergne-Rhône-Alpes",
    "69": "Auvergne-Rhône-Alpes", "73": "Auvergne-Rhône-Alpes", "74": "Auvergne-Rhône-Alpes",
    "21": "Bourgogne-Franche-Comté", "25": "Bourgogne-Franche-Comté", "39": "Bourgogne-Franche-Comté",
    "58": "Bourgogne-Franche-Comté", "70": "Bourgogne-Franche-Comté", "71": "Bourgogne-Franche-Comté",
    "89": "Bourgogne-Franche-Comté", "90": "Bourgogne-Franche-Comté",
    "22": "Bretagne", "29": "Bretagne", "35": "Bretagne", "56": "Bretagne",
    "18": "Centre-Val de Loire", "28": "Centre-Val de Loire", "36": "Centre-Val de Loire",
    "37": "Centre-Val de Loire", "41": "Centre-Val de Loire", "45": "Centre-Val de Loire",
    "2A": "Corse", "2B": "Corse",
    "08": "Grand Est", "10": "Grand Est", "51": "Grand Est", "52": "Grand Est", "54": "Grand Est",
    "55": "Grand Est", "57": "Grand Est", "67": "Grand Est", "68": "Grand Est", "88": "Grand Est",
    "02": "Hauts-de-France", "59": "Hauts-de-France", "60": "Hauts-de-France",
    "62": "Hauts-de-France", "80": "Hauts-de-France",
    "75": "Île-de-France", "77": "Île-de-France", "78": "Île-de-France", "91": "Île-de-France",
    "92": "Île-de-France", "93": "Île-de-France", "94": "Île-de-France", "95": "Île-de-France",
    "14": "Normandie", "27": "Normandie", "50": "Normandie", "61": "Normandie", "76": "Normandie",
    "16": "Nouvelle-Aquitaine", "17": "Nouvelle-Aquitaine", "19": "Nouvelle-Aquitaine",
    "23": "Nouvelle-Aquitaine", "24": "Nouvelle-Aquitaine", "33": "Nouvelle-Aquitaine",
    "40": "Nouvelle-Aquitaine", "47": "Nouvelle-Aquitaine", "64": "Nouvelle-Aquitaine",
    "79": "Nouvelle-Aquitaine", "86": "Nouvelle-Aquitaine", "87": "Nouvelle-Aquitaine",
    "09": "Occitanie", "11": "Occitanie", "12": "Occitanie", "30": "Occitanie", "31": "Occitanie",
    "32": "Occitanie", "34": "Occitanie", "46": "Occitanie", "48": "Occitanie", "65": "Occitanie",
    "66": "Occitanie", "81": "Occitanie", "82": "Occitanie",
    "44": "Pays de la Loire", "49": "Pays de la Loire", "53": "Pays de la Loire",
    "72": "Pays de la Loire", "85": "Pays de la Loire",
    "04": "Provence-Alpes-Côte d'Azur", "05": "Provence-Alpes-Côte d'Azur", "06": "Provence-Alpes-Côte d'Azur",
    "13": "Provence-Alpes-Côte d'Azur", "83": "Provence-Alpes-Côte d'Azur", "84": "Provence-Alpes-Côte d'Azur",
}


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
                "id_mutation",
                "nature_mutation",
                "valeur_fonciere",
                "code_commune",
                "nom_commune",
                "code_postal",
                "type_local",
                "surface_reelle_bati",
                "nombre_lots",
                "nombre_pieces_principales",
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
            "Date mutation": "date_mutation",
            "Nature mutation": "nature_mutation",
            "Valeur fonciere": "valeur_fonciere",
            "No voie": "no_voie",
            "Code voie": "code_voie",
            "Code commune": "code_commune_raw",
            "Code departement": "code_departement",
            "Commune": "nom_commune",
            "Code postal": "code_postal",
            "Type local": "type_local",
            "Surface reelle bati": "surface_reelle_bati",
            "Nombre de lots": "nombre_lots",
            "Nombre pieces principales": "nombre_pieces_principales",
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
    df["nombre_pieces_principales"] = pd.to_numeric(df["nombre_pieces_principales"], errors="coerce")
    # Pas d'id_mutation dans le format brut DGFiP (contrairement à geo-dvf) :
    # on reconstitue une clé de mutation équivalente à partir de la date, du
    # montant et de l'adresse, pour détecter le même artefact (cf compute_benchmarks).
    df["id_mutation"] = (
        df["date_mutation"].astype(str)
        + "|" + df["valeur_fonciere"].astype(str)
        + "|" + df["code_commune"].astype(str)
        + "|" + df["no_voie"].astype(str)
        + "|" + df["code_voie"].astype(str)
    )
    return df[["id_mutation", "nature_mutation", "valeur_fonciere", "code_commune", "nom_commune", "code_postal", "type_local", "surface_reelle_bati", "nombre_lots", "nombre_pieces_principales"]]


def clean_transactions(df: pd.DataFrame, types: list | None = None) -> pd.DataFrame:
    """Filtrage + dédoublonnage communs à compute_benchmarks et compute_geo_stats :
    ventes de maisons/appartements avec surface/valeur valides, mutations
    multi-lots exclues (cf. artefact documenté ci-dessous)."""
    types = types or TYPES_LOCAL_RETENUS
    df = df[df["nature_mutation"] == "Vente"]
    df = df[df["type_local"].isin(types)]
    df["surface_reelle_bati"] = pd.to_numeric(df["surface_reelle_bati"], errors="coerce")
    df["valeur_fonciere"] = pd.to_numeric(df["valeur_fonciere"], errors="coerce")
    df = df[(df["surface_reelle_bati"] > 0) & (df["valeur_fonciere"] > 0)]
    df = df.dropna(subset=["code_commune"])

    # Artefact DVF : quand une mutation (id_mutation) porte plusieurs lots
    # Maison/Appartement, valeur_fonciere est le prix TOTAL de la mutation,
    # identique sur chaque ligne — diviser ce total par la surface d'un seul
    # lot gonfle le prix/m² jusqu'à des niveaux absurdes (vérifié : sur les
    # mutations concernées, valeur_fonciere est à 100% identique entre les
    # lignes, jamais un vrai prix par lot). On exclut ces mutations plutôt
    # que d'inventer une répartition, faute de moyen fiable de la calculer.
    mutation_counts = df.groupby("id_mutation")["id_mutation"].transform("size")
    df = df[mutation_counts == 1]

    df["prix_m2"] = df["valeur_fonciere"] / df["surface_reelle_bati"]

    # Ventes symboliques (donations déguisées en vente à 1 €, transferts
    # familiaux, corrections d'acte...) : DVF les classe "Vente" mais le prix
    # ne reflète aucune valeur de marché. Vérifié sur un cas concret : une
    # maison de 76 m² vendue 1 € produit un prix/m² de 0,013 €, qui écrase la
    # médiane communale si c'est la seule transaction de l'année. Seuil fixé
    # à 100 €/m² — sous ce seuil, ~0,5 % des transactions nationales,
    # largement en dessous de tout marché réel même très déprécié.
    df = df[df["prix_m2"] >= PRIX_M2_PLANCHER]
    return df


def compute_benchmarks(df: pd.DataFrame, year: int, types: list | None = None) -> pd.DataFrame:
    types = types or TYPES_LOCAL_RETENUS
    df = clean_transactions(df, types)

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
    types_label = " et ".join(t.lower() + "s" for t in types) if len(types) < len(TYPES_LOCAL_RETENUS) else "maisons/appartements"
    grouped["source"] = (
        f"DVF {year} (prix m² médian sur {types_label}) + loyer estimé par heuristique de rendement brut."
    )
    return grouped[["insee_code", "city_name", "postal_code", "reference_price_m2_sale", "reference_rent_m2", "source", "n_transactions"]]


def compute_geo_stats(df: pd.DataFrame, types: list | None = None) -> pd.DataFrame:
    """Agrégats département / région / national — calculés sur les transactions
    individuelles (pas une moyenne des médianes communales, qui serait un
    indicateur différent et moins correct statistiquement)."""
    types = types or TYPES_LOCAL_RETENUS
    df = clean_transactions(df, types)
    df["dept_code"] = df["code_commune"].str[:2].str.upper()
    df["region"] = df["dept_code"].map(DEPARTMENT_TO_REGION)

    rows = [{"geo_type": "national", "geo_code": "FR", "price_m2": df["prix_m2"].median(), "n_transactions": len(df)}]

    for region, g in df.dropna(subset=["region"]).groupby("region"):
        rows.append({"geo_type": "region", "geo_code": region, "price_m2": g["prix_m2"].median(), "n_transactions": len(g)})

    for dept, g in df.groupby("dept_code"):
        rows.append({"geo_type": "departement", "geo_code": dept, "price_m2": g["prix_m2"].median(), "n_transactions": len(g)})

    return pd.DataFrame(rows)


def room_bracket(n_pieces) -> str | None:
    if pd.isna(n_pieces):
        return None
    n = int(n_pieces)
    if n <= 1:
        return "T1"
    if n == 2:
        return "T2"
    if n == 3:
        return "T3"
    return "T4+"


def compute_room_segments(df: pd.DataFrame) -> pd.DataFrame:
    """Prix médian par commune et par nombre de pièces (T1/T2/T3/T4+), tous
    types de bien confondus (maison + appartement) — année courante uniquement."""
    df = clean_transactions(df, TYPES_LOCAL_RETENUS)
    df["room_bracket"] = df["nombre_pieces_principales"].apply(room_bracket)
    df = df.dropna(subset=["room_bracket"])

    grouped = df.groupby(["code_commune", "room_bracket"]).agg(
        price_m2=("prix_m2", "median"),
        n_transactions=("prix_m2", "count"),
    ).reset_index().rename(columns={"code_commune": "insee_code"})

    return grouped[["insee_code", "room_bracket", "price_m2", "n_transactions"]]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--year", type=int, required=True)
    parser.add_argument("--local", type=str, default=None, help="Chemin vers un fichier déjà téléchargé (geo-dvf .csv.gz ou DGFiP brut avec --raw)")
    parser.add_argument("--raw", action="store_true", help="Le fichier --local est le format brut DGFiP (pipe-delimited), pas geo-dvf")
    parser.add_argument("--upload", action="store_true", help="Upsert le résultat dans Supabase (city_market_benchmarks)")
    parser.add_argument("--history", action="store_true", help="Upsert aussi dans city_market_benchmarks_history (insee_code, year)")
    parser.add_argument("--rooms", action="store_true", help="Upsert la segmentation par nombre de pièces (city_market_benchmarks_rooms), année courante uniquement")
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

    if args.history:
        results_by_type = {"tous": result}
        for type_local in TYPES_LOCAL_RETENUS:
            results_by_type[type_local.lower()] = compute_benchmarks(df, args.year, types=[type_local])
        upload_to_history(results_by_type, args.year)

        geo_results_by_type = {"tous": compute_geo_stats(df)}
        for type_local in TYPES_LOCAL_RETENUS:
            geo_results_by_type[type_local.lower()] = compute_geo_stats(df, types=[type_local])
        upload_to_geo_stats(geo_results_by_type, args.year)

    if args.rooms:
        rooms_result = compute_room_segments(df)
        print(f"Segments pièces calculés : {len(rooms_result)}")
        upload_to_rooms(rooms_result, args.year)


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


def upload_to_history(results_by_type: dict, year: int):
    from supabase import create_client

    url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print("ERREUR : SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent être définis dans l'environnement.", file=sys.stderr)
        sys.exit(1)

    client = create_client(url, key)

    # Suppression préalable des lignes de cette année (tous types confondus) :
    # un upsert seul laisserait des lignes orphelines pour les communes qui
    # disparaissent d'un refresh à l'autre (ex. plus aucune vente exploitable
    # après filtrage des mutations multi-lots), avec leurs anciennes valeurs
    # (potentiellement erronées) intactes.
    print(f"Suppression des lignes existantes pour l'année {year}...")
    client.table("city_market_benchmarks_history").delete().eq("year", year).execute()

    all_rows = []
    for property_type, result in results_by_type.items():
        # Pas de colonne "source" ici : ce texte descriptif ("DVF <année> (...)")
        # est régénéré à l'affichage à partir de year/property_type, plutôt que
        # dupliqué sur chacune des ~30 000 lignes de chaque année d'historique.
        history = result.drop(columns=["source"]).copy()
        history["year"] = year
        history["property_type"] = property_type
        all_rows.extend(history.where(pd.notnull(history), None).to_dict(orient="records"))

    print(f"Insertion de {len(all_rows)} lignes dans city_market_benchmarks_history (année {year}, {len(results_by_type)} types)...")
    batch_size = 500
    for i in range(0, len(all_rows), batch_size):
        batch = all_rows[i : i + batch_size]
        client.table("city_market_benchmarks_history").insert(batch).execute()
        print(f"  {min(i + batch_size, len(all_rows))}/{len(all_rows)}")
    print("Terminé.")


def upload_to_geo_stats(results_by_type: dict, year: int):
    from supabase import create_client

    url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print("ERREUR : SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent être définis dans l'environnement.", file=sys.stderr)
        sys.exit(1)

    client = create_client(url, key)

    print(f"Suppression des agrégats géo existants pour l'année {year}...")
    client.table("city_market_benchmarks_geo_stats").delete().eq("year", year).execute()

    all_rows = []
    for property_type, result in results_by_type.items():
        geo = result.copy()
        geo["year"] = year
        geo["property_type"] = property_type
        all_rows.extend(geo.where(pd.notnull(geo), None).to_dict(orient="records"))

    print(f"Insertion de {len(all_rows)} lignes dans city_market_benchmarks_geo_stats (année {year})...")
    client.table("city_market_benchmarks_geo_stats").insert(all_rows).execute()
    print("Terminé.")


def upload_to_rooms(result: pd.DataFrame, year: int):
    from supabase import create_client

    url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print("ERREUR : SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent être définis dans l'environnement.", file=sys.stderr)
        sys.exit(1)

    client = create_client(url, key)

    print(f"Suppression des segments pièces existants pour l'année {year}...")
    client.table("city_market_benchmarks_rooms").delete().eq("year", year).execute()

    rows = result.copy()
    rows["year"] = year
    all_rows = rows.where(pd.notnull(rows), None).to_dict(orient="records")

    print(f"Insertion de {len(all_rows)} lignes dans city_market_benchmarks_rooms (année {year})...")
    batch_size = 500
    for i in range(0, len(all_rows), batch_size):
        batch = all_rows[i : i + batch_size]
        client.table("city_market_benchmarks_rooms").insert(batch).execute()
        print(f"  {min(i + batch_size, len(all_rows))}/{len(all_rows)}")
    print("Terminé.")


if __name__ == "__main__":
    main()
