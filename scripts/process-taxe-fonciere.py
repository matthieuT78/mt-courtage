#!/usr/bin/env python3
"""
process-taxe-fonciere.py — Taux de taxe foncière sur les propriétés bâties
(TFB) par commune, depuis les données DGFiP "Fiscalité locale des
particuliers" republiées sur data.economie.gouv.fr (plateforme Opendatasoft).

Contrairement aux autres pipelines de ce projet (data.gouv.fr direct), cette
source vit sur data.economie.gouv.fr (plateforme Opendatasoft). L'API V1
`records/1.0/search` plafonne `start + rows` à 10 000 (~34 900 communes,
donc impossible à paginer entièrement) — on utilise l'API V2
`exports/csv` à la place, qui n'a pas cette limite et permet de sélectionner
uniquement les champs utiles via `select=` (le dataset contient aussi des
colonnes de géométrie multi-années qui font dépasser 700 Mo si on ne les
exclut pas).

Usage :
  python3 scripts/process-taxe-fonciere.py --upload
"""

import argparse
import io
import os
import sys

import pandas as pd
import requests

RECORDS_API = "https://data.economie.gouv.fr/api/records/1.0/search/"
EXPORT_API = "https://data.economie.gouv.fr/api/v2/catalog/datasets/fiscalite-locale-des-particuliers-geo/exports/csv"
SELECT_FIELDS = "insee_com,libcom,exercice,taux_global_tfb,taux_plein_teom"


def find_latest_year() -> str:
    resp = requests.get(RECORDS_API, params={"dataset": "fiscalite-locale-des-particuliers-geo", "rows": 0, "facet": "exercice"}, timeout=30)
    resp.raise_for_status()
    facets = resp.json().get("facet_groups", [])
    for f in facets:
        if f["name"] == "exercice":
            years = [fa["name"] for fa in f["facets"]]
            return max(years)
    raise RuntimeError("Impossible de déterminer l'exercice le plus récent.")


def fetch_year(year: str) -> pd.DataFrame:
    resp = requests.get(
        EXPORT_API,
        params={"select": SELECT_FIELDS, "where": f"exercice='{year}'", "limit": -1},
        timeout=120,
    )
    resp.raise_for_status()
    return pd.read_csv(io.StringIO(resp.text), sep=";", dtype={"insee_com": str})


def compute() -> pd.DataFrame:
    year = find_latest_year()
    print(f"Exercice le plus récent : {year}")
    df = fetch_year(year)
    print(f"{len(df)} communes récupérées.")

    df = df.rename(columns={
        "insee_com": "insee_code",
        "taux_global_tfb": "taxe_fonciere_tfb",
        "taux_plein_teom": "taxe_fonciere_teom",
    })
    df["taxe_fonciere_year"] = int(year)
    df = df.dropna(subset=["insee_code", "taxe_fonciere_tfb"])
    df = df[["insee_code", "taxe_fonciere_tfb", "taxe_fonciere_teom", "taxe_fonciere_year"]]

    return df


def upload(result: pd.DataFrame):
    from supabase import create_client

    url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print("ERREUR : SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent être définis.", file=sys.stderr)
        sys.exit(1)

    client = create_client(url, key)
    clean = result.astype(object).where(pd.notnull(result), None)
    rows = clean.to_dict(orient="records")

    print(f"Upsert de {len(rows)} lignes dans city_external_kpis (taxe foncière)...")
    batch_size = 500
    for i in range(0, len(rows), batch_size):
        batch = rows[i : i + batch_size]
        client.table("city_external_kpis").upsert(batch, on_conflict="insee_code").execute()
        print(f"  {min(i + batch_size, len(rows))}/{len(rows)}")
    print("Terminé.")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--upload", action="store_true")
    parser.add_argument("--out", type=str, default="data/taxe_fonciere.csv")
    args = parser.parse_args()

    result = compute()
    print(result.head(5).to_string())

    os.makedirs("data", exist_ok=True)
    result.to_csv(args.out, index=False)
    print(f"CSV écrit : {args.out}")

    if args.upload:
        upload(result)


if __name__ == "__main__":
    main()
