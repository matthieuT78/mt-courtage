// pages/api/contact.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { sendEmailViaResend } from "../../lib/mailer/resend";

type Cat = "bug" | "suggestion" | "partenariat" | "autre";

type Body = {
  category?: Cat;
  email?: string;
  message?: string;
  page?: string;
  hp?: string; // honeypot anti-bot
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

// mini rate-limit en mémoire (OK pour Vercel/Node single instance, "best effort")
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
      body.category === "bug" ||
      body.category === "suggestion" ||
      body.category === "partenariat" ||
      body.category === "autre"
        ? body.category
        : "autre";

    const email = safeEmail(body.email);
    const message = safeStr(body.message, 4000);
    const page = safeStr(body.page, 300);

    // ✅ email obligatoire
    if (!email) {
      return res.status(400).json({ ok: false, error: "email_required" });
    }

    if (!message || message.length < 8) {
      return res.status(400).json({ ok: false, error: "message_too_short" });
    }

    const label = labelFromCategory(category);
    const subject = `[Lokt] ${label}${page ? ` — ${page}` : ""}`;

    const safeMessageHtml = escapeHtml(message);

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:16px;">
        <h2 style="margin:0 0 10px;color:#0f172a;">Nouveau message (chat)</h2>
        <p style="margin:0 0 6px;color:#334155;"><strong>Catégorie :</strong> ${label}</p>
        <p style="margin:0 0 6px;color:#334155;"><strong>Email :</strong> ${escapeHtml(email)}</p>
        <p style="margin:0 0 12px;color:#334155;"><strong>Page :</strong> ${escapeHtml(page || "(inconnue)")}</p>
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
      `Page: ${page || "(inconnue)"}\n\n` +
      `${message}\n`;

    const r = await sendEmailViaResend({
      to: "contact@lokt.fr",
      subject,
      html,
      text,
      replyTo: email, // ✅ important : tu peux répondre direct depuis ta boîte
    });

    if (!r.ok) {
      return res.status(500).json({ ok: false, error: r.error || "send_failed" });
    }

    return res.status(200).json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || "server_error" });
  }
}
