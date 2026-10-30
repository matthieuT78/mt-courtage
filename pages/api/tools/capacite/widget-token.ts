// pages/api/tools/capacite/widget-token.ts
//
// Convertit l'email d'une agence en jeton opaque pour le widget capacité
// d'emprunt (cf. pages/widget.tsx) : le code d'intégration généré ne doit
// jamais transporter l'email en clair dans l'URL de l'iframe (visible dans
// le code source de la page de l'agence) — voir widget_agencies dans
// supabase/migrations/20261023120000_widget_agencies.sql. Un même email
// réutilisé renvoie toujours le même token (upsert sur agency_email +
// simulator), pour que le snippet généré reste stable d'une visite à
// l'autre sur /widget.
import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

type RLState = { windowStart: number; count: number };
const RL: Record<string, RLState> = {};
function rateLimitOrThrow(ip: string) {
  const WINDOW_MS = 60_000;
  const MAX = 10;
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

    const agencyEmail = String(req.body?.agencyEmail || "").trim().toLowerCase();
    const siteLabel = req.body?.siteLabel ? String(req.body.siteLabel).trim().slice(0, 80) : null;
    const requestedSimulator = String(req.body?.simulator || "capacite").trim();
    const ALLOWED_SIMULATORS = ["capacite", "pret-relais", "investissement"];
    const simulator = ALLOWED_SIMULATORS.includes(requestedSimulator) ? requestedSimulator : "capacite";

    if (!isValidEmail(agencyEmail)) return res.status(400).json({ ok: false, error: "agencyEmail invalide" });

    // Un seul token par agence (pas par simulateur) : une agence qui a
    // plusieurs calculettes embarquées doit recevoir tous ses leads avec le
    // même code, cf. supabase/migrations/20261030140000_widget_agencies_single_token.sql.
    const { data: existing, error: selectError } = await supabaseAdmin
      .from("widget_agencies")
      .select("token, site_label")
      .eq("agency_email", agencyEmail)
      .maybeSingle();

    if (selectError) return res.status(500).json({ ok: false, error: selectError.message });

    if (existing) {
      if (siteLabel && siteLabel !== existing.site_label) {
        await supabaseAdmin.from("widget_agencies").update({ site_label: siteLabel }).eq("token", existing.token);
      }
      return res.status(200).json({ ok: true, token: existing.token });
    }

    const token = crypto.randomBytes(12).toString("hex");
    const { error: insertError } = await supabaseAdmin
      .from("widget_agencies")
      .insert({ token, agency_email: agencyEmail, site_label: siteLabel, simulator });

    if (insertError) return res.status(500).json({ ok: false, error: insertError.message });

    return res.status(200).json({ ok: true, token });
  } catch (e: any) {
    if (String(e?.message) === "RATE_LIMIT") return res.status(429).json({ ok: false, error: "Trop de requêtes, réessayez dans une minute." });
    console.error("[capacite/widget-token] error:", e);
    return res.status(500).json({ ok: false, error: e?.message || "unknown_error" });
  }
}
