// Envoie la prospection "widget gratuit" (/widget — simulateurs intégrables
// avec mention "Propulsé par lokt.fr") aux prospects en attente dans
// widget_prospects. Deux angles de pitch selon segment : agence (lead-gen)
// ou blog (contenu gratuit pour leurs lecteurs). Jamais depuis contact@lokt.fr
// (adresse transactionnelle, cf. scripts/prospect-agences-immo.mjs) — adresse
// dédiée via PROSPECT_FROM_EMAIL, comme la campagne "espace agences".
//
// Mode preview tant que WIDGET_PROSPECT_LIVE n'est pas "true" : les emails
// générés sont envoyés à l'adresse du propriétaire du site (relecture d'un
// échantillon réel) au lieu des vrais prospects, et aucun statut n'est mis à
// jour en base — permet de valider le contenu avant le premier envoi réel.
import type { NextApiRequest, NextApiResponse } from "next";
import { hasValidCronSecret } from "../../../lib/cronAuth";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { sendEmailViaResend } from "../../../lib/mailer/resend";

const BATCH_LIMIT = 15;
const FROM = process.env.PROSPECT_FROM_EMAIL || "Matthieu (lokt.fr) <matthieu@lokt.fr>";
const PREVIEW_RECIPIENT = "matthieu.turbier@gmail.com";
const WIDGET_URL = "https://lokt.fr/widget?utm_source=email_prospection&utm_medium=email&utm_campaign=widget_backlink";

type Prospect = { id: string; name: string; email: string; segment: "agence" | "blog" };

function emailHtml(p: Prospect) {
  const greeting = p.name ? `Bonjour,<br/><br/>(à l'attention de ${p.name})` : "Bonjour,";
  const pitch =
    p.segment === "agence"
      ? `
      <p>Nous avons développé 3 simulateurs immobiliers (capacité d'emprunt, prêt relais, rentabilité locative) que les agences intègrent gratuitement sur leur site — un visiteur qui connaît déjà son budget avant de vous contacter est un prospect plus qualifié.</p>
      <p>Zéro développement de votre côté : un bloc de code HTML à copier-coller, aucun compte technique requis.</p>`
      : `
      <p>Nous avons développé 3 simulateurs immobiliers gratuits (capacité d'emprunt, prêt relais, rentabilité locative) intégrables en quelques minutes sur un blog — un outil interactif pour vos lecteurs, sans aucune maintenance de votre côté.</p>
      <p>Un bloc de code HTML à copier-coller, qui s'adapte à la largeur de votre page.</p>`;
  return `
    <div style="font-family: Arial, sans-serif; font-size: 15px; line-height: 1.6; color: #1e293b;">
      <p>${greeting}</p>
      <p>Je m'appelle Matthieu, de l'équipe <strong>lokt.fr</strong>, un outil de gestion locative.</p>
      ${pitch}
      <p><a href="${WIDGET_URL}" style="display:inline-block;background:#635bff;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:600;">Voir les simulateurs et le code à intégrer</a></p>
      <p>Si ce n'est pas pour vous, répondez-moi simplement "non merci".</p>
      <p>Matthieu — lokt.fr</p>
    </div>
  `.trim();
}

function emailText(p: Prospect) {
  const greeting = p.name ? `Bonjour (à l'attention de ${p.name}),` : "Bonjour,";
  const pitch =
    p.segment === "agence"
      ? `Nous avons développé 3 simulateurs immobiliers (capacité d'emprunt, prêt relais, rentabilité locative) que les agences intègrent gratuitement sur leur site — un visiteur qui connaît déjà son budget avant de vous contacter est un prospect plus qualifié.

Zéro développement de votre côté : un bloc de code HTML à copier-coller, aucun compte technique requis.`
      : `Nous avons développé 3 simulateurs immobiliers gratuits (capacité d'emprunt, prêt relais, rentabilité locative) intégrables en quelques minutes sur un blog — un outil interactif pour vos lecteurs, sans aucune maintenance de votre côté.

Un bloc de code HTML à copier-coller, qui s'adapte à la largeur de votre page.`;
  return `${greeting}

Je m'appelle Matthieu, de l'équipe lokt.fr, un outil de gestion locative.

${pitch}

${WIDGET_URL}

Si ce n'est pas pour vous, répondez-moi simplement "non merci".

Matthieu — lokt.fr`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!hasValidCronSecret(req)) return res.status(401).json({ error: "Unauthorized" });
  if (!supabaseAdmin) return res.status(500).json({ error: "Supabase admin non configuré." });

  const live = process.env.WIDGET_PROSPECT_LIVE === "true";

  const { data: pending, error } = await supabaseAdmin
    .from("widget_prospects")
    .select("id, name, email, segment")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(BATCH_LIMIT);
  if (error) return res.status(500).json({ error: error.message });

  let sent = 0;
  let failed = 0;
  const failures: Array<{ id: string; error: any }> = [];

  for (const prospect of (pending || []) as Prospect[]) {
    const result = await sendEmailViaResend({
      from: FROM,
      to: live ? prospect.email : PREVIEW_RECIPIENT,
      subject: "Un simulateur gratuit pour votre site",
      html: emailHtml(prospect),
      text: emailText(prospect),
      replyTo: "matthieu@lokt.fr",
    });

    if (!result.ok) {
      failed++;
      failures.push({ id: prospect.id, error: result.error });
      continue;
    }

    sent++;
    if (live) {
      await supabaseAdmin.from("widget_prospects").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", prospect.id);
    }
  }

  return res.status(200).json({
    mode: live ? "live" : "preview",
    candidates: (pending || []).length,
    sent,
    failed,
    failures: failures.length ? failures : undefined,
  });
}
