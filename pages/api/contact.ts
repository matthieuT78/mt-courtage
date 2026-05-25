// pages/api/contact.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { sendEmailViaResend } from "../../lib/mailer/resend";

type Cat = "problem" | "unclear" | "idea" | "pro" | "bug" | "suggestion" | "partenariat" | "autre";

type Body = {
  category?: Cat;
  email?: string;
  message?: string;
  page?: string;
  hp?: string; // honeypot anti-bot
  context?: {
    url?: string;
    userAgent?: string;
    viewport?: string;
    plan?: string;
    isLoggedIn?: boolean;
    userId?: string;
  };
};

function safeStr(x: any, max = 4000) {
  const s = String(x ?? "").trim();
  return s.length > max ? s.slice(0, max) : s;
}

function safeEmail(x: any) {
  const s = String(x ?? "").trim().toLowerCase();
  if (!s) return "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return "";
  return s;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// mini rate-limit en mémoire (best effort)
const RATE_WINDOW_MS = 20_000; // 20s
const RATE_MAX = 3; // 3 req / 20s / IP
const bucket = new Map<string, { count: number; resetAt: number }>();

function getIp(req: NextApiRequest) {
  const xf = req.headers["x-forwarded-for"];
  const ip =
    (Array.isArray(xf) ? xf[0] : xf)?.split(",")[0]?.trim() ||
    (req.socket as any)?.remoteAddress ||
    "unknown";
  return ip;
}

function checkRateLimit(ip: string) {
  const now = Date.now();
  const cur = bucket.get(ip);
  if (!cur || now > cur.resetAt) {
    bucket.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return { ok: true as const };
  }
  if (cur.count >= RATE_MAX) {
    return { ok: false as const, waitMs: cur.resetAt - now };
  }
  cur.count += 1;
  bucket.set(ip, cur);
  return { ok: true as const };
}

function labelFromCategory(category: Cat) {
  switch (category) {
    case "problem":
      return "Problème utilisateur";
    case "unclear":
      return "Incompréhension";
    case "idea":
      return "Idée d’amélioration";
    case "pro":
      return "Contact pro";
    case "bug":
      return "Bug";
    case "suggestion":
      return "Suggestion";
    case "partenariat":
      return "Partenariat";
    default:
      return "Autre";
  }
}

/**
 * Accusé de réception "waou" (logo + header + look premium)
 * ⚠️ Assure-toi que /public/LOKT_LOGO.jpg existe bien.
 */
function buildAckEmail() {
  const siteUrl = "https://lokt.fr";
  const logoUrl = `${siteUrl}/LOKT_LOGO.jpg`;

  const subject = "Message bien reçu — lokt.fr";

  const text = `
Bonjour,

Votre message est bien arrivé chez nous.
Nous prenons le temps de le lire et de l’analyser avant de vous répondre.

Vous aurez un retour dès que possible.

Merci de votre confiance,

—
lokt.fr
Tout devient plus clair
  `.trim();

  const html = `
<div style="background:#f1f5f9;padding:18px 0;">
  <div style="max-width:640px;margin:0 auto;padding:0 14px;">
    <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">

      <!-- HEADER -->
      <div style="padding:20px 18px 14px;border-bottom:1px solid #e2e8f0;text-align:center;">
        <img
          src="${logoUrl}"
          alt="lokt.fr"
          width="140"
          style="display:block;margin:0 auto 10px;max-width:140px;height:auto;"
        />
        <p style="margin:0;font-size:13px;color:#64748b;">
          Tout devient plus clair
        </p>
      </div>

      <!-- CONTENT -->
      <div style="padding:18px 20px;color:#0f172a;font-family:Arial,sans-serif;">
        <p style="margin:0 0 12px;font-size:14px;">
          Bonjour,
        </p>

        <p style="margin:0 0 12px;font-size:14px;line-height:1.55;">
          Votre message est <strong>bien arrivé chez nous</strong>.<br/>
          Nous prenons le temps de le lire et de l’analyser avant de vous répondre.
        </p>

        <p style="margin:0 0 18px;font-size:14px;line-height:1.55;">
          Vous aurez un retour dès que possible.
        </p>

        <div style="margin:18px 0;padding:14px;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc;">
          <p style="margin:0;font-size:13px;color:#334155;">
            💡 Astuce : plus votre message est précis, plus notre réponse sera pertinente.
          </p>
        </div>

        <p style="margin:0 0 6px;font-size:14px;">
          Merci de votre confiance,
        </p>

        <p style="margin:0;font-size:14px;font-weight:700;">
          L’équipe lokt.fr
        </p>
      </div>

      <!-- FOOTER -->
      <div style="padding:14px 18px;border-top:1px solid #e2e8f0;">
        <p style="margin:0;font-size:12px;color:#64748b;">
          Ce message est un accusé de réception automatique.<br/>
          — lokt.fr
        </p>
      </div>

    </div>
  </div>
</div>
  `.trim();

  return { subject, text, html };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  try {
    const body = (req.body || {}) as Body;

    // Honeypot : si rempli -> bot (on répond OK pour ne pas aider le bot)
    if (body.hp && String(body.hp).trim().length > 0) {
      return res.status(200).json({ ok: true });
    }

    // Rate limit best-effort
    const ip = getIp(req);
    const rl = checkRateLimit(ip);
    if (!rl.ok) {
      return res.status(429).json({
        ok: false,
        error: "rate_limited",
        retry_after_ms: rl.waitMs,
      });
    }

    const category: Cat =
      body.category === "problem" ||
      body.category === "unclear" ||
      body.category === "idea" ||
      body.category === "pro" ||
      body.category === "bug" ||
      body.category === "suggestion" ||
      body.category === "partenariat" ||
      body.category === "autre"
        ? body.category
        : "problem";

    const email = safeEmail(body.email);
    const message = safeStr(body.message, 4000);
    const page = safeStr(body.page, 300);
    const context = {
      url: safeStr(body.context?.url, 500),
      userAgent: safeStr(body.context?.userAgent, 500),
      viewport: safeStr(body.context?.viewport, 80),
      plan: safeStr(body.context?.plan, 80),
      isLoggedIn: body.context?.isLoggedIn === true ? "oui" : "non",
      userId: safeStr(body.context?.userId, 120),
    };

    // ✅ email obligatoire
    if (!email) {
      return res.status(400).json({ ok: false, error: "email_required" });
    }

    if (!message || message.length < 8) {
      return res.status(400).json({ ok: false, error: "message_too_short" });
    }

    const label = labelFromCategory(category);
    const subject = `[lokt.fr] ${label}${page ? ` — ${page}` : ""}`;

    const safeMessageHtml = escapeHtml(message);
    const contextRows = [
      ["URL", context.url],
      ["Page", page || "(inconnue)"],
      ["Compte connecté", context.isLoggedIn],
      ["Plan", context.plan || "(inconnu)"],
      ["User ID", context.userId || "(non connecté)"],
      ["Viewport", context.viewport || "(inconnu)"],
      ["Navigateur", context.userAgent || "(inconnu)"],
    ];

    const html = `
<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:16px;">
  <h2 style="margin:0 0 10px;color:#0f172a;">Nouveau message support</h2>
  <p style="margin:0 0 6px;color:#334155;"><strong>Catégorie :</strong> ${label}</p>
  <p style="margin:0 0 6px;color:#334155;"><strong>Email :</strong> ${escapeHtml(email)}</p>
  <div style="margin:12px 0;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
    ${contextRows
      .map(
        ([k, v]) => `
          <div style="display:flex;gap:10px;border-bottom:1px solid #e2e8f0;padding:8px 10px;background:#f8fafc;">
            <strong style="min-width:120px;color:#334155;">${escapeHtml(k)}</strong>
            <span style="color:#0f172a;word-break:break-word;">${escapeHtml(v)}</span>
          </div>
        `
      )
      .join("")}
  </div>
  <div style="white-space:pre-wrap;color:#0f172a;line-height:1.5;border:1px solid #e2e8f0;border-radius:10px;padding:12px;background:#f8fafc;">
${safeMessageHtml}
  </div>
  <p style="margin:12px 0 0;color:#64748b;font-size:12px;">Envoyé depuis lokt.fr</p>
</div>
    `.trim();

    const text =
      `Nouveau message (chat)\n` +
      `Catégorie: ${label}\n` +
      `Email: ${email}\n` +
      `Page: ${page || "(inconnue)"}\n` +
      `URL: ${context.url || "(inconnue)"}\n` +
      `Compte connecté: ${context.isLoggedIn}\n` +
      `Plan: ${context.plan || "(inconnu)"}\n` +
      `User ID: ${context.userId || "(non connecté)"}\n` +
      `Viewport: ${context.viewport || "(inconnu)"}\n` +
      `Navigateur: ${context.userAgent || "(inconnu)"}\n\n` +
      `${message}\n`;

    // 1) Mail interne (toi)
    const r1 = await sendEmailViaResend({
      to: "contact@lokt.fr",
      subject,
      html,
      text,
      replyTo: email, // ✅ tu peux répondre directement depuis ta boîte
    });

    if (!r1.ok) {
      return res.status(500).json({ ok: false, error: r1.error || "send_failed" });
    }

    // 2) Accusé de réception (utilisateur)
    const ack = buildAckEmail();
    const r2 = await sendEmailViaResend({
      to: email,
      subject: ack.subject,
      html: ack.html,
      text: ack.text,
      replyTo: "contact@lokt.fr",
    });

    // Si l'ACK échoue, on ne bloque pas : le message interne est déjà arrivé.
    if (!r2.ok) {
      console.warn("[contact] ack_failed:", r2.error);
    }

    return res.status(200).json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || "server_error" });
  }
}
