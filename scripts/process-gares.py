#!/usr/bin/env python3
"""
process-gares.py — Gare voyageurs SNCF la plus proche par commune (nom +
distance à vol d'oiseau).

Sources :
  - Liste des gares (SNCF, data.gouv.fr) — coordonnées GPS des gares,
    filtrées aux gares voyageurs (exclut fret pur).
  - geo.api.gouv.fr — coordonnées (centroïde) de chaque commune, API
    officielle (Base Adresse Nationale/IGN), pas de fichier à télécharger.

La recherche du plus proche voisin se fait en 2 temps : un KDTree sur une
projection équirectangulaire approximative (rapide, correct pour trouver LE
bon candidat à l'échelle de la France), puis un calcul de distance
haversine exact sur ce candidat pour un chiffre en km fiable.

Usage :
  python3 scripts/process-gares.py --upload
"""

import argparse
import io
import math
import os
import sys

import pandas as pd
import requests

GARES_URL = "https://www.data.gouv.fr/api/1/datasets/r/d22ba593-90a4-4725-977c-095d1f654d28"
COMMUNES_API = "https://geo.api.gouv.fr/communes"


def load_gares() -> pd.DataFrame:
    resp = requests.get(GARES_URL, timeout=60)
    resp.raise_for_status()
    df = pd.read_csv(io.BytesIO(resp.content), sep=";", encoding="utf-8-sig")
    df = df[df["VOYAGEURS"] == "O"]
    df = df.dropna(subset=["X_WGS84", "Y_WGS84", "LIBELLE"])
    df = df.drop_duplicates(subset=["LIBELLE", "X_WGS84", "Y_WGS84"])
    return df[["LIBELLE", "X_WGS84", "Y_WGS84"]].rename(
        columns={"LIBELLE": "gare_nom", "X_WGS84": "lon", "Y_WGS84": "lat"}
    )


def load_communes() -> pd.DataFrame:
    rows = []
    # Paris/Lyon/Marseille n'apparaissent dans /communes qu'au niveau ville
    # entière (75056/69123/13055) — leurs 45 arrondissements municipaux
    # (75101-75120, 69381-69389, 13201-13216) ne sortent qu'avec ce filtre
    # type= dédié, même souci que pour Filosofi/taxe foncière.
    for params in (
        {"fields": "code,centre", "format": "json"},
        {"type": "arrondissement-municipal", "fields": "code,centre", "format": "json"},
    ):
        resp = requests.get(COMMUNES_API, params=params, timeout=60)
        resp.raise_for_status()
        for c in resp.json():
            centre = c.get("centre")
            if not centre:
                continue
            lon, lat = centre["coordinates"]
            rows.append({"insee_code": c["code"], "lon": lon, "lat": lat})
    return pd.DataFrame(rows)


def haversine_km(lon1, lat1, lon2, lat2):
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlambda / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def compute(gares: pd.DataFrame, communes: pd.DataFrame) -> pd.DataFrame:
    from scipy.spatial import cKDTree

    mean_lat_rad = math.radians(communes["lat"].mean())
    cos_lat = math.cos(mean_lat_rad)

    gares_xy = gares[["lon", "lat"]].to_numpy(dtype=float)
    gares_xy[:, 0] *= cos_lat
    tree = cKDTree(gares_xy)

    communes_xy = communes[["lon", "lat"]].to_numpy(dtype=float)
    communes_xy[:, 0] *= cos_lat
    _, idx = tree.query(communes_xy, k=1)

    nearest = gares.iloc[idx].reset_index(drop=True)
    result = communes.reset_index(drop=True).copy()
    result["gare_nom"] = nearest["gare_nom"].values
    result["gare_distance_km"] = [
        round(haversine_km(row.lon, row.lat, nrow.lon, nrow.lat), 1)
        for row, nrow in zip(communes.itertuples(), nearest.itertuples())
    ]
    return result[["insee_code", "gare_nom", "gare_distance_km"]]


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

    print(f"Upsert de {len(rows)} lignes dans city_external_kpis (gare la plus proche)...")
    batch_size = 500
    for i in range(0, len(rows), batch_size):
        batch = rows[i : i + batch_size]
        client.table("city_external_kpis").upsert(batch, on_conflict="insee_code").execute()
        print(f"  {min(i + batch_size, len(rows))}/{len(rows)}")
    print("Terminé.")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--upload", action="store_true")
    parser.add_argument("--out", type=str, default="data/gares.csv")
    args = parser.parse_args()

    print("Chargement des gares SNCF...")
    gares = load_gares()
    print(f"  {len(gares)} gares voyageurs.")

    print("Chargement des communes (geo.api.gouv.fr)...")
    communes = load_communes()
    print(f"  {len(communes)} communes.")

    print("Calcul de la gare la plus proche par commune...")
    result = compute(gares, communes)
    print(result.head(5).to_string())
    print(f"Distance médiane : {result['gare_distance_km'].median():.1f} km")

    os.makedirs("data", exist_ok=True)
    result.to_csv(args.out, index=False)
    print(f"CSV écrit : {args.out}")

    if args.upload:
        upload(result)


if __name__ == "__main__":
    main()
