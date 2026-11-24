// pages/api/tools/capacite/widget-view.ts
//
// Signal de vue sur un embed (pages/embed/*.tsx) — distinct de lead_count
// (qui ne s'incrémente que si le visiteur consent à être recontacté).
// Sans ce signal, lokt n'avait aucune visibilité sur le fait qu'un widget
// installé soit réellement chargé sur un site tiers (cf. audit du
// 2026-11-24). Deux niveaux : un agrégat anonyme par simulateur/jour
// (couvre aussi les embeds sans agency_token, ex. un blog sans transmission
// de leads), et un compteur par agence quand un token est présent.
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

const VALID_SIMULATORS = ["capacite", "pret-relais", "investissement"];

type RLState = { windowStart: number; count: number };
const RL: Record<string, RLState> = {};
function rateLimitOrThrow(ip: string) {
  const WINDOW_MS = 60_000;
  const MAX = 30;
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

    const simulator = String(req.body?.simulator || "");
    if (!VALID_SIMULATORS.includes(simulator)) return res.status(400).json({ ok: false, error: "simulator invalide" });
    const agencyToken = req.body?.agencyToken ? String(req.body.agencyToken).trim() : null;

    const today = new Date().toISOString().slice(0, 10);
    const { data: existing } = await supabaseAdmin
      .from("widget_embed_views")
      .select("view_count")
      .eq("simulator", simulator)
      .eq("day", today)
      .maybeSingle();

    await supabaseAdmin
      .from("widget_embed_views")
      .upsert({ simulator, day: today, view_count: (existing?.view_count || 0) + 1 }, { onConflict: "simulator,day" });

    if (agencyToken) {
      const { data: agency } = await supabaseAdmin.from("widget_agencies").select("view_count").eq("token", agencyToken).maybeSingle();
      if (agency) {
        await supabaseAdmin
          .from("widget_agencies")
          .update({ view_count: agency.view_count + 1, last_viewed_at: new Date().toISOString() })
          .eq("token", agencyToken);
      }
    }

    return res.status(200).json({ ok: true });
  } catch (e: any) {
    if (String(e?.message) === "RATE_LIMIT") return res.status(429).json({ ok: false, error: "Trop de requêtes." });
    console.error("[capacite/widget-view] error:", e);
    return res.status(500).json({ ok: false, error: e?.message || "unknown_error" });
  }
}
