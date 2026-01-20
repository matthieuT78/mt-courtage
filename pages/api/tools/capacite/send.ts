// pages/api/tools/capacite/send.ts
import type { NextApiRequest, NextApiResponse } from "next";

function safeEmail(v: any) {
  return String(v || "").trim().toLowerCase();
}

function requirePost(req: NextApiRequest) {
  return req.method === "POST";
}

// --- HTML -> text (fallback simple, volontairement basique)
function htmlToText(html: string) {
  const s = String(html || "")
    // retire scripts/styles
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    // <br>, <p>, <li> -> retours ligne
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/p\s*>/gi, "\n\n")
    .replace(/<\/li\s*>/gi, "\n")
    // retire toutes balises restantes
    .replace(/<[^>]+>/g, " ")
    // decode entités courantes
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    // normalize espaces
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return s;
}

// --- Rate limit mémoire (suffisant pour V1; sur Vercel: par instance)
type RLState = { windowStart: number; count: number };
const RL: Record<string, RLState> = {};

function getClientIp(req: NextApiRequest) {
  const xf = req.headers["x-forwarded-for"];
  const ip =
    (Array.isArray(xf) ? xf[0] : xf)?.split(",")[0]?.trim() ||
    (req.socket as any)?.remoteAddress ||
    "unknown";
  return String(ip);
}

function rateLimitOrThrow(ip: string) {
  // 3 requêtes / 60s / IP
  const WINDOW_MS = 60_000;
  const MAX = 3;
  const now = Date.now();

  const cur = RL[ip];
  if (!cur || now - cur.windowStart > WINDOW_MS) {
    RL[ip] = { windowStart: now, count: 1 };
    return;
  }
  if (cur.count >= MAX) {
    const waitMs = WINDOW_MS - (now - cur.windowStart);
    throw new Error(`RATE_LIMIT: réessayez dans ${Math.ceil(waitMs / 1000)}s`);
  }
  cur.count += 1;
}

async function sendEmailViaResend(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}) {
  const apiKey = process.env.RESEND_API_KEY || "";
  const from = process.env.RESEND_FROM || "lokt.fr <contact@lokt.fr>";

  if (!apiKey) {
    return { ok: false as const, error: "RESEND_API_KEY manquante" };
  }

  const body = {
    from,
    to: params.to,
    subject: params.subject,
    html: params.html,
    text: params.text,
    // Resend REST accepte replyTo (camelCase). Par sécurité on met aussi reply_to.
    replyTo: params.replyTo || "contact@lokt.fr",
    reply_to: params.replyTo || "contact@lokt.fr",
  };

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await r.json().catch(() => null);

  if (!r.ok) {
    return {
      ok: false as const,
      error: data?.message || "resend_error",
      raw: data,
      status: r.status,
    };
  }

  return { ok: true as const, data };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requirePost(req)) {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const ip = getClientIp(req);

    // Anti-abus léger
    rateLimitOrThrow(ip);

    const email = safeEmail(req.body?.email);
    const recapHtml = String(req.body?.html || "").trim();
    const subject = String(req.body?.subject || "Votre capacité d’emprunt – lokt.fr").trim();
    const replyTo = String(req.body?.replyTo || "contact@lokt.fr").trim();

    // Optionnel: text fourni, sinon fallback
    const providedText = String(req.body?.text || "").trim();
    const text = providedText || htmlToText(recapHtml);

    if (!email || !email.includes("@")) {
      return res.status(400).json({ ok: false, error: "Email invalide" });
    }

    // Garde-fous HTML
    if (!recapHtml || recapHtml.length < 50) {
      return res.status(400).json({ ok: false, error: "HTML recap manquant/insuffisant" });
    }
    if (recapHtml.length > 200_000) {
      return res.status(400).json({ ok: false, error: "HTML recap trop long" });
    }

    // Garde-fous texte
    if (!text || text.length < 20) {
      return res.status(400).json({ ok: false, error: "Text recap manquant/insuffisant" });
    }

    const result = await sendEmailViaResend({
      to: email,
      subject,
      html: recapHtml,
      text,
      replyTo,
    });

    if (!result.ok) {
      console.error("[capacite/send] resend error:", result.status, result.error, result.raw);
      return res.status(500).json({ ok: false, error: result.error });
    }

    // Resend renvoie { id: "..." }
    const id = (result.data as any)?.id || null;
    return res.status(200).json({ ok: true, id });
  } catch (e: any) {
    const msg = String(e?.message || "unknown_error");
    if (msg.startsWith("RATE_LIMIT:")) {
      return res.status(429).json({ ok: false, error: msg });
    }
    console.error("[capacite/send] error:", e);
    return res.status(500).json({ ok: false, error: msg });
  }
}
