-- Table de données de référence immobilières
-- Chaque ligne = une section de l'API /donnees
-- Mise à jour : manuelle (loyers, taux) ou automatique via cron (stats leads)

CREATE TABLE IF NOT EXISTS donnees_reference (
  key         text PRIMARY KEY,
  data        jsonb NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- RLS : lecture publique, écriture service role uniquement
ALTER TABLE donnees_reference ENABLE ROW LEVEL SECURITY;

CREATE POLICY "donnees_reference_public_read"
  ON donnees_reference FOR SELECT
  USING (true);

-- Seed initial : taux de crédit (à mettre à jour manuellement chaque trimestre)
INSERT INTO donnees_reference (key, data) VALUES (
  'taux_credit_immobilier',
  '{
    "description": "Taux moyens constatés en France, hors assurance emprunteur (T2 2026)",
    "unite": "% annuel",
    "source": "Observatoire Crédit Logement/CSA",
    "donnees": [
      { "duree_ans": 15, "taux_moyen": 3.20, "taux_bas": 2.90, "taux_haut": 3.55 },
      { "duree_ans": 20, "taux_moyen": 3.40, "taux_bas": 3.10, "taux_haut": 3.70 },
      { "duree_ans": 25, "taux_moyen": 3.60, "taux_bas": 3.25, "taux_haut": 3.95 }
    ]
  }'::jsonb
) ON CONFLICT (key) DO NOTHING;

INSERT INTO donnees_reference (key, data) VALUES (
  'loyers_medians_par_ville',
  '{
    "description": "Loyers médians constatés par m² en France (T2 2026, appartements)",
    "unite": "€/m²/mois",
    "source": "CLAMEUR / observatoires locaux",
    "donnees": [
      { "ville": "Paris",       "code_postal": "75", "loyer_median_m2": 23.5, "evolution_annuelle_pct": 1.8 },
      { "ville": "Lyon",        "code_postal": "69", "loyer_median_m2": 13.8, "evolution_annuelle_pct": 2.1 },
      { "ville": "Bordeaux",    "code_postal": "33", "loyer_median_m2": 13.2, "evolution_annuelle_pct": 1.5 },
      { "ville": "Marseille",   "code_postal": "13", "loyer_median_m2": 11.5, "evolution_annuelle_pct": 2.4 },
      { "ville": "Toulouse",    "code_postal": "31", "loyer_median_m2": 12.1, "evolution_annuelle_pct": 2.2 },
      { "ville": "Nantes",      "code_postal": "44", "loyer_median_m2": 12.8, "evolution_annuelle_pct": 1.9 },
      { "ville": "Lille",       "code_postal": "59", "loyer_median_m2": 12.4, "evolution_annuelle_pct": 2.0 },
      { "ville": "Montpellier", "code_postal": "34", "loyer_median_m2": 13.0, "evolution_annuelle_pct": 2.3 },
      { "ville": "Strasbourg",  "code_postal": "67", "loyer_median_m2": 11.8, "evolution_annuelle_pct": 1.7 },
      { "ville": "Rennes",      "code_postal": "35", "loyer_median_m2": 12.6, "evolution_annuelle_pct": 2.0 },
      { "ville": "Nice",        "code_postal": "06", "loyer_median_m2": 14.2, "evolution_annuelle_pct": 1.6 },
      { "ville": "Grenoble",    "code_postal": "38", "loyer_median_m2": 11.4, "evolution_annuelle_pct": 1.8 }
    ]
  }'::jsonb
) ON CONFLICT (key) DO NOTHING;

INSERT INTO donnees_reference (key, data) VALUES (
  'rendements_locatifs_par_type',
  '{
    "description": "Rendements bruts médians par type de bien en France (T2 2026, hors Paris)",
    "unite": "% annuel brut",
    "donnees": [
      { "type_bien": "Studio (< 20 m²)",    "rendement_brut_median": 6.8, "rendement_brut_bas": 5.5, "rendement_brut_haut": 9.0 },
      { "type_bien": "T1 (20-35 m²)",       "rendement_brut_median": 6.2, "rendement_brut_bas": 4.8, "rendement_brut_haut": 8.5 },
      { "type_bien": "T2 (35-55 m²)",       "rendement_brut_median": 5.8, "rendement_brut_bas": 4.2, "rendement_brut_haut": 7.5 },
      { "type_bien": "T3 (55-80 m²)",       "rendement_brut_median": 5.2, "rendement_brut_bas": 3.8, "rendement_brut_haut": 7.0 },
      { "type_bien": "T4+ (> 80 m²)",       "rendement_brut_median": 4.8, "rendement_brut_bas": 3.5, "rendement_brut_haut": 6.5 },
      { "type_bien": "Maison individuelle",  "rendement_brut_median": 4.5, "rendement_brut_bas": 3.2, "rendement_brut_haut": 6.0 }
    ]
  }'::jsonb
) ON CONFLICT (key) DO NOTHING;

INSERT INTO donnees_reference (key, data) VALUES (
  'rendements_par_ville',
  '{
    "description": "Rendements bruts médians par ville pour un T2 (T2 2026)",
    "unite": "% annuel brut",
    "donnees": [
      { "ville": "Paris",       "rendement_brut_median": 3.2 },
      { "ville": "Lyon",        "rendement_brut_median": 5.1 },
      { "ville": "Bordeaux",    "rendement_brut_median": 4.8 },
      { "ville": "Marseille",   "rendement_brut_median": 6.2 },
      { "ville": "Toulouse",    "rendement_brut_median": 5.5 },
      { "ville": "Nantes",      "rendement_brut_median": 5.2 },
      { "ville": "Lille",       "rendement_brut_median": 6.1 },
      { "ville": "Montpellier", "rendement_brut_median": 5.8 },
      { "ville": "Strasbourg",  "rendement_brut_median": 5.7 },
      { "ville": "Rennes",      "rendement_brut_median": 5.4 },
      { "ville": "Nice",        "rendement_brut_median": 4.1 },
      { "ville": "Grenoble",    "rendement_brut_median": 6.0 }
    ]
  }'::jsonb
) ON CONFLICT (key) DO NOTHING;

INSERT INTO donnees_reference (key, data) VALUES (
  'taux_endettement',
  '{
    "description": "Taux d'\''endettement des emprunteurs immobiliers en France (2026)",
    "plafond_reglementaire_hcsf": 35,
    "moyen_constate": 28.3,
    "median_constate": 27.1
  }'::jsonb
) ON CONFLICT (key) DO NOTHING;
