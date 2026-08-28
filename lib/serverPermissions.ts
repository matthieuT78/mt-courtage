import { DEFAULT_LOGGED_IN_PLAN, isSubscriptionActive, planAllowsReceiptAutomation, type Plan } from "./permissions";
import { supabaseAdmin } from "./supabaseAdmin";

function isPlan(v: unknown): v is Plan {
  return (
    v === "calc_blur" ||
    v === "calc_full" ||
    v === "landlord_5" ||
    v === "landlord_15" ||
    v === "landlord_unlimited"
  );
}

function isStillValid(endsAt?: string | null) {
  if (!endsAt) return true;
  const d = new Date(endsAt);
  if (Number.isNaN(d.getTime())) return true;
  return d.getTime() >= Date.now();
}

export async function getServerUserPlan(userId: string): Promise<Plan> {
  if (!supabaseAdmin || !userId) return DEFAULT_LOGGED_IN_PLAN;

  const { data, error } = await supabaseAdmin
    .from("subscriptions")
    .select("plan,status,ends_at,updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1);

  if (error || !Array.isArray(data)) return DEFAULT_LOGGED_IN_PLAN;

  const latest = data[0] as any;
  if (isSubscriptionActive(latest?.status) && isStillValid(latest?.ends_at) && isPlan(latest?.plan)) {
    return latest.plan;
  }

  return DEFAULT_LOGGED_IN_PLAN;
}

export async function userCanUseReceiptAutomation(userId: string): Promise<boolean> {
  const plan = await getServerUserPlan(userId);
  return planAllowsReceiptAutomation(plan);
}

// Un plan peut être accordé manuellement (compte de test, geste commercial)
// sans abonnement Stripe réel derrière. Pour tout ce qui touche à un coût
// API externe direct (Loky), on ne veut accorder le quota du plan qu'aux
// abonnements réellement payants — le reste du produit continue de suivre
// le plan accordé normalement, seul le quota de messages IA est concerné.
export async function hasStripeLinkedSubscription(userId: string): Promise<boolean> {
  if (!supabaseAdmin || !userId) return false;

  const { data, error } = await supabaseAdmin
    .from("subscriptions")
    .select("stripe_subscription_id,status,ends_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1);

  if (error || !Array.isArray(data) || !data[0]) return false;

  const latest = data[0] as any;
  return isSubscriptionActive(latest?.status) && isStillValid(latest?.ends_at) && !!latest?.stripe_subscription_id;
}
