import type { NextApiRequest, NextApiResponse } from "next";
import { getStripePriceId, type BillingInterval } from "../../../lib/billingPlans";
import { requireApiUser } from "../../../lib/apiAuth";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

async function stripeGet(path: string, secretKey: string) {
  const resp = await fetch(`https://api.stripe.com/v1/${path.replace(/^\//, "")}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data?.error?.message || `Erreur Stripe ${resp.status}`);
  return data;
}

function getBaseUrl(req: NextApiRequest) {
  const configured = process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/$/, "");

  const proto = String(req.headers["x-forwarded-proto"] || "http").split(",")[0];
  const host = req.headers.host || "localhost:3000";
  return `${proto}://${host}`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Méthode non autorisée." });
  }

  const auth = await requireApiUser(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return res.status(500).json({ error: "STRIPE_SECRET_KEY manquant." });

  const billing = String(req.body?.billing || "monthly") === "yearly" ? "yearly" : "monthly";
  const price = getStripePriceId(String(req.body?.plan || ""), billing as BillingInterval);
  if (!price?.plan) return res.status(400).json({ error: "Offre inconnue." });

  if (!price.priceId) return res.status(500).json({ error: `${price.envKey} manquant.` });

  // Changement de plan avec un abonnement Stripe déjà actif : on modifie CET
  // abonnement (avec proration) plutôt que de créer un second Checkout Session
  // indépendant — sinon le client paie les deux plans en plein tarif sans
  // aucune déduction (incident réel du 2026-11-13, cf. issue #2).
  if (supabaseAdmin) {
    const { data: existing } = await supabaseAdmin
      .from("subscriptions")
      .select("plan, status, stripe_subscription_id")
      .eq("user_id", auth.userId)
      .eq("status", "active")
      .not("stripe_subscription_id", "is", null)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing?.stripe_subscription_id) {
      if (existing.plan === price.plan.id) {
        return res.status(400).json({ error: "Vous êtes déjà sur cette offre." });
      }

      try {
        const subscription = await stripeGet(`/subscriptions/${existing.stripe_subscription_id}`, secretKey);
        const itemId = subscription?.items?.data?.[0]?.id;
        if (!itemId) return res.status(500).json({ error: "Ligne d'abonnement Stripe introuvable." });

        const updateParams = new URLSearchParams();
        updateParams.set("items[0][id]", itemId);
        updateParams.set("items[0][price]", price.priceId);
        updateParams.set("proration_behavior", "always_invoice");
        updateParams.set("metadata[user_id]", auth.userId);
        updateParams.set("metadata[plan]", price.plan.id);
        updateParams.set("metadata[billing]", price.billing);

        const updateRes = await fetch(`https://api.stripe.com/v1/subscriptions/${existing.stripe_subscription_id}`, {
          method: "POST",
          headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/x-www-form-urlencoded" },
          body: updateParams.toString(),
        });
        const updated = await updateRes.json();
        if (!updateRes.ok) {
          return res.status(updateRes.status).json({ error: updated?.error?.message || "Mise à jour de l'abonnement impossible." });
        }

        return res.status(200).json({ updated: true });
      } catch (e: any) {
        return res.status(500).json({ error: e?.message || "Mise à jour de l'abonnement impossible." });
      }
    }
  }

  const baseUrl = getBaseUrl(req);
  const params = new URLSearchParams();
  params.set("mode", "subscription");
  params.set("client_reference_id", auth.userId);
  params.set("line_items[0][price]", price.priceId);
  params.set("line_items[0][quantity]", "1");
  params.set("success_url", `${baseUrl}/espace-bailleur?checkout=success`);
  params.set("cancel_url", `${baseUrl}/mon-compte/abonnement?checkout=cancel`);
  params.set("metadata[user_id]", auth.userId);
  params.set("metadata[plan]", price.plan.id);
  params.set("metadata[billing]", price.billing);
  params.set("subscription_data[metadata][user_id]", auth.userId);
  params.set("subscription_data[metadata][plan]", price.plan.id);
  params.set("subscription_data[metadata][billing]", price.billing);
  params.set("allow_promotion_codes", "true");
  if (auth.email) params.set("customer_email", auth.email);

  const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  const data = await stripeRes.json();
  if (!stripeRes.ok) {
    return res.status(stripeRes.status).json({ error: data?.error?.message || "Création de session Stripe impossible." });
  }

  return res.status(200).json({ url: data.url });
}
