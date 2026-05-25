import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../../lib/apiAuth";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

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
  if (!supabaseAdmin) return res.status(500).json({ error: "Supabase admin non configuré." });

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return res.status(500).json({ error: "STRIPE_SECRET_KEY manquant." });

  const { data, error } = await supabaseAdmin
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", auth.userId)
    .not("stripe_customer_id", "is", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  const customerId = String((data as any)?.stripe_customer_id || "");
  if (!customerId) return res.status(404).json({ error: "Aucun client Stripe trouvé pour ce compte." });

  const baseUrl = getBaseUrl(req);
  const params = new URLSearchParams();
  params.set("customer", customerId);
  params.set("return_url", `${baseUrl}/mon-compte/abonnement`);

  const stripeRes = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  const payload = await stripeRes.json();
  if (!stripeRes.ok) {
    return res.status(stripeRes.status).json({ error: payload?.error?.message || "Portail Stripe indisponible." });
  }

  return res.status(200).json({ url: payload.url });
}
