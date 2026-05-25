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
    .limit(10);

  if (error || !Array.isArray(data)) return DEFAULT_LOGGED_IN_PLAN;

  const active = data.find((row: any) => isSubscriptionActive(row?.status) && isStillValid(row?.ends_at));
  return isPlan(active?.plan) ? active.plan : DEFAULT_LOGGED_IN_PLAN;
}

export async function userCanUseReceiptAutomation(userId: string): Promise<boolean> {
  const plan = await getServerUserPlan(userId);
  return planAllowsReceiptAutomation(plan);
}
