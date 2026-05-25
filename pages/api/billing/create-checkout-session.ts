import type { NextApiRequest, NextApiResponse } from "next";
import { getStripePriceId, type BillingInterval } from "../../../lib/billingPlans";
import { requireApiUser } from "../../../lib/apiAuth";

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

  const baseUrl = getBaseUrl(req);
  const params = new URLSearchParams();
  params.set("mode", "subscription");
  params.set("client_reference_id", auth.userId);
  params.set("line_items[0][price]", price.priceId);
  params.set("line_items[0][quantity]", "1");
  params.set("success_url", `${baseUrl}/mon-compte/abonnement?checkout=success`);
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
