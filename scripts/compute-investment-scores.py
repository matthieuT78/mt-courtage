#!/usr/bin/env python3
"""
compute-investment-scores.py — Score lokt.fr : potentiel d'investissement
locatif par commune (0-100), combinant 4 signaux déjà en base :

  - rendement locatif brut (loyer officiel × 12 / prix DVF)     poids 35%
  - tension locative (1 - taux de vacance INSEE)                poids 20%
  - dynamique de prix (évolution DVF sur la période disponible) poids 20%
  - risque réglementaire (1 - part de DPE F/G)                  poids 25%

Chaque signal est converti en percentile national (rang parmi les communes
éligibles) avant pondération, plutôt qu'un min-max linéaire — une commune
extrême (ex. Paris) ne doit pas écraser l'échelle des autres, comme pour les
paliers de la carte choroplèthe (cf. DepartmentChoropleth.tsx).

Une commune n'est notée que si les 4 signaux sont disponibles ET qu'elle a
au moins MIN_TRANSACTIONS ventes DVF sur la dernière année connue — sinon le
score serait basé sur des données trop parcellaires pour être fiable.

Usage :
  python3 scripts/compute-investment-scores.py --upload
"""

import argparse
import os
import sys

import pandas as pd

MIN_TRANSACTIONS = 20

# Filosofi (INSEE) ne publie le taux de vacance qu'au niveau de la ville
# entière pour Paris/Lyon/Marseille, jamais par arrondissement — même
# fallback que ARRONDISSEMENT_PARENT dans lib/cityPriceData.ts, sinon les
# 45 arrondissements (des pages à fort trafic) n'ont jamais de score.
ARRONDISSEMENT_PARENT = {"751": "75056", "693": "69123", "132": "13055"}

WEIGHTS = {
    "rendement": 0.35,
    "tension": 0.20,
    "evolution": 0.20,
    "dpe": 0.25,
}

BANDS = [
    (80, "Excellent potentiel"),
    (60, "Bon potentiel"),
    (40, "Potentiel moyen"),
    (20, "Potentiel limité"),
    (0, "Faible potentiel"),
]


def band_for(score: int) -> str:
    for threshold, label in BANDS:
        if score >= threshold:
            return label
    return BANDS[-1][1]


def fetch_all(client, table: str, columns: str, filters=None) -> pd.DataFrame:
    rows = []
    page_size = 1000
    start = 0
    while True:
        q = client.table(table).select(columns).range(start, start + page_size - 1)
        if filters:
            q = filters(q)
        resp = q.execute()
        batch = resp.data or []
        rows.extend(batch)
        if len(batch) < page_size:
            break
        start += page_size
    return pd.DataFrame(rows)


def compute(client) -> pd.DataFrame:
    print("Chargement des prix DVF (city_market_benchmarks)...")
    prices = fetch_all(
        client, "city_market_benchmarks",
        "insee_code,reference_price_m2_sale",
    )
    prices = prices.dropna(subset=["reference_price_m2_sale"])
    print(f"  {len(prices)} communes avec un prix médian.")

    print("Chargement de l'historique DVF (évolution + nb transactions)...")
    history = fetch_all(
        client, "city_market_benchmarks_history",
        "insee_code,year,reference_price_m2_sale,n_transactions",
        filters=lambda q: q.eq("property_type", "tous"),
    )
    history = history.dropna(subset=["reference_price_m2_sale"])

    last_year = history["year"].max()
    first_year = history["year"].min()
    latest = history[history["year"] == last_year][["insee_code", "reference_price_m2_sale", "n_transactions"]]
    latest = latest.rename(columns={"reference_price_m2_sale": "price_last", "n_transactions": "n_transactions_last"})
    earliest = history[history["year"] == first_year][["insee_code", "reference_price_m2_sale", "n_transactions"]]
    earliest = earliest.rename(columns={"reference_price_m2_sale": "price_first", "n_transactions": "n_transactions_first"})

    evo = pd.merge(earliest, latest, on="insee_code", how="inner")
    evo = evo[(evo["n_transactions_first"] >= MIN_TRANSACTIONS // 2) & (evo["n_transactions_last"] >= MIN_TRANSACTIONS)]
    evo["evolution"] = (evo["price_last"] - evo["price_first"]) / evo["price_first"] * 100
    print(f"  {len(evo)} communes avec une évolution {first_year}-{last_year} fiable.")

    print("Chargement des KPI externes (loyer, DPE, vacance)...")
    kpis = fetch_all(
        client, "city_external_kpis",
        "insee_code,loyer_predit_appartement,loyer_predit_maison,dpe_total,dpe_fg,logements_total,logements_vacants",
    )

    vacance_by_code = kpis.set_index("insee_code")[["logements_total", "logements_vacants"]]
    missing_vacance = kpis["logements_total"].isna()
    fallback_count = 0
    for prefix, parent_code in ARRONDISSEMENT_PARENT.items():
        if parent_code not in vacance_by_code.index:
            continue
        parent_row = vacance_by_code.loc[parent_code]
        mask = missing_vacance & kpis["insee_code"].str.startswith(prefix)
        kpis.loc[mask, "logements_total"] = parent_row["logements_total"]
        kpis.loc[mask, "logements_vacants"] = parent_row["logements_vacants"]
        fallback_count += int(mask.sum())
    print(f"  Fallback vacance arrondissement -> ville : {fallback_count} lignes.")

    df = prices.merge(evo[["insee_code", "n_transactions_last", "evolution"]], on="insee_code", how="inner")
    df = df.merge(kpis, on="insee_code", how="inner")
    print(f"  {len(df)} communes après jointure prix + évolution + KPI externes.")

    df = df[df["n_transactions_last"] >= MIN_TRANSACTIONS]

    loyer = df["loyer_predit_appartement"].fillna(df["loyer_predit_maison"])
    df["rendement"] = (loyer * 12 / df["reference_price_m2_sale"]) * 100
    df = df.dropna(subset=["rendement"])

    df["tension"] = 1 - (df["logements_vacants"] / df["logements_total"])
    df = df.dropna(subset=["tension"])
    df = df[df["logements_total"] > 0]

    df["dpe_risk"] = 1 - (df["dpe_fg"] / df["dpe_total"])
    df = df.dropna(subset=["dpe_risk"])
    df = df[df["dpe_total"] > 0]

    df = df.dropna(subset=["evolution"])
    print(f"  {len(df)} communes éligibles au score (4 signaux + {MIN_TRANSACTIONS}+ ventes/an).")

    if df.empty:
        return df

    df["pct_rendement"] = df["rendement"].rank(pct=True) * 100
    df["pct_tension"] = df["tension"].rank(pct=True) * 100
    df["pct_evolution"] = df["evolution"].rank(pct=True) * 100
    df["pct_dpe"] = df["dpe_risk"].rank(pct=True) * 100

    df["investment_score"] = (
        WEIGHTS["rendement"] * df["pct_rendement"]
        + WEIGHTS["tension"] * df["pct_tension"]
        + WEIGHTS["evolution"] * df["pct_evolution"]
        + WEIGHTS["dpe"] * df["pct_dpe"]
    ).round().astype(int)
    df["investment_score_band"] = df["investment_score"].apply(band_for)

    return df[["insee_code", "investment_score", "investment_score_band"]]


def upload(result: pd.DataFrame, client):
    clean = result.astype(object).where(pd.notnull(result), None)
    rows = clean.to_dict(orient="records")

    print(f"Upsert de {len(rows)} scores dans city_external_kpis...")
    batch_size = 500
    for i in range(0, len(rows), batch_size):
        batch = rows[i : i + batch_size]
        client.table("city_external_kpis").upsert(batch, on_conflict="insee_code").execute()
        print(f"  {min(i + batch_size, len(rows))}/{len(rows)}")
    print("Terminé.")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--upload", action="store_true")
    parser.add_argument("--out", type=str, default="data/investment_scores.csv")
    args = parser.parse_args()

    from supabase import create_client

    url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print("ERREUR : SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent être définis.", file=sys.stderr)
        sys.exit(1)
    client = create_client(url, key)

    result = compute(client)
    if result.empty:
        print("Aucune commune éligible — rien à uploader.", file=sys.stderr)
        sys.exit(1)

    print(result["investment_score_band"].value_counts().to_string())

    os.makedirs("data", exist_ok=True)
    result.to_csv(args.out, index=False)
    print(f"CSV écrit : {args.out}")

    if args.upload:
        upload(result, client)


if __name__ == "__main__":
    main()
