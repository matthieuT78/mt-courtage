import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { requireApiUser, requireMatchingUser } from "../../../lib/apiAuth";
import { irlByQuarter } from "../../../lib/irlData";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Méthode non autorisée." });
  }
  if (!supabaseAdmin) return res.status(500).json({ error: "DB indisponible." });

  const auth = await requireApiUser(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const { userId, leaseId, refQuarter, newQuarter } = req.body as {
    userId?: string;
    leaseId?: string;
    refQuarter?: string;
    newQuarter?: string;
  };

  if (!userId) return res.status(400).json({ error: "userId requis." });
  const userCheck = requireMatchingUser(auth, userId);
  if (!userCheck.ok) return res.status(userCheck.status).json({ error: userCheck.error });

  if (!leaseId || !refQuarter || !newQuarter) {
    return res.status(400).json({ error: "leaseId, refQuarter et newQuarter requis." });
  }

  const { data: lease, error: leaseErr } = await supabaseAdmin
    .from("leases").select("*").eq("id", leaseId).single();
  if (leaseErr || !lease) return res.status(404).json({ error: "Bail introuvable." });
  if (lease.user_id !== auth.userId) return res.status(403).json({ error: "Accès refusé." });

  const refEntry = irlByQuarter(refQuarter);
  const newEntry = irlByQuarter(newQuarter);
  const currentRent = Number(lease.rent_amount || 0);

  if (!refEntry || !newEntry) return res.status(400).json({ error: "Trimestre IRL introuvable." });
  if (currentRent <= 0 || refEntry.value <= 0) return res.status(400).json({ error: "Loyer ou IRL invalide." });

  const newRent = Math.round((currentRent * (newEntry.value / refEntry.value)) * 100) / 100;

  const { error: updateErr } = await supabaseAdmin
    .from("leases")
    .update({
      rent_amount: newRent,
      irl_applied_at: new Date().toISOString(),
      irl_previous_rent: currentRent,
    })
    .eq("id", leaseId);

  if (updateErr) return res.status(500).json({ error: updateErr.message });

  return res.status(200).json({ ok: true, previousRent: currentRent, newRent });
}
