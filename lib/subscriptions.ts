// lib/subscriptions.ts
import { supabase } from "./supabaseClient";
import {
  DEFAULT_LOGGED_IN_PLAN,
  DEFAULT_LOGGED_OUT_PLAN,
  isSubscriptionActive,
  Plan,
} from "./permissions";

type SubscriptionRow = {
  user_id: string;
  plan: string;
  status: string;
  ends_at: string | null;
};

function normalizePlan(plan: string | null | undefined): Plan | null {
  const p = String(plan ?? "").trim().toLowerCase();
  const allowed: Plan[] = ["calc_blur", "calc_full", "landlord_5", "landlord_15", "landlord_unlimited"];
  return allowed.includes(p as Plan) ? (p as Plan) : null;
}

export async function fetchEffectivePlan(): Promise<Plan> {
  // 1) session ?
  const { data: sData } = await supabase.auth.getSession();
  const user = sData.session?.user;

  if (!user?.id) return DEFAULT_LOGGED_OUT_PLAN;

  // 2) essaie subscriptions
  try {
    const { data, error } = await supabase
      .from("subscriptions")
      .select("plan,status,ends_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    const row = data as SubscriptionRow | null;
    if (!row) return DEFAULT_LOGGED_IN_PLAN;

    // si ends_at dans le passé -> pas actif
    const endsAt = row.ends_at ? new Date(row.ends_at).getTime() : null;
    const now = Date.now();
    const notExpired = endsAt == null || endsAt > now;

    if (isSubscriptionActive(row.status) && notExpired) {
      const normalized = normalizePlan(row.plan);
      return normalized ?? DEFAULT_LOGGED_IN_PLAN;
    }

    return DEFAULT_LOGGED_IN_PLAN;
  } catch {
    // Si table pas accessible / pas de droits / autre -> fallback
    return DEFAULT_LOGGED_IN_PLAN;
  }
}
