// pages/api/account/delete.ts
//
// Suppression complète du compte utilisateur (RGPD art. 17 — droit à l'effacement).
// Ordre des opérations :
//   1. Résiliation immédiate de l'abonnement Stripe actif (si existant)
//   2. Mise à jour du statut subscription en base → "canceled"
//   3. Anonymisation des leads liés (conserve les stats métier, efface les PII)
//   4. Suppression du profil
//   5. Suppression de l'utilisateur auth Supabase
//   6. Envoi d'un email de confirmation (best-effort, n'affecte pas le résultat de la suppression)
// Les lignes de facturation (subscriptions) sont conservées (obligation légale 10 ans).
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { requireApiUser } from "../../../lib/apiAuth";
import { sendEmailViaResend } from "../../../lib/mailer/resend";
import { buildCompteSupprimeEmailHtml, buildCompteSupprimeEmailText } from "../../../lib/emails/compte-supprime";

function budgetBucket(amount: number | null): string | null {
  if (!amount || amount <= 0) return null;
  if (amount < 150_000) return "<150k";
  if (amount < 250_000) return "150-250k";
  if (amount < 400_000) return "250-400k";
  if (amount < 600_000) return "400-600k";
  return ">600k";
}

async function cancelStripeSubscription(subscriptionId: string): Promise<{ ok: boolean; error?: string }> {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return { ok: false, error: "STRIPE_SECRET_KEY manquant" };

  const res = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    const msg = data?.error?.message || `Stripe ${res.status}`;
    return { ok: false, error: msg };
  }

  return { ok: true };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "DELETE" && req.method !== "POST") {
    res.setHeader("Allow", "DELETE, POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  if (!supabaseAdmin) {
    return res.status(500).json({ ok: false, error: "Supabase admin non configuré." });
  }

  const auth = await requireApiUser(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ ok: false, error: auth.error });
  }

  const userId = auth.userId;
  const now = new Date().toISOString();
  const recipientEmail = auth.email || null;

  // Capturé avant suppression du profil (étape 4) pour personnaliser l'email de confirmation.
  const { data: profileForEmail } = await supabaseAdmin
    .from("profiles")
    .select("full_name, first_name")
    .eq("id", userId)
    .maybeSingle();
  const recipientName = (profileForEmail as any)?.full_name || (profileForEmail as any)?.first_name || "";

  // 1. Chercher un abonnement Stripe actif
  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("stripe_subscription_id, status")
    .eq("user_id", userId)
    .not("stripe_subscription_id", "is", null)
    .in("status", ["active", "trialing"])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const stripeSubId = (sub as any)?.stripe_subscription_id as string | null;

  // 2. Résilier l'abonnement Stripe immédiatement
  if (stripeSubId) {
    const cancelResult = await cancelStripeSubscription(stripeSubId);
    if (!cancelResult.ok) {
      console.error("[account/delete] Stripe cancel error:", cancelResult.error);
      return res.status(500).json({
        ok: false,
        error: `Impossible de résilier l'abonnement Stripe : ${cancelResult.error}`,
      });
    }

    // Mettre à jour le statut en base (le webhook Stripe le fera aussi,
    // mais on anticipe pour que la suppression du compte reste cohérente)
    await supabaseAdmin
      .from("subscriptions")
      .update({ status: "canceled", updated_at: now })
      .eq("user_id", userId)
      .eq("stripe_subscription_id", stripeSubId);

    console.log(`[account/delete] abonnement Stripe résilié : ${stripeSubId}`);
  }

  // 3. Anonymiser les leads liés (même logique que le cron anonymize-leads)
  const { data: leads } = await supabaseAdmin
    .from("leads")
    .select("id, project_budget_target")
    .eq("user_id", userId)
    .is("anonymized_at", null);

  if (leads && leads.length > 0) {
    // Grouper par tranche de budget pour minimiser les requêtes
    const byBucket = new Map<string, string[]>();
    for (const lead of leads as any[]) {
      const bucket = budgetBucket(lead.project_budget_target ?? null) ?? "__null__";
      if (!byBucket.has(bucket)) byBucket.set(bucket, []);
      byBucket.get(bucket)!.push(lead.id);
    }

    for (const [bucketKey, ids] of byBucket) {
      await supabaseAdmin
        .from("leads")
        .update({
          email: null,
          phone: null,
          payload: null,
          user_id: null,
          city: null,
          source: null,
          utm: null,
          lead_age: null,
          project_budget_target: null,
          budget_bucket: bucketKey === "__null__" ? null : bucketKey,
          anonymized_at: now,
          // project_usage, project_property_kind, project_timeline conservés
        })
        .in("id", ids);
    }
  }

  // 4. Supprimer le profil
  await supabaseAdmin.from("profiles").delete().eq("id", userId);

  // 5. Supprimer l'utilisateur auth Supabase
  const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (deleteError) {
    console.error("[account/delete] deleteUser error:", deleteError);
    return res.status(500).json({ ok: false, error: "Erreur lors de la suppression du compte." });
  }

  console.log(`[account/delete] compte supprimé userId=${userId} (stripe: ${stripeSubId ?? "aucun"})`);

  // 6. Email de confirmation — best-effort : le compte est déjà supprimé, un échec d'envoi
  // ne doit pas faire échouer la requête (rien à annuler côté suppression).
  if (recipientEmail) {
    const payload = { fullName: recipientName, stripeCanceled: !!stripeSubId };
    const mail = await sendEmailViaResend({
      to: recipientEmail,
      subject: "Votre compte lokt.fr a été supprimé",
      html: buildCompteSupprimeEmailHtml(payload),
      text: buildCompteSupprimeEmailText(payload),
    });
    if (!mail.ok) {
      console.error("[account/delete] email confirmation error:", mail.error);
    }
  }

  return res.status(200).json({ ok: true, stripe_canceled: !!stripeSubId });
}
