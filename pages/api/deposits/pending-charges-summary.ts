// pages/api/deposits/pending-charges-summary.ts
//
// Écritures Finance de charges récupérables (ex: TEOM) encore en attente
// (status="expected") pour un bail donné, au moment de la restitution de
// caution — même principe que unpaid-summary.ts (loyers impayés), pour que
// le bailleur n'oublie pas de retenir une charge récupérable déjà calculée
// mais jamais réclamée avant que le locataire ne reparte.
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { requireApiUser, requireMatchingUser } from "../../../lib/apiAuth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();
  if (!supabaseAdmin) return res.status(500).json({ error: "Supabase admin non configuré." });

  const auth = await requireApiUser(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const userId = String(req.query.userId || "");
  const leaseId = String(req.query.leaseId || "");

  const userCheck = requireMatchingUser(auth, userId);
  if (!userCheck.ok) return res.status(userCheck.status).json({ error: userCheck.error });
  if (!leaseId) return res.status(400).json({ error: "leaseId requis." });

  const { data, error } = await supabaseAdmin
    .from("transactions")
    .select("id,label,amount,occurred_at,category")
    .eq("user_id", userId)
    .eq("lease_id", leaseId)
    .eq("direction", "in")
    .eq("status", "expected")
    .eq("category", "charges_recovered")
    .order("occurred_at", { ascending: true });

  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({
    charges: (data || []).map((t: any) => ({
      id: t.id,
      label: t.label || "Charge récupérable",
      amount: Number(t.amount || 0),
      occurred_at: t.occurred_at,
    })),
  });
}
