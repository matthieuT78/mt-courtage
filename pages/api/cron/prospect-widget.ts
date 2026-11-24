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
  const pitch =
    p.segment === "agence"
      ? `
      <p>Un visiteur qui a déjà simulé sa capacité d'emprunt ou la rentabilité de son projet a filtré lui-même sa demande : il arrive avec un budget réel et un projet défini, pas une simple curiosité. Moins de temps passé à qualifier des dossiers flous, plus de temps sur les projets sérieux.</p>
      <p>Nous avons développé 3 simulateurs (capacité d'emprunt, prêt relais, rentabilité locative) que vous pouvez tester et intégrer en 2 minutes : un bloc de code à coller sur votre site, hébergé et maintenu par nous, gratuit, sans compte technique.</p>`
      : `
      <p>Un lecteur qui peut simuler sa capacité d'emprunt ou sa rentabilité locative directement sur votre article reste sur votre page, au lieu d'aller chercher l'info ailleurs.</p>
      <p>Nous avons développé 3 simulateurs immobiliers gratuits, intégrables en quelques minutes : un bloc de code à copier-coller, aucune maintenance de votre côté.</p>`;
  return `
    <div style="font-family: Arial, sans-serif; font-size: 15px; line-height: 1.6; color: #1e293b;">
      <p>Bonjour,<br/><br/>Nous sommes lokt.fr, un outil de gestion locative et des simulateurs immobiliers gratuits.</p>
      ${pitch}
      <p><a href="${WIDGET_URL}" style="display:inline-block;background:#635bff;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:600;">Essayer le simulateur avant de décider</a></p>
      <p>Si ce n'est pas pour vous, répondez-moi simplement "non merci".</p>
      <p>Matthieu — lokt.fr</p>
    </div>
  `.trim();
}

function emailText(p: Prospect) {
  const pitch =
    p.segment === "agence"
      ? `Un visiteur qui a déjà simulé sa capacité d'emprunt ou la rentabilité de son projet a filtré lui-même sa demande : il arrive avec un budget réel et un projet défini, pas une simple curiosité. Moins de temps passé à qualifier des dossiers flous, plus de temps sur les projets sérieux.

Nous avons développé 3 simulateurs (capacité d'emprunt, prêt relais, rentabilité locative) que vous pouvez tester et intégrer en 2 minutes : un bloc de code à coller sur votre site, hébergé et maintenu par nous, gratuit, sans compte technique.`
      : `Un lecteur qui peut simuler sa capacité d'emprunt ou sa rentabilité locative directement sur votre article reste sur votre page, au lieu d'aller chercher l'info ailleurs.

Nous avons développé 3 simulateurs immobiliers gratuits, intégrables en quelques minutes : un bloc de code à copier-coller, aucune maintenance de votre côté.`;
  return `Bonjour,

Nous sommes lokt.fr, un outil de gestion locative et des simulateurs immobiliers gratuits.

${pitch}

Essayer avant de décider : ${WIDGET_URL}

Si ce n'est pas pour vous, répondez-moi simplement "non merci".

Matthieu — lokt.fr`;
}

// 2 exemples synthétiques (un par segment), pour relire le texte d'une
// campagne sans renvoyer tout le lot réel ni toucher à son statut en base —
// toujours envoyés à l'adresse de preview, même si WIDGET_PROSPECT_LIVE=true.
const TEST_PROSPECTS: Prospect[] = [
  { id: "test-agence", name: "Agence Exemple", email: "", segment: "agence" },
  { id: "test-blog", name: "Blog Exemple", email: "", segment: "blog" },
];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!hasValidCronSecret(req)) return res.status(401).json({ error: "Unauthorized" });
  if (!supabaseAdmin) return res.status(500).json({ error: "Supabase admin non configuré." });

  const isTestRun = req.query.test === "1";
  const live = !isTestRun && process.env.WIDGET_PROSPECT_LIVE === "true";

  let pending: Prospect[];
  if (isTestRun) {
    pending = TEST_PROSPECTS;
  } else {
    const { data, error } = await supabaseAdmin
      .from("widget_prospects")
      .select("id, name, email, segment")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(BATCH_LIMIT);
    if (error) return res.status(500).json({ error: error.message });
    pending = (data || []) as Prospect[];
  }

  let sent = 0;
  let failed = 0;
  const failures: Array<{ id: string; error: any }> = [];

  for (const prospect of pending) {
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
    mode: isTestRun ? "test" : live ? "live" : "preview",
    candidates: pending.length,
    sent,
    failed,
    failures: failures.length ? failures : undefined,
  });
}
