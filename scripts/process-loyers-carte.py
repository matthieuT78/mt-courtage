#!/usr/bin/env python3
"""
process-loyers-carte.py — Loyer d'annonce prédit par commune, séparé
appartement/maison, depuis la "Carte des loyers" (DGALN / ANIL / INRAE).

Remplace/complète notre loyer_estime heuristique (prix × taux de rendement
constant, cf. process-dvf.py) par une vraie estimation indépendante basée
sur les annonces réelles (SeLoger, LeBonCoin) et un modèle statistique
publié annuellement par le ministère.

Source : https://www.data.gouv.fr/fr/datasets/carte-des-loyers-indicateurs-de-loyers-dannonce-par-commune/
Le jeu de données change d'identifiant chaque année (republication) — on
résout l'URL courante via l'API data.gouv.fr plutôt que de la coder en dur.

Usage :
  python3 scripts/process-loyers-carte.py --upload
"""

import argparse
import os
import re
import sys

import pandas as pd
import requests

DATAGOUV_SEARCH = "https://www.data.gouv.fr/api/1/datasets/?q=carte+des+loyers&page_size=20"


def find_latest_dataset() -> dict:
    resp = requests.get(DATAGOUV_SEARCH, timeout=30)
    resp.raise_for_status()
    datasets = resp.json().get("data", [])
    # Titres du type : "\"Carte des loyers\" - Indicateurs de loyers d'annonce par commune en 2025"
    dated = []
    for d in datasets:
        m = re.search(r"en (\d{4})", d.get("title", ""))
        if m:
            dated.append((int(m.group(1)), d))
    if not dated:
        raise RuntimeError("Aucun jeu de données 'Carte des loyers' trouvé sur data.gouv.fr")
    dated.sort(key=lambda x: x[0])
    year, dataset = dated[-1]
    return year, dataset


def resource_url(dataset: dict, exact_title: str) -> str:
    for r in dataset.get("resources", []):
        title = (r.get("title") or "").strip().lower()
        if title == exact_title and r.get("format") == "csv":
            return r["url"]
    raise RuntimeError(f"Ressource '{exact_title}' introuvable dans le dataset {dataset.get('id')}")


def load_csv(url: str) -> pd.DataFrame:
    df = pd.read_csv(url, sep=";", decimal=",", encoding="latin1", dtype={"INSEE_C": str})
    return df[["INSEE_C", "loypredm2"]].rename(columns={"INSEE_C": "insee_code"})


def compute_kpis(year: int, dataset: dict) -> pd.DataFrame:
    # Titres exacts vérifiés sur l'édition 2025 : "indicateurs de loyer
    # appartement" désigne le fichier tous types confondus (le dataset a
    # aussi des variantes "1 ou 2 pièces" / "3 pièces ou plus" à ignorer ici).
    appart = load_csv(resource_url(dataset, "indicateurs de loyer appartement")).rename(columns={"loypredm2": "loyer_predit_appartement"})
    maison = load_csv(resource_url(dataset, "indicateurs de loyer maison")).rename(columns={"loypredm2": "loyer_predit_maison"})

    merged = pd.merge(appart, maison, on="insee_code", how="outer")
    merged["loyers_year"] = year
    return merged


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

    print(f"Upsert de {len(rows)} lignes dans city_external_kpis (colonnes loyers)...")
    batch_size = 500
    for i in range(0, len(rows), batch_size):
        batch = rows[i : i + batch_size]
        client.table("city_external_kpis").upsert(batch, on_conflict="insee_code").execute()
        print(f"  {min(i + batch_size, len(rows))}/{len(rows)}")
    print("Terminé.")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--upload", action="store_true")
    parser.add_argument("--out", type=str, default="data/city_external_kpis_loyers.csv")
    args = parser.parse_args()

    print("Recherche du dataset 'Carte des loyers' le plus récent...")
    year, dataset = find_latest_dataset()
    print(f"Année trouvée : {year} (dataset {dataset.get('id')})")

    result = compute_kpis(year, dataset)
    print(f"Communes : {len(result)}")
    print(result.head(5).to_string())

    os.makedirs("data", exist_ok=True)
    result.to_csv(args.out, index=False)
    print(f"CSV écrit : {args.out}")

    if args.upload:
        upload(result)


if __name__ == "__main__":
    main()
