import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../../lib/apiAuth";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

// Permet au bailleur d'annuler une demande de signature bloquée (expirée,
// ou devenue invalide après une modification du document source) — sans
// ce endpoint, le garde-fou anti-doublon de /api/signatures/create bloquait
// définitivement toute nouvelle tentative sur le même document.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const auth = await requireApiUser(req);
  if (!auth.ok) return res.status(auth.status || 401).json({ error: auth.error || "Non autorisé." });

  const { id } = req.body as { id?: string };
  if (!id) return res.status(400).json({ error: "id manquant." });

  const { data: sigReq, error } = await supabaseAdmin
    .from("signature_requests")
    .select("id, landlord_id, status")
    .eq("id", id)
    .maybeSingle();
  if (error || !sigReq) return res.status(404).json({ error: "Demande introuvable." });
  if (sigReq.landlord_id !== auth.userId) return res.status(403).json({ error: "Accès refusé." });
  if (!["pending", "partially_signed", "expired"].includes(sigReq.status)) {
    return res.status(409).json({ error: "Cette demande ne peut plus être annulée." });
  }

  const { error: updErr } = await supabaseAdmin.from("signature_requests").update({ status: "cancelled" }).eq("id", id);
  if (updErr) return res.status(500).json({ error: "Impossible d'annuler la demande." });

  return res.status(200).json({ ok: true });
}
