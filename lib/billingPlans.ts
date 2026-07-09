import type { Plan } from "./permissions";

export type PaidBillingPlan = {
  id: Extract<Plan, "landlord_5" | "landlord_15" | "landlord_unlimited">;
  name: string;
  description: string;
  priceLabel: string;
  monthlyPrice: number | null;
  yearlyPrice: number | null;
  limitLabel: string;
  audience: string;
  features: string[];
  recommended?: boolean;
  envPriceKey: string;
  monthlyEnvPriceKey?: string;
  yearlyEnvPriceKey?: string;
};

export type BillingInterval = "monthly" | "yearly";

export const PAID_BILLING_PLANS: PaidBillingPlan[] = [
  {
    id: "landlord_5",
    name: "lokt·one",
    description: "Pour trouver le prochain locataire, automatiser les quittances et activer la relation locataire.",
    priceLabel: "6,90 € / mois",
    monthlyPrice: 6.9,
    yearlyPrice: 69,
    limitLabel: "Jusqu’à 2 logements actifs",
    audience: "Candidatures & automatisation",
    features: [
      "Tout le plan Gratuit",
      "Dossier de candidature en ligne : lien dédié, scoring automatique, suppression RGPD",
      "Quittances PDF envoyées automatiquement au locataire",
      "Validation du paiement par email avant génération",
      "Toutes les alertes métier : échéances, IRL, baux et états des lieux",
      "Relance bailleur à J+1 en l’absence de réponse",
      "Portail locataire activé (quittances, bail, EDL accessibles en ligne)",
      "Partage des documents avec le locataire par email",
      "Accusé de réception locataire horodaté",
      "Vue dossier bail : statut consolidé par location",
      "150 Mo de stockage documentaire sécurisé",
    ],
    recommended: true,
    envPriceKey: "STRIPE_PRICE_LANDLORD_5",
    monthlyEnvPriceKey: "STRIPE_PRICE_STARTER_MONTHLY",
    yearlyEnvPriceKey: "STRIPE_PRICE_STARTER_YEARLY",
  },
  {
    id: "landlord_15",
    name: "lokt·plus",
    description: "Pour piloter la rentabilité, préparer la fiscalité et travailler proprement.",
    priceLabel: "11,90 € / mois",
    monthlyPrice: 11.9,
    yearlyPrice: 119,
    limitLabel: "Jusqu’à 5 logements actifs",
    audience: "Pilotage & déclaration",
    features: [
      "Tout le plan lokt·one",
      "Boîte à outils bailleur : eau, charges, TEOM et régularisation",
      "Simulateurs bailleur : LMNP, IRL et arbitrages",
      "Performance et rentabilité par logement",
      "Cash-flow, charges, crédit et plan d’action",
      "Aide à la déclaration premium",
      "Exports finance, filtres et justificatifs",
      "500 Mo de stockage documentaire sécurisé",
    ],
    envPriceKey: "STRIPE_PRICE_LANDLORD_15",
    monthlyEnvPriceKey: "STRIPE_PRICE_ESSENTIEL_MONTHLY",
    yearlyEnvPriceKey: "STRIPE_PRICE_ESSENTIEL_YEARLY",
  },
  {
    id: "landlord_unlimited",
    name: "Pro / agence",
    description: "Pour les agences et gestionnaires qui veulent centraliser les dossiers, documents sensibles et preuves de gestion.",
    priceLabel: "À partir de 29 € / mois",
    monthlyPrice: null,
    yearlyPrice: null,
    limitLabel: "Module en préparation",
    audience: "Coffre-fort documentaire",
    features: [
      "Dossiers locataires et garants encadrés",
      "Pièces d’identité, assurances, diagnostics et justificatifs",
      "Checklist documentaire par bien, bail et locataire",
      "Traçabilité des documents et accès équipe",
      "10 Go de stockage documentaire sécurisé",
    ],
    envPriceKey: "STRIPE_PRICE_LANDLORD_UNLIMITED",
  },
];

export function getBillingPlan(planId: string | null | undefined) {
  return PAID_BILLING_PLANS.find((plan) => plan.id === planId) ?? null;
}

export function getPlanFromStripePrice(priceId: string | null | undefined) {
  if (!priceId) return null;
  return (
    PAID_BILLING_PLANS.find((plan) =>
      [plan.envPriceKey, plan.monthlyEnvPriceKey, plan.yearlyEnvPriceKey].some((key) => key && process.env[key] === priceId)
    )?.id ?? null
  );
}

export function getStripePriceId(planId: string | null | undefined, billing: BillingInterval = "monthly") {
  const plan = getBillingPlan(planId);
  if (!plan) return null;

  const intervalKey = billing === "yearly" ? plan.yearlyEnvPriceKey : plan.monthlyEnvPriceKey;
  if (intervalKey && process.env[intervalKey]) {
    return { plan, priceId: process.env[intervalKey] as string, envKey: intervalKey, billing };
  }

  if (process.env[plan.envPriceKey]) {
    return { plan, priceId: process.env[plan.envPriceKey] as string, envKey: plan.envPriceKey, billing: "monthly" as BillingInterval };
  }

  return { plan, priceId: null, envKey: intervalKey || plan.envPriceKey, billing };
}
