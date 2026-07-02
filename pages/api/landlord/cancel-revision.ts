import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { requireApiUser, requireMatchingUser } from "../../../lib/apiAuth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Méthode non autorisée." });
  }
  if (!supabaseAdmin) return res.status(500).json({ error: "DB indisponible." });

  const auth = await requireApiUser(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const { userId, leaseId } = req.body as { userId?: string; leaseId?: string };
  if (!userId) return res.status(400).json({ error: "userId requis." });
  const userCheck = requireMatchingUser(auth, userId);
  if (!userCheck.ok) return res.status(userCheck.status).json({ error: userCheck.error });
  if (!leaseId) return res.status(400).json({ error: "leaseId requis." });

  const { data: lease, error: leaseErr } = await supabaseAdmin
    .from("leases").select("id, user_id, irl_applied_at").eq("id", leaseId).single();
  if (leaseErr || !lease) return res.status(404).json({ error: "Bail introuvable." });
  if (lease.user_id !== auth.userId) return res.status(403).json({ error: "Accès refusé." });
  if (lease.irl_applied_at) return res.status(400).json({ error: "Révision déjà appliquée, impossible d'annuler." });

  const { error } = await supabaseAdmin.from("leases").update({
    irl_sent_at: null,
    irl_sent_ref_quarter: null,
    irl_sent_new_quarter: null,
    irl_sent_new_rent: null,
    irl_apply_on: null,
  }).eq("id", leaseId);

  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({ ok: true });
}
