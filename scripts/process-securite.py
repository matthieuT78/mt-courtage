#!/usr/bin/env python3
"""
process-securite.py — Indicateur de sécurité composite par commune, depuis
la base statistique communale de la délinquance (Interstats, Ministère de
l'Intérieur, republiée sur data.gouv.fr).

On combine 5 des 15 indicateurs disponibles — ceux les plus pertinents pour
évaluer un cadre de vie résidentiel (risque subi par un habitant), en
excluant volontairement les indicateurs qui reflètent surtout l'activité
policière plutôt qu'un risque réel (usage/trafic de stupéfiants,
escroqueries, vols de véhicules/accessoires) :
  - Cambriolages de logement
  - Violences physiques hors cadre familial
  - Violences sexuelles
  - Vols avec armes
  - Vols violents sans arme

Chaque indicateur est déjà fourni en taux pour 1000 habitants par la
source — on additionne simplement les 5 taux, puis on convertit en
percentile national pour le libellé (même logique que investment_score :
un chiffre brut seul ne dit rien sans comparaison).

Certaines lignes ont un nombre/taux non diffusé (secret statistique sur
petit nombre) mais une estimation de substitution dans complement_info_*
— on l'utilise en repli plutôt que de perdre la commune.

Usage :
  python3 scripts/process-securite.py --upload
"""

import argparse
import io
import os
import sys

import pandas as pd
import requests

SOURCE_URL = "https://www.data.gouv.fr/api/1/datasets/r/44ef4323-1097-48d5-8719-3c544b55d294"

WANTED_INDICATEURS = [
    "Cambriolages de logement",
    "Violences physiques hors cadre familial",
    "Violences sexuelles",
    "Vols avec armes",
    "Vols violents sans arme",
]

MIN_POPULATION = 500  # en dessous, un seul fait divers fait exploser le taux/1000 hab.

BANDS = [
    (80, "Élevé"),
    (60, "Vigilance"),
    (40, "Modéré"),
    (20, "Sûr"),
    (0, "Très sûr"),
]


def band_for(pct: float) -> str:
    for threshold, label in BANDS:
        if pct >= threshold:
            return label
    return BANDS[-1][1]


def download() -> pd.DataFrame:
    resp = requests.get(SOURCE_URL, timeout=180)
    resp.raise_for_status()
    return pd.read_csv(io.BytesIO(resp.content), sep=";", compression="gzip", dtype={"CODGEO_2026": str})


def compute(df: pd.DataFrame) -> pd.DataFrame:
    df = df[df["indicateur"].isin(WANTED_INDICATEURS)].copy()

    latest_year = df["annee"].max()
    print(f"Année la plus récente : {latest_year}")
    df = df[df["annee"] == latest_year]

    for col in ["taux_pour_mille", "complement_info_taux", "insee_pop"]:
        df[col] = df[col].astype(str).str.replace(",", ".", regex=False)
        df[col] = pd.to_numeric(df[col], errors="coerce")

    # Repli sur l'estimation de substitution quand le taux exact est secret statistique.
    df["taux_effectif"] = df["taux_pour_mille"].fillna(df["complement_info_taux"])

    df = df[df["insee_pop"] >= MIN_POPULATION]
    df = df.dropna(subset=["taux_effectif"])

    grouped = df.groupby("CODGEO_2026").agg(
        securite_taux_pour_mille=("taux_effectif", "sum"),
        nb_indicateurs=("indicateur", "count"),
    ).reset_index()

    # Une commune où seuls 1-2 des 5 indicateurs sont diffusés donnerait un
    # taux composite sous-estimé et non comparable — exige les 5.
    grouped = grouped[grouped["nb_indicateurs"] == len(WANTED_INDICATEURS)]
    print(f"{len(grouped)} communes avec les 5 indicateurs disponibles (population >= {MIN_POPULATION}).")

    grouped["pct"] = grouped["securite_taux_pour_mille"].rank(pct=True) * 100
    grouped["securite_band"] = grouped["pct"].apply(band_for)
    grouped["securite_year"] = int(latest_year)
    grouped["securite_taux_pour_mille"] = grouped["securite_taux_pour_mille"].round(2)

    return grouped.rename(columns={"CODGEO_2026": "insee_code"})[
        ["insee_code", "securite_taux_pour_mille", "securite_band", "securite_year"]
    ]


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

    print(f"Upsert de {len(rows)} lignes dans city_external_kpis (sécurité)...")
    batch_size = 500
    for i in range(0, len(rows), batch_size):
        batch = rows[i : i + batch_size]
        client.table("city_external_kpis").upsert(batch, on_conflict="insee_code").execute()
        print(f"  {min(i + batch_size, len(rows))}/{len(rows)}")
    print("Terminé.")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--upload", action="store_true")
    parser.add_argument("--out", type=str, default="data/securite.csv")
    args = parser.parse_args()

    print("Téléchargement des données de délinquance (Interstats)...")
    df = download()
    print(f"  {len(df)} lignes brutes.")

    result = compute(df)
    print(result["securite_band"].value_counts().to_string())

    os.makedirs("data", exist_ok=True)
    result.to_csv(args.out, index=False)
    print(f"CSV écrit : {args.out}")

    if args.upload:
        upload(result)


if __name__ == "__main__":
    main()
