// lib/landlord/assistantCost.ts
//
// Coût réel de Loky, calculé à partir des tokens effectivement consommés
// (renvoyés par chaque réponse de l'API Claude), pas d'un nombre de messages
// approximatif. Sert à garantir que le coût IA d'un abonné ne dépasse jamais
// un pourcentage fixe de ce qu'il paie — voir landlordAssistantMonthlyBudgetUsd.
import type { Plan } from "../permissions";

// Tarifs par modèle, $ / token — à réajuster si les prix Anthropic changent
// (voir console.anthropic.com → Plans & Billing pour les tarifs à jour).
// Sonnet 5 : 2 $/M input, 10 $/M output (tarif permanent confirmé). Haiku 4.5 :
// 1 $/M input, 5 $/M output — exactement moitié prix de Sonnet sur les deux axes.
const MODEL_PRICING_PER_TOKEN_USD: Record<string, { input: number; output: number }> = {
  "claude-sonnet-5": { input: 2 / 1_000_000, output: 10 / 1_000_000 },
  "claude-haiku-4-5-20251001": { input: 1 / 1_000_000, output: 5 / 1_000_000 },
};
const DEFAULT_MODEL_PRICING = MODEL_PRICING_PER_TOKEN_USD["claude-sonnet-5"];
// Le cache de prompt (system + outils, identiques à chaque appel) a son
// propre tarif : l'écriture initiale coûte plus cher que l'input normal,
// chaque lecture ensuite coûte beaucoup moins — voir docs Anthropic "prompt caching".
const CACHE_WRITE_MULTIPLIER = 1.25;
const CACHE_READ_MULTIPLIER = 0.1;

export function callCostUsd(
  usage:
    | {
        input_tokens?: number;
        output_tokens?: number;
        cache_creation_input_tokens?: number | null;
        cache_read_input_tokens?: number | null;
      }
    | null
    | undefined,
  model?: string
): number {
  if (!usage) return 0;
  const pricing = (model && MODEL_PRICING_PER_TOKEN_USD[model]) || DEFAULT_MODEL_PRICING;
  const input = Number(usage.input_tokens || 0);
  const output = Number(usage.output_tokens || 0);
  const cacheWrite = Number(usage.cache_creation_input_tokens || 0);
  const cacheRead = Number(usage.cache_read_input_tokens || 0);
  return (
    input * pricing.input +
    output * pricing.output +
    cacheWrite * pricing.input * CACHE_WRITE_MULTIPLIER +
    cacheRead * pricing.input * CACHE_READ_MULTIPLIER
  );
}

export function usdToMicros(usd: number): number {
  return Math.round(usd * 1_000_000);
}

export function microsToUsd(micros: number): number {
  return micros / 1_000_000;
}

// Prix d'abonnement approximatifs en USD (taux EUR/USD ~1,08), pour calculer
// le budget IA sans dépendre d'un taux de change en temps réel — à ajuster
// si les prix EUR changent.
const SUBSCRIPTION_PRICE_USD: Record<Plan, number> = {
  calc_blur: 0,
  calc_full: 0,
  landlord_5: 7.45,
  landlord_15: 12.85,
  landlord_unlimited: 31.3,
  agence: 31.3,
};

// Part du prix de l'abonnement qu'on accepte de dépenser en coût API Claude
// pour Loky — le reste couvre hébergement, Stripe, support, marge. Le but
// explicite : le coût IA ne doit jamais manger l'abonnement.
const ASSISTANT_COST_SHARE = 0.15;

export function landlordAssistantMonthlyBudgetUsd(plan: Plan): number {
  return SUBSCRIPTION_PRICE_USD[plan] * ASSISTANT_COST_SHARE;
}
