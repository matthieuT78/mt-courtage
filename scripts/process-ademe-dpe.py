#!/usr/bin/env python3
"""
process-ademe-dpe.py — Part des logements classés F/G (passoires thermiques)
par commune, depuis la base ADEME des DPE (logements existants, depuis
juillet 2021).

Source : https://data.ademe.fr/datasets/dpe03existant
API data-fair : dataset id "meg-83tjwtg8dyz4vv7h1dqe"

La base contient ~15,5M diagnostics individuels. L'API d'agrégation native
(values_agg) plafonne à 1000 groupes, insuffisant pour les ~35 000 communes
françaises — on paginate donc l'export brut (2 colonnes seulement :
code_insee_ban, etiquette_dpe) et on agrège en local avec pandas.

Usage :
  python3 scripts/process-ademe-dpe.py --upload
"""

import argparse
import os
import sys
import time
from collections import defaultdict

import pandas as pd
import requests

DATASET_ID = "meg-83tjwtg8dyz4vv7h1dqe"
BASE_URL = f"https://data.ademe.fr/data-fair/api/v1/datasets/{DATASET_ID}/lines"
PAGE_SIZE = 10000


def fetch_all_paginated(limit_pages: int | None = None) -> dict:
    """Retourne {insee_code: {"total": n, "fg": n}}."""
    counts: dict = defaultdict(lambda: {"total": 0, "fg": 0})
    session = requests.Session()
    url = BASE_URL
    params = {"select": "code_insee_ban,etiquette_dpe", "size": PAGE_SIZE}
    page = 0

    while url:
        for attempt in range(5):
            try:
                resp = session.get(url, params=params, timeout=60)
                resp.raise_for_status()
                break
            except requests.RequestException as e:
                wait = 2 ** attempt
                print(f"  retry dans {wait}s ({e})", file=sys.stderr)
                time.sleep(wait)
        else:
            raise RuntimeError("Échec après 5 tentatives")

        data = resp.json()
        for r in data.get("results", []):
            code = r.get("code_insee_ban")
            label = r.get("etiquette_dpe")
            if not code or not label:
                continue
            counts[code]["total"] += 1
            if label in ("F", "G"):
                counts[code]["fg"] += 1

        page += 1
        if page % 20 == 0:
            print(f"  page {page} ({page * PAGE_SIZE:,} lignes traitées, {len(counts)} communes)")

        url = data.get("next")
        params = None  # "next" est une URL déjà complète avec ses propres query params

        if limit_pages and page >= limit_pages:
            print(f"  arrêt anticipé après {limit_pages} pages (--max-pages)")
            break

        # Léger délai proactif : sans lui, l'API ADEME renvoie un 429 sur
        # quasiment chaque requête (observé en pratique), ce qui double le
        # temps total via les retries. Un throttle constant est plus rapide
        # que de compter sur le backoff exponentiel après coup.
        time.sleep(0.3)

    return counts


def compute_kpis(counts: dict) -> pd.DataFrame:
    rows = [
        {"insee_code": code, "dpe_total": v["total"], "dpe_fg": v["fg"]}
        for code, v in counts.items()
    ]
    return pd.DataFrame(rows)


def upload(result: pd.DataFrame):
    from supabase import create_client

    url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print("ERREUR : SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent être définis.", file=sys.stderr)
        sys.exit(1)

    client = create_client(url, key)
    result = result.copy()
    result["dpe_updated_at"] = pd.Timestamp.utcnow().isoformat()
    clean = result.astype(object).where(pd.notnull(result), None)
    rows = clean.to_dict(orient="records")

    print(f"Upsert de {len(rows)} lignes dans city_external_kpis (colonnes DPE)...")
    batch_size = 500
    for i in range(0, len(rows), batch_size):
        batch = rows[i : i + batch_size]
        client.table("city_external_kpis").upsert(batch, on_conflict="insee_code").execute()
        print(f"  {min(i + batch_size, len(rows))}/{len(rows)}")
    print("Terminé.")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--upload", action="store_true")
    parser.add_argument("--out", type=str, default="data/city_external_kpis_dpe.csv")
    parser.add_argument("--max-pages", type=int, default=None, help="Limite de pages (debug)")
    args = parser.parse_args()

    print("Extraction paginée des DPE (peut prendre 15-25 min)...")
    counts = fetch_all_paginated(limit_pages=args.max_pages)
    print(f"Communes agrégées : {len(counts)}")

    result = compute_kpis(counts)
    print(result.sort_values("dpe_total", ascending=False).head(5).to_string())

    os.makedirs("data", exist_ok=True)
    result.to_csv(args.out, index=False)
    print(f"CSV écrit : {args.out}")

    if args.upload:
        upload(result)


if __name__ == "__main__":
    main()
