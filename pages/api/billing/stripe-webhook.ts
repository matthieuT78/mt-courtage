import crypto from "crypto";
import type { NextApiRequest, NextApiResponse } from "next";
import { getPlanFromStripePrice } from "../../../lib/billingPlans";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export const config = {
  api: {
    bodyParser: false,
  },
};

async function readRawBody(req: NextApiRequest) {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function verifyStripeSignature(rawBody: Buffer, signature: string, secret: string) {
  const parts = Object.fromEntries(
    signature.split(",").map((part) => {
      const [key, value] = part.split("=");
      return [key, value];
    })
  );
  const timestamp = parts.t;
  const v1 = parts.v1;
  if (!timestamp || !v1) return false;

  const signedPayload = `${timestamp}.${rawBody.toString("utf8")}`;
  const expected = crypto.createHmac("sha256", secret).update(signedPayload).digest("hex");
  const left = Buffer.from(expected);
  const right = Buffer.from(v1);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

async function saveSubscription(params: {
  userId: string | null;
  plan: string | null;
  status: string | null;
  billing?: string | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  stripePriceId?: string | null;
  cancelAtPeriodEnd?: boolean | null;
  currentPeriodEnd?: number | null;
}) {
  if (!supabaseAdmin) throw new Error("Supabase admin non configuré.");
  if (!params.userId) throw new Error("user_id manquant dans les métadonnées Stripe.");
  if (!params.plan) throw new Error("plan manquant dans les métadonnées Stripe.");

  const endsAt = params.currentPeriodEnd ? new Date(params.currentPeriodEnd * 1000).toISOString() : null;

  const { error } = await supabaseAdmin.from("subscriptions").insert({
    user_id: params.userId,
    plan: params.plan,
    status: params.status || "active",
    ends_at: endsAt,
    billing_interval: params.billing || null,
    stripe_customer_id: params.stripeCustomerId || null,
    stripe_subscription_id: params.stripeSubscriptionId || null,
    stripe_price_id: params.stripePriceId || null,
    cancel_at_period_end: params.cancelAtPeriodEnd ?? false,
    updated_at: new Date().toISOString(),
  });

  if (error) throw error;
}

async function stripeGet(path: string) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error("STRIPE_SECRET_KEY manquant.");

  const resp = await fetch(`https://api.stripe.com/v1/${path.replace(/^\//, "")}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data?.error?.message || `Erreur Stripe ${resp.status}`);
  return data;
}

function firstSubscriptionItem(subscription: any) {
  return subscription?.items?.data?.[0] || null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Méthode non autorisée." });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) return res.status(500).json({ error: "STRIPE_WEBHOOK_SECRET manquant." });

  const rawBody = await readRawBody(req);
  const signature = String(req.headers["stripe-signature"] || "");
  if (!verifyStripeSignature(rawBody, signature, webhookSecret)) {
    return res.status(400).json({ error: "Signature Stripe invalide." });
  }

  const event = JSON.parse(rawBody.toString("utf8"));
  const object = event?.data?.object || {};

  try {
    if (event.type === "checkout.session.completed") {
      const subscriptionId = typeof object?.subscription === "string" ? object.subscription : object?.subscription?.id || null;
      const subscription = subscriptionId ? await stripeGet(`/subscriptions/${subscriptionId}`) : null;
      const item = firstSubscriptionItem(subscription);
      const priceId = item?.price?.id || null;

      await saveSubscription({
        userId: object?.metadata?.user_id || object?.client_reference_id || null,
        plan: object?.metadata?.plan || getPlanFromStripePrice(priceId),
        status: subscription?.status || (object?.payment_status === "paid" ? "active" : object?.status || "active"),
        billing: object?.metadata?.billing || item?.price?.recurring?.interval || null,
        stripeCustomerId: typeof object?.customer === "string" ? object.customer : object?.customer?.id || null,
        stripeSubscriptionId: subscriptionId,
        stripePriceId: priceId,
        cancelAtPeriodEnd: !!subscription?.cancel_at_period_end,
        currentPeriodEnd: subscription?.current_period_end || null,
      });
    }

    if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      const item = firstSubscriptionItem(object);
      const priceId = item?.price?.id || null;
      const plan = object?.metadata?.plan || getPlanFromStripePrice(priceId);
      await saveSubscription({
        userId: object?.metadata?.user_id || null,
        plan,
        status: event.type === "customer.subscription.deleted" ? "canceled" : object?.status || "active",
        billing: object?.metadata?.billing || item?.price?.recurring?.interval || null,
        stripeCustomerId: typeof object?.customer === "string" ? object.customer : object?.customer?.id || null,
        stripeSubscriptionId: object?.id || null,
        stripePriceId: priceId,
        cancelAtPeriodEnd: !!object?.cancel_at_period_end,
        currentPeriodEnd: object?.current_period_end || null,
      });
    }

    return res.status(200).json({ received: true });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Traitement webhook impossible." });
  }
}
