// Aperçu (lecture seule, jamais facturé) du montant exact à payer pour un
// changement de plan — utilisé pour afficher une pop-up de confirmation
// avant de déclencher le vrai changement via create-checkout-session.ts.
// Demandé suite à l'incident du 2026-11-13 (cf. issue #2) : un changement
// de plan débitait la carte enregistrée sans aucune confirmation visible.
import type { NextApiRequest, NextApiResponse } from "next";
import { getStripePriceId, getBillingPlan, type BillingInterval } from "../../../lib/billingPlans";
import { requireApiUser } from "../../../lib/apiAuth";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

async function stripePost(path: string, body: Record<string, string>, secretKey: string) {
  const resp = await fetch(`https://api.stripe.com/v1/${path.replace(/^\//, "")}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data?.error?.message || `Erreur Stripe ${resp.status}`);
  return data;
}

async function stripeGet(path: string, secretKey: string) {
  const resp = await fetch(`https://api.stripe.com/v1/${path.replace(/^\//, "")}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data?.error?.message || `Erreur Stripe ${resp.status}`);
  return data;
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
  if (!supabaseAdmin) return res.status(500).json({ error: "Supabase admin non configuré." });

  const billing = String(req.body?.billing || "monthly") === "yearly" ? "yearly" : "monthly";
  const price = getStripePriceId(String(req.body?.plan || ""), billing as BillingInterval);
  if (!price?.plan) return res.status(400).json({ error: "Offre inconnue." });
  if (!price.priceId) return res.status(500).json({ error: `${price.envKey} manquant.` });

  const { data: existing } = await supabaseAdmin
    .from("subscriptions")
    .select("plan, status, stripe_subscription_id, stripe_customer_id, stripe_price_id")
    .eq("user_id", auth.userId)
    .eq("status", "active")
    .not("stripe_subscription_id", "is", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Pas d'abonnement actif à modifier : la première souscription passe par
  // le Checkout Stripe classique, qui a déjà sa propre page de confirmation.
  if (!existing?.stripe_subscription_id) {
    return res.status(200).json({ isPlanChange: false });
  }

  // Comparer sur le price_id exact (pas juste le palier plan.id) : sinon un
  // abonné déjà sur ce palier ne peut jamais basculer mensuel <-> annuel, qui
  // partage le même plan.id mais un price_id Stripe différent — même fix que
  // create-checkout-session.ts.
  if (existing.stripe_price_id === price.priceId) {
    return res.status(400).json({ error: "Vous êtes déjà sur cette offre." });
  }

  try {
    const subscription = await stripeGet(`/subscriptions/${existing.stripe_subscription_id}`, secretKey);
    const itemId = subscription?.items?.data?.[0]?.id;
    if (!itemId) return res.status(500).json({ error: "Ligne d'abonnement Stripe introuvable." });

    const preview = await stripePost(
      "/invoices/create_preview",
      {
        customer: existing.stripe_customer_id || "",
        subscription: existing.stripe_subscription_id,
        "subscription_details[items][0][id]": itemId,
        "subscription_details[items][0][price]": price.priceId,
        "subscription_details[proration_behavior]": "always_invoice",
      },
      secretKey
    );

    const currentPlan = getBillingPlan(existing.plan);
    // price.plan.priceLabel est toujours le libellé mensuel statique
    // ("11,90 € / mois") — faux pour un passage à l'annuel, notamment pour
    // un changement de périodicité sans changement de palier (même plan.id).
    const newPlanPriceLabel =
      billing === "yearly" && price.plan.yearlyPrice != null
        ? `${price.plan.yearlyPrice.toLocaleString("fr-FR")} € / an`
        : price.plan.priceLabel;

    return res.status(200).json({
      isPlanChange: true,
      amountDueCents: typeof preview?.amount_due === "number" ? preview.amount_due : null,
      currency: preview?.currency || "eur",
      currentPlanName: currentPlan?.name || existing.plan,
      newPlanName: price.plan.name,
      newPlanMonthlyPrice: newPlanPriceLabel,
    });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "Aperçu du changement de plan impossible." });
  }
}
