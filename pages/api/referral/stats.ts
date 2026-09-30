// pages/api/referral/stats.ts
//
// ReferralCard.tsx interrogeait directement `profiles` côté client pour
// compter les filleuls (`eq("referred_by", referralCode)`) — bloqué par RLS,
// qui ne laisse jamais un utilisateur lire la fiche d'un autre, même via ce
// filtre. Résultat : "0 filleul" affiché en permanence, quelle que soit la
// réalité. Cette route passe par le service role pour ne lire que ce qui
// concerne le parrain authentifié (son propre code, ses propres filleuls).
import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../../lib/apiAuth";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  if (!supabaseAdmin) return res.status(500).json({ error: "Supabase admin non configuré." });

  const auth = await requireApiUser(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  try {
    const { data: me } = await supabaseAdmin.from("profiles").select("referral_code").eq("id", auth.userId).maybeSingle();
    const code = me?.referral_code;
    if (!code) return res.status(200).json({ ok: true, filleulCount: 0, rewarded: false });

    const { data: filleuls, error } = await supabaseAdmin
      .from("profiles")
      .select("id, referral_rewarded_at")
      .eq("referred_by", code);
    if (error) throw error;

    return res.status(200).json({
      ok: true,
      filleulCount: filleuls?.length ?? 0,
      rewarded: (filleuls || []).some((f) => !!f.referral_rewarded_at),
    });
  } catch (e: any) {
    console.error("[referral/stats] error:", e?.message);
    return res.status(500).json({ error: e?.message || "Erreur interne" });
  }
}
