import type { NextApiRequest, NextApiResponse } from "next";
import { DEFAULT_LOGGED_IN_PLAN, isSubscriptionActive, type Plan } from "../../../lib/permissions";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";

const PLANS: Plan[] = ["calc_blur", "calc_full", "landlord_5", "landlord_15", "landlord_unlimited"];

function isPlan(value: unknown): value is Plan {
  return PLANS.includes(String(value) as Plan);
}

function isStillValid(endsAt?: string | null) {
  if (!endsAt) return true;
  const time = new Date(endsAt).getTime();
  return Number.isNaN(time) || time > Date.now();
}

function requireAdmin(req: NextApiRequest, res: NextApiResponse) {
  const token = (req.headers["x-admin-token"] as string) || (req.query.token as string) || "";
  if (!ADMIN_TOKEN || token !== ADMIN_TOKEN) {
    res.status(401).json({ ok: false, error: "Unauthorized" });
    return false;
  }
  return true;
}

function effectivePlan(subscription: any): Plan {
  if (
    subscription &&
    isSubscriptionActive(subscription.status) &&
    isStillValid(subscription.ends_at) &&
    isPlan(subscription.plan)
  ) {
    return subscription.plan;
  }
  return DEFAULT_LOGGED_IN_PLAN;
}

async function listAuthUsers() {
  if (!supabaseAdmin) return [];
  const users: any[] = [];
  let page = 1;
  const perPage = 1000;

  while (page < 100) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const batch = data.users || [];
    users.push(...batch);
    if (batch.length < perPage) break;
    page += 1;
  }

  return users;
}

async function handleGet(res: NextApiResponse) {
  if (!supabaseAdmin) return res.status(500).json({ ok: false, error: "Supabase admin non configuré." });

  const [authUsers, profilesRes, subscriptionsRes] = await Promise.all([
    listAuthUsers(),
    supabaseAdmin
      .from("profiles")
      .select("id,email,full_name,is_admin,created_at,account_tier,subscription_plan"),
    supabaseAdmin
      .from("subscriptions")
      .select(
        "user_id,plan,status,ends_at,billing_interval,updated_at,stripe_customer_id,stripe_subscription_id,cancel_at_period_end"
      )
      .order("updated_at", { ascending: false }),
  ]);

  if (profilesRes.error) throw profilesRes.error;
  if (subscriptionsRes.error) throw subscriptionsRes.error;

  const profilesById = new Map((profilesRes.data || []).map((profile: any) => [profile.id, profile]));
  const latestSubscriptionByUserId = new Map<string, any>();
  for (const row of subscriptionsRes.data || []) {
    const userId = String((row as any).user_id || "");
    if (userId && !latestSubscriptionByUserId.has(userId)) latestSubscriptionByUserId.set(userId, row);
  }

  const rows = authUsers
    .map((authUser: any) => {
      const profile = profilesById.get(authUser.id) || {};
      const subscription = latestSubscriptionByUserId.get(authUser.id) || null;
      return {
        id: authUser.id,
        email: authUser.email || profile.email || "",
        full_name: profile.full_name || authUser.user_metadata?.full_name || null,
        is_admin: !!profile.is_admin,
        created_at: profile.created_at || authUser.created_at || null,
        last_sign_in_at: authUser.last_sign_in_at || null,
        account_tier: profile.account_tier || null,
        subscription_plan: profile.subscription_plan || null,
        effective_plan: effectivePlan(subscription),
        subscription,
      };
    })
    .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

  return res.status(200).json({ ok: true, users: rows });
}

async function handlePatch(req: NextApiRequest, res: NextApiResponse) {
  if (!supabaseAdmin) return res.status(500).json({ ok: false, error: "Supabase admin non configuré." });

  const userId = String(req.body?.userId || "").trim();
  const plan = String(req.body?.plan || "").trim();
  const status = String(req.body?.status || "active").trim().toLowerCase();

  if (!userId) return res.status(400).json({ ok: false, error: "userId manquant." });
  if (!isPlan(plan)) return res.status(400).json({ ok: false, error: "Plan invalide." });
  if (!["active", "trialing", "inactive", "canceled", "past_due"].includes(status)) {
    return res.status(400).json({ ok: false, error: "Statut invalide." });
  }

  const now = new Date().toISOString();
  const { error: subscriptionError } = await supabaseAdmin.from("subscriptions").upsert(
    {
      user_id: userId,
      plan,
      status,
      ends_at: null,
      billing_interval: "manual",
      updated_at: now,
    },
    { onConflict: "user_id" }
  );
  if (subscriptionError) throw subscriptionError;

  const { error: profileError } = await supabaseAdmin
    .from("profiles")
    .update({
      subscription_plan: plan,
      updated_at: now,
    })
    .eq("id", userId);
  if (profileError) throw profileError;

  return res.status(200).json({
    ok: true,
    userId,
    plan,
    status,
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (!requireAdmin(req, res)) return;

    if (req.method === "GET") return await handleGet(res);
    if (req.method === "PATCH") return await handlePatch(req, res);

    res.setHeader("Allow", "GET, PATCH");
    return res.status(405).json({ ok: false, error: "Méthode non autorisée." });
  } catch (error: any) {
    console.error("[api/admin/users]", error);
    return res.status(500).json({ ok: false, error: error?.message || "Erreur serveur." });
  }
}
