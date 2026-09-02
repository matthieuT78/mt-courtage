#!/usr/bin/env python3
"""
process-insee-social.py — Revenu médian, population, résidences secondaires et
logements vacants par commune, depuis le recensement INSEE + Filosofi.

Source : republication communale du recensement + Filosofi (données INSEE
officielles, republiées en parquet consolidé pour usage pratique — l'INSEE ne
publie pas directement un fichier commune unique aussi pratique) :
https://www.data.gouv.fr/fr/datasets/recensement-de-la-population-communal-et-filosofi-depuis-2015-france-metropolitaine/

Le fichier source est un gros parquet "melted" (~124M lignes, une ligne par
commune × indicateur × année) : on filtre en streaming pour ne garder que les
indicateurs utiles, sans charger le fichier entier en mémoire.

Usage :
  python3 scripts/process-insee-social.py --upload
"""

import argparse
import os
import sys
import urllib.request

import pandas as pd
import pyarrow as pa
import pyarrow.compute as pc
import pyarrow.parquet as pq

SOURCE_URL = (
    "https://static.data.gouv.fr/resources/"
    "recensement-de-la-population-communal-et-filosofi-depuis-2015-france-metropolitaine/"
    "20241104-093439/donnees-insee-olap.parquet"
)

WANTED_FIELDS = [
    "revenu_median",
    "pop_p",
    "logements_p",
    "residences_principales_p",
    "residences_secondaires_p",
    "logements_vacants_p",
]


def download(dest_path: str):
    if os.path.exists(dest_path):
        print(f"Fichier déjà présent : {dest_path}")
        return
    print(f"Téléchargement (~1.9 Go) : {SOURCE_URL}")
    req = urllib.request.Request(SOURCE_URL, headers={"User-Agent": "lokt.fr-insee-refresh/1.0"})
    with urllib.request.urlopen(req, timeout=600) as resp, open(dest_path, "wb") as out:
        total = 0
        while True:
            chunk = resp.read(1024 * 1024)
            if not chunk:
                break
            out.write(chunk)
            total += len(chunk)
            if total % (100 * 1024 * 1024) < 1024 * 1024:
                print(f"  {total / 1_000_000:.0f} Mo...")
        print(f"Téléchargé : {total / 1_000_000:.1f} Mo")


def extract_filtered(path: str) -> pd.DataFrame:
    f = pq.ParquetFile(path)
    tables = []
    for batch in f.iter_batches(columns=["code_com", "annee", "clef_json", "valeur"], batch_size=2_000_000):
        tbl = pa.Table.from_batches([batch])
        mask = pc.is_in(tbl["clef_json"], value_set=pa.array(WANTED_FIELDS))
        filtered = tbl.filter(mask)
        if filtered.num_rows > 0:
            tables.append(filtered)
    return pa.concat_tables(tables).to_pandas()


def compute_kpis(df: pd.DataFrame) -> pd.DataFrame:
    # Pour chaque commune × indicateur, on garde l'année la plus récente
    # disponible (Filosofi a des trous côté secret statistique sur les
    # petites communes, donc certaines années sont incomplètes par champ).
    df = df.sort_values("annee").drop_duplicates(subset=["code_com", "clef_json"], keep="last")
    pivot = df.pivot(index="code_com", columns="clef_json", values="valeur")
    year_pivot = df.pivot(index="code_com", columns="clef_json", values="annee")

    result = pd.DataFrame(index=pivot.index)
    result["insee_code"] = pivot.index
    result["revenu_median"] = pivot.get("revenu_median")
    result["filosofi_year"] = year_pivot.get("revenu_median")
    result["population"] = pivot.get("pop_p").round()
    result["logements_total"] = pivot.get("logements_p").round()
    result["residences_principales"] = pivot.get("residences_principales_p").round()
    result["residences_secondaires"] = pivot.get("residences_secondaires_p").round()
    result["logements_vacants"] = pivot.get("logements_vacants_p").round()
    result["recensement_year"] = year_pivot.get("pop_p")

    result = result.dropna(subset=["insee_code"]).reset_index(drop=True)
    for col in ["population", "logements_total", "residences_principales", "residences_secondaires", "logements_vacants", "filosofi_year", "recensement_year"]:
        result[col] = result[col].astype("Int64")
    return result


def upload(result: pd.DataFrame):
    from supabase import create_client

    url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print("ERREUR : SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent être définis.", file=sys.stderr)
        sys.exit(1)

    client = create_client(url, key)
    # .where(pd.notnull(...), None) laisse passer des NaN non convertis sur les
    # colonnes Int64/float mixtes (secret statistique Filosofi sur les petites
    # communes) — remplacement explicite plus fiable avant sérialisation JSON.
    clean = result.astype(object).where(pd.notnull(result), None)
    rows = clean.to_dict(orient="records")

    print(f"Upsert de {len(rows)} lignes dans city_external_kpis (colonnes INSEE)...")
    batch_size = 500
    for i in range(0, len(rows), batch_size):
        batch = rows[i : i + batch_size]
        client.table("city_external_kpis").upsert(batch, on_conflict="insee_code").execute()
        print(f"  {min(i + batch_size, len(rows))}/{len(rows)}")
    print("Terminé.")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--local", type=str, default=None, help="Chemin vers le parquet déjà téléchargé")
    parser.add_argument("--upload", action="store_true")
    parser.add_argument("--out", type=str, default="data/city_external_kpis_insee.csv")
    args = parser.parse_args()

    path = args.local
    if not path:
        os.makedirs("data", exist_ok=True)
        path = "data/donnees-insee-olap.parquet"
        download(path)

    print("Extraction des champs utiles (streaming)...")
    df = extract_filtered(path)
    print(f"Lignes extraites : {len(df)}")

    result = compute_kpis(df)
    print(f"Communes : {len(result)}")
    print(result.head(5).to_string())

    result.to_csv(args.out, index=False)
    print(f"CSV écrit : {args.out}")

    if args.upload:
        upload(result)


if __name__ == "__main__":
    main()
