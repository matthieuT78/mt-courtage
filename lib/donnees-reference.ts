// lib/donnees-reference.ts
// Données de référence hardcodées — fallback si Supabase indisponible.
// Mise à jour manuelle trimestrielle (taux, loyers, rendements).
// Les stats capacité d'emprunt sont recalculées automatiquement par le cron refresh-donnees.

export const DONNEES_IMMO_FALLBACK = {
  meta: {
    source: "lokt.fr",
    description: "Données immobilières de référence France — loyers médians, rendements, taux de crédit, capacité d'emprunt. Mise à jour trimestrielle.",
    periode: "T4 2026",
    sources_externes: [
      "Observatoire Crédit Logement/CSA",
      "DGALN / ANIL / INRAE (Carte des loyers)",
      "DVF / DGFiP (via city_market_benchmarks, calculé par lokt.fr)",
      "Banque de France / HCSF",
    ],
    nb_simulations_capacite: null as number | null,
    derniere_mise_a_jour: null as string | null,
  },
  taux_credit_immobilier: {
    description: "Taux moyens constatés en France, hors assurance emprunteur (T3 2026, dernière décomposition par durée disponible)",
    unite: "% annuel",
    source: "Observatoire Crédit Logement/CSA",
    donnees: [
      { duree_ans: 15, taux_moyen: 3.14, taux_bas: 2.84, taux_haut: 3.49 },
      { duree_ans: 20, taux_moyen: 3.27, taux_bas: 2.97, taux_haut: 3.57 },
      { duree_ans: 25, taux_moyen: 3.35, taux_bas: 3.00, taux_haut: 3.70 },
    ],
  },
  taux_endettement: {
    description: "Taux d'endettement des emprunteurs immobiliers en France (2026)",
    unite: "%",
    plafond_reglementaire_hcsf: 35,
    moyen_constate: 28.3,
    median_constate: 27.1,
  },
  capacite_emprunt_reference: {
    description: "Capacité d'emprunt indicative par tranche de revenus nets mensuels, sans autres charges, aux taux moyens ci-dessus (taux_credit_immobilier) hors assurance",
    unite: "€",
    hypotheses: { taux_endettement_cible: 35, taux_credit_20_ans: 3.4, taux_credit_25_ans: 3.6, assurance: 0.36 },
    donnees: [
      { revenus_nets_mensuels: 2000, mensualite_max: 700,  capital_20_ans: 118000, capital_25_ans: 133000 },
      { revenus_nets_mensuels: 3000, mensualite_max: 1050, capital_20_ans: 177000, capital_25_ans: 200000 },
      { revenus_nets_mensuels: 4000, mensualite_max: 1400, capital_20_ans: 236000, capital_25_ans: 266000 },
      { revenus_nets_mensuels: 5000, mensualite_max: 1750, capital_20_ans: 295000, capital_25_ans: 333000 },
      { revenus_nets_mensuels: 6000, mensualite_max: 2100, capital_20_ans: 354000, capital_25_ans: 400000 },
      { revenus_nets_mensuels: 8000, mensualite_max: 2800, capital_20_ans: 472000, capital_25_ans: 533000 },
      { revenus_nets_mensuels: 10000, mensualite_max: 3500, capital_20_ans: 590000, capital_25_ans: 666000 },
    ],
  },
  loyers_medians_par_ville: {
    description: "Loyer prédit par commune (appartements), modèle officiel DGALN/ANIL/INRAE 'Carte des loyers' — Paris/Lyon/Marseille calculés par moyenne des arrondissements",
    unite: "€/m²/mois",
    source: "DGALN / ANIL / INRAE (Carte des loyers)",
    donnees: [
      { ville: "Paris",       code_postal: "75", loyer_median_m2: 33.09 },
      { ville: "Lyon",        code_postal: "69", loyer_median_m2: 16.63 },
      { ville: "Bordeaux",    code_postal: "33", loyer_median_m2: 15.99 },
      { ville: "Marseille",   code_postal: "13", loyer_median_m2: 16.24 },
      { ville: "Toulouse",    code_postal: "31", loyer_median_m2: 13.98 },
      { ville: "Nantes",      code_postal: "44", loyer_median_m2: 14.50 },
      { ville: "Lille",       code_postal: "59", loyer_median_m2: 15.76 },
      { ville: "Montpellier", code_postal: "34", loyer_median_m2: 15.49 },
      { ville: "Strasbourg",  code_postal: "67", loyer_median_m2: 11.8 },
      { ville: "Rennes",      code_postal: "35", loyer_median_m2: 14.87 },
      { ville: "Nice",        code_postal: "06", loyer_median_m2: 20.43 },
      { ville: "Grenoble",    code_postal: "38", loyer_median_m2: 13.41 },
    ],
  },
  rendements_locatifs_par_type: {
    description: "Rendements bruts médians par type de bien en France (T2 2026, hors Paris)",
    unite: "% annuel brut",
    note: "Rendement brut = loyers annuels / prix d'achat frais inclus. Le rendement net est inférieur de 1,5 à 2 points après charges.",
    donnees: [
      { type_bien: "Studio (< 20 m²)",   rendement_brut_median: 6.8, rendement_brut_bas: 5.5, rendement_brut_haut: 9.0 },
      { type_bien: "T1 (20-35 m²)",      rendement_brut_median: 6.2, rendement_brut_bas: 4.8, rendement_brut_haut: 8.5 },
      { type_bien: "T2 (35-55 m²)",      rendement_brut_median: 5.8, rendement_brut_bas: 4.2, rendement_brut_haut: 7.5 },
      { type_bien: "T3 (55-80 m²)",      rendement_brut_median: 5.2, rendement_brut_bas: 3.8, rendement_brut_haut: 7.0 },
      { type_bien: "T4+ (> 80 m²)",      rendement_brut_median: 4.8, rendement_brut_bas: 3.5, rendement_brut_haut: 6.5 },
      { type_bien: "Maison individuelle", rendement_brut_median: 4.5, rendement_brut_bas: 3.2, rendement_brut_haut: 6.0 },
    ],
  },
  rendements_par_ville: {
    description: "Rendement brut médian par ville, calculé à partir du loyer prédit (DGALN/ANIL/INRAE) et du prix médian DVF réel (city_market_benchmarks) — Strasbourg non recalculé (pas de donnée DVF commune disponible)",
    unite: "% annuel brut",
    donnees: [
      { ville: "Paris",       rendement_brut_median: 3.73 },
      { ville: "Lyon",        rendement_brut_median: 4.42 },
      { ville: "Bordeaux",    rendement_brut_median: 4.50 },
      { ville: "Marseille",   rendement_brut_median: 6.16 },
      { ville: "Toulouse",    rendement_brut_median: 5.07 },
      { ville: "Nantes",      rendement_brut_median: 4.98 },
      { ville: "Lille",       rendement_brut_median: 5.47 },
      { ville: "Montpellier", rendement_brut_median: 5.43 },
      { ville: "Strasbourg",  rendement_brut_median: 5.7 },
      { ville: "Rennes",      rendement_brut_median: 4.71 },
      { ville: "Nice",        rendement_brut_median: 5.02 },
      { ville: "Grenoble",    rendement_brut_median: 6.43 },
    ],
  },
};
