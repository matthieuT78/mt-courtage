// pages/api/tools/capacite/notify-agency.ts
//
// Widget capacité d'emprunt embarqué sur le site d'une agence
// (pages/embed/capacite.tsx) : notifie l'agence par email quand un
// visiteur termine la simulation ET a explicitement coché le
// consentement à être recontacté (jamais sans ce consentement). Aucune
// écriture dans la base de leads lokt.fr dans ce contexte.
//
// Le client ne connaît jamais l'email de l'agence : il transporte un
// token opaque (voir widget-token.ts et supabase/migrations/
// 20261023120000_widget_agencies.sql), résolu ici côté serveur — l'email
// de l'agence n'apparaît donc jamais dans l'URL de l'iframe ni dans le
// code source de la page qui l'intègre.
import type { NextApiRequest, NextApiResponse } from "next";
import { sendEmailViaResend } from "../../../../lib/mailer/resend";
import { emailLayout } from "../../../../lib/emails/layout";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

function safeEmail(v: any) {
  return String(v || "").trim().toLowerCase();
}

function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function euro(n: number) {
  return Number(n || 0).toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
}

function escapeHtml(s: string) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Anti-abus léger — même principe que pages/api/tools/capacite/send.ts.
type RLState = { windowStart: number; count: number };
const RL: Record<string, RLState> = {};
function rateLimitOrThrow(ip: string) {
  const WINDOW_MS = 60_000;
  const MAX = 5;
  const now = Date.now();
  const cur = RL[ip];
  if (!cur || now - cur.windowStart > WINDOW_MS) {
    RL[ip] = { windowStart: now, count: 1 };
    return;
  }
  if (cur.count >= MAX) throw new Error("RATE_LIMIT");
  cur.count += 1;
}

function getClientIp(req: NextApiRequest) {
  const xf = req.headers["x-forwarded-for"];
  return String((Array.isArray(xf) ? xf[0] : xf)?.split(",")[0]?.trim() || (req.socket as any)?.remoteAddress || "unknown");
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }
  if (!supabaseAdmin) return res.status(500).json({ ok: false, error: "Supabase admin non configuré." });

  try {
    rateLimitOrThrow(getClientIp(req));

    const agencyToken = String(req.body?.agencyToken || "").trim();
    const visitorEmail = safeEmail(req.body?.visitorEmail);
    const visitorPhone = req.body?.visitorPhone ? String(req.body.visitorPhone).trim() : null;
    const referrerUrl = req.body?.referrerUrl ? String(req.body.referrerUrl).slice(0, 500) : null;
    const isTest = req.body?.isTest === true;
    // simulatorLabel + metrics : forme générique, commune aux 3 simulateurs
    // (capacité, prêt relais, rentabilité locative) — chacun a ses propres
    // indicateurs (capital empruntable, montant du relais, cash-flow…), donc
    // c'est le wizard appelant qui pré-formate ce qu'il veut afficher plutôt
    // que ce endpoint qui connaîtrait le détail de chaque simulateur.
    const simulatorLabel = String(req.body?.simulatorLabel || "simulateur immobilier").slice(0, 60);
    const metricsInput = Array.isArray(req.body?.metrics) ? req.body.metrics : [];
    const metrics: Array<{ label: string; value: string }> = metricsInput
      .filter((m: any) => m && typeof m.label === "string" && typeof m.value === "string")
      .slice(0, 8)
      .map((m: any) => ({ label: String(m.label).slice(0, 60), value: String(m.value).slice(0, 60) }));

    // Compat rétroactive : anciens appels (widget capacité déployé avant la
    // généralisation) qui envoient encore les champs numériques capacité
    // directement plutôt que metrics/simulatorLabel.
    if (metrics.length === 0 && (req.body?.budgetTotalMax != null || req.body?.montantMax != null)) {
      const budgetTotalMax = Number(req.body?.budgetTotalMax || 0);
      const montantMax = Number(req.body?.montantMax || 0);
      const scoreLabel = String(req.body?.scoreLabel || "").slice(0, 60);
      const score = Number(req.body?.score || 0);
      metrics.push({ label: "Budget estimé (apport inclus)", value: euro(budgetTotalMax) });
      metrics.push({ label: "Capital empruntable", value: euro(montantMax) });
      if (scoreLabel) metrics.push({ label: "Score lokt.fr", value: `${score}/100 — ${scoreLabel}` });
    }

    if (!agencyToken) return res.status(400).json({ ok: false, error: "agencyToken manquant" });
    if (!isValidEmail(visitorEmail)) return res.status(400).json({ ok: false, error: "visitorEmail invalide" });

    const { data: agency, error: agencyError } = await supabaseAdmin
      .from("widget_agencies")
      .select("agency_email, lead_count")
      .eq("token", agencyToken)
      .maybeSingle();

    if (agencyError) return res.status(500).json({ ok: false, error: agencyError.message });
    if (!agency) return res.status(404).json({ ok: false, error: "Token agence inconnu" });

    const nextLeadCount = isTest ? agency.lead_count : agency.lead_count + 1;

    const headlineMetric = metrics[0]?.value || "";

    const contentHtml = `
      <p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#334155;">
        ${
          isTest
            ? "Ceci est un email de test — aucun visiteur réel n'a utilisé le simulateur. Si vous recevez bien cet email, l'intégration est correctement configurée."
            : `Un visiteur a utilisé le simulateur ${escapeHtml(simulatorLabel)} intégré sur votre site et a accepté d'être recontacté.`
        }
      </p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;font-size:13.5px;margin:4px 0 16px;">
        <tr><td style="padding:4px 0;color:#64748b;">Email</td><td style="padding:4px 0;text-align:right;font-weight:700;color:#0f172a;">${escapeHtml(visitorEmail)}</td></tr>
        ${visitorPhone ? `<tr><td style="padding:4px 0;color:#64748b;">Téléphone</td><td style="padding:4px 0;text-align:right;font-weight:700;color:#0f172a;">${escapeHtml(visitorPhone)}</td></tr>` : ""}
        ${metrics.map((m) => `<tr><td style="padding:4px 0;color:#64748b;">${escapeHtml(m.label)}</td><td style="padding:4px 0;text-align:right;font-weight:700;color:#0f172a;">${escapeHtml(m.value)}</td></tr>`).join("")}
        ${referrerUrl ? `<tr><td style="padding:4px 0;color:#64748b;">Page d'origine</td><td style="padding:4px 0;text-align:right;font-weight:700;color:#0f172a;word-break:break-all;">${escapeHtml(referrerUrl)}</td></tr>` : ""}
        ${!isTest ? `<tr><td style="padding:4px 0;color:#64748b;">Lead reçu via ce widget</td><td style="padding:4px 0;text-align:right;font-weight:700;color:#0f172a;">n°${nextLeadCount}</td></tr>` : ""}
      </table>
      <p style="margin:0 0 14px;font-size:13.5px;line-height:1.6;color:#475569;">
        Ces chiffres sont une estimation indicative, pas une offre engageante. Nous vous recommandons de recontacter directement ce visiteur pour qualifier son projet.
      </p>
    `;

    const html = emailLayout({
      title: isTest ? `Email de test — widget ${simulatorLabel}` : `Nouveau lead — simulateur ${simulatorLabel}`,
      preheader: isTest ? "Test de configuration du widget lokt.fr" : `${visitorEmail}${headlineMetric ? ` — ${headlineMetric}` : ""}`,
      contentHtml,
      footerText: "Lead transmis par le widget lokt.fr intégré sur votre site — lokt.fr ne conserve pas ces coordonnées.",
    });

    const mail = await sendEmailViaResend({
      to: agency.agency_email,
      subject: isTest ? "[Test] Votre widget lokt.fr est bien configuré" : `Nouveau lead — ${simulatorLabel}${headlineMetric ? ` (${headlineMetric})` : ""}`,
      html,
      replyTo: isTest ? undefined : visitorEmail,
    });

    if (!mail.ok) {
      console.error("[capacite/notify-agency] resend error:", mail.error);
      return res.status(500).json({ ok: false, error: mail.error });
    }

    if (!isTest) {
      await supabaseAdmin
        .from("widget_agencies")
        .update({ lead_count: nextLeadCount, last_lead_at: new Date().toISOString() })
        .eq("token", agencyToken);
    }

    return res.status(200).json({ ok: true });
  } catch (e: any) {
    if (String(e?.message) === "RATE_LIMIT") return res.status(429).json({ ok: false, error: "Trop de requêtes, réessayez dans une minute." });
    console.error("[capacite/notify-agency] error:", e);
    return res.status(500).json({ ok: false, error: e?.message || "unknown_error" });
  }
}
