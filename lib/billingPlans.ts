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
    name: "Starter",
    description: "Pour ne plus oublier les quittances, rappels et validations de paiement.",
    priceLabel: "4,90 € / mois",
    monthlyPrice: 4.9,
    yearlyPrice: 49,
    limitLabel: "Jusqu’à 3 logements actifs",
    audience: "Automatisation quittances",
    features: [
      "Quittances PDF + envoi email au locataire",
      "Validation paiement bailleur avant génération",
      "Rappels et alertes pour éviter les oublis",
      "États des lieux, inventaire meublé et finance simple",
    ],
    recommended: true,
    envPriceKey: "STRIPE_PRICE_LANDLORD_5",
    monthlyEnvPriceKey: "STRIPE_PRICE_STARTER_MONTHLY",
    yearlyEnvPriceKey: "STRIPE_PRICE_STARTER_YEARLY",
  },
  {
    id: "landlord_15",
    name: "Essentiel",
    description: "Pour piloter la rentabilité, préparer la fiscalité et travailler proprement.",
    priceLabel: "9,90 € / mois",
    monthlyPrice: 9.9,
    yearlyPrice: 99,
    limitLabel: "Jusqu’à 10 logements actifs",
    audience: "Pilotage & déclaration",
    features: [
      "Tout le plan Starter",
      "Aide à la déclaration premium",
      "Pilotage rentabilité par logement et plan d’action",
      "Exports Excel, filtres finance et justificatifs",
    ],
    envPriceKey: "STRIPE_PRICE_LANDLORD_15",
    monthlyEnvPriceKey: "STRIPE_PRICE_ESSENTIEL_MONTHLY",
    yearlyEnvPriceKey: "STRIPE_PRICE_ESSENTIEL_YEARLY",
  },
  {
    id: "landlord_unlimited",
    name: "Pro / agence",
    description: "Pour organiser un parc important, une agence ou une gestion pour tiers.",
    priceLabel: "Sur devis",
    monthlyPrice: null,
    yearlyPrice: null,
    limitLabel: "Lots actifs sur mesure",
    audience: "Organisation pro",
    features: [
      "Volume de lots adapté au besoin",
      "Traçabilité, exports et workflows en masse",
      "Organisation d’équipe et accompagnement",
      "Accompagnement au paramétrage",
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
