// pages/api/tools/capacite/notify-agency.ts
//
// Widget capacité d'emprunt embarqué sur le site d'une agence
// (pages/embed/capacite.tsx) : notifie l'agence par email quand un
// visiteur termine la simulation ET a explicitement coché le
// consentement à être recontacté (jamais sans ce consentement). Aucune
// écriture dans la base de leads lokt.fr dans ce contexte — l'email de
// l'agence est passé par l'intégration (?agency_email=...), pas lié à un
// compte, cohérent avec le MVP volontairement sans configurateur ni
// compte partenaire.
import type { NextApiRequest, NextApiResponse } from "next";
import { sendEmailViaResend } from "../../../../lib/mailer/resend";
import { emailLayout } from "../../../../lib/emails/layout";

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

  try {
    rateLimitOrThrow(getClientIp(req));

    const agencyEmail = safeEmail(req.body?.agencyEmail);
    const visitorEmail = safeEmail(req.body?.visitorEmail);
    const visitorPhone = req.body?.visitorPhone ? String(req.body.visitorPhone).trim() : null;
    const referrerUrl = req.body?.referrerUrl ? String(req.body.referrerUrl).slice(0, 500) : null;
    const budgetTotalMax = Number(req.body?.budgetTotalMax || 0);
    const montantMax = Number(req.body?.montantMax || 0);
    const scoreLabel = String(req.body?.scoreLabel || "").slice(0, 60);
    const score = Number(req.body?.score || 0);

    if (!isValidEmail(agencyEmail)) return res.status(400).json({ ok: false, error: "agencyEmail invalide" });
    if (!isValidEmail(visitorEmail)) return res.status(400).json({ ok: false, error: "visitorEmail invalide" });

    const contentHtml = `
      <p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#334155;">
        Un visiteur a utilisé le simulateur de capacité d'emprunt intégré sur votre site et a accepté d'être recontacté.
      </p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;font-size:13.5px;margin:4px 0 16px;">
        <tr><td style="padding:4px 0;color:#64748b;">Email</td><td style="padding:4px 0;text-align:right;font-weight:700;color:#0f172a;">${escapeHtml(visitorEmail)}</td></tr>
        ${visitorPhone ? `<tr><td style="padding:4px 0;color:#64748b;">Téléphone</td><td style="padding:4px 0;text-align:right;font-weight:700;color:#0f172a;">${escapeHtml(visitorPhone)}</td></tr>` : ""}
        <tr><td style="padding:4px 0;color:#64748b;">Budget estimé (apport inclus)</td><td style="padding:4px 0;text-align:right;font-weight:700;color:#0f172a;">${euro(budgetTotalMax)}</td></tr>
        <tr><td style="padding:4px 0;color:#64748b;">Capital empruntable</td><td style="padding:4px 0;text-align:right;font-weight:700;color:#0f172a;">${euro(montantMax)}</td></tr>
        ${scoreLabel ? `<tr><td style="padding:4px 0;color:#64748b;">Score lokt.fr</td><td style="padding:4px 0;text-align:right;font-weight:700;color:#0f172a;">${score}/100 — ${escapeHtml(scoreLabel)}</td></tr>` : ""}
        ${referrerUrl ? `<tr><td style="padding:4px 0;color:#64748b;">Page d'origine</td><td style="padding:4px 0;text-align:right;font-weight:700;color:#0f172a;word-break:break-all;">${escapeHtml(referrerUrl)}</td></tr>` : ""}
      </table>
      <p style="margin:0 0 14px;font-size:13.5px;line-height:1.6;color:#475569;">
        Ce montant est une estimation indicative, pas une offre de prêt. Nous vous recommandons de recontacter directement ce visiteur pour qualifier son projet.
      </p>
    `;

    const html = emailLayout({
      title: "Nouveau lead — simulateur de capacité d'emprunt",
      preheader: `${visitorEmail} — budget estimé ${euro(budgetTotalMax)}`,
      contentHtml,
      footerText: "Lead transmis par le widget lokt.fr intégré sur votre site — lokt.fr ne conserve pas ces coordonnées.",
    });

    const mail = await sendEmailViaResend({
      to: agencyEmail,
      subject: `Nouveau lead — ${euro(budgetTotalMax)} de budget estimé`,
      html,
      replyTo: visitorEmail,
    });

    if (!mail.ok) {
      console.error("[capacite/notify-agency] resend error:", mail.error);
      return res.status(500).json({ ok: false, error: mail.error });
    }

    return res.status(200).json({ ok: true });
  } catch (e: any) {
    if (String(e?.message) === "RATE_LIMIT") return res.status(429).json({ ok: false, error: "Trop de requêtes, réessayez dans une minute." });
    console.error("[capacite/notify-agency] error:", e);
    return res.status(500).json({ ok: false, error: e?.message || "unknown_error" });
  }
}
