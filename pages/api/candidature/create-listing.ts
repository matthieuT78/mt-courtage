import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../../lib/apiAuth";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { getServerUserPlan } from "../../../lib/serverPermissions";
import { planAllowsCandidatures } from "../../../lib/permissions";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!supabaseAdmin) return res.status(500).json({ error: "Supabase admin non configuré." });

  const auth = await requireApiUser(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const plan = await getServerUserPlan(auth.userId);
  if (!planAllowsCandidatures(plan)) {
    return res.status(403).json({ error: "Les dossiers de candidature nécessitent un abonnement lokt.one ou supérieur." });
  }

  const { title, address, rent_amount, charges_amount, property_type, surface_m2, available_at, income_ratio, property_id, lot_id } = req.body || {};

  const rentAmountNum = Number(rent_amount);
  const chargesAmountNum = Number(charges_amount || 0);
  const surfaceM2Num = surface_m2 ? Number(surface_m2) : null;

  if (!title || !rent_amount || !Number.isFinite(rentAmountNum) || rentAmountNum <= 0) {
    return res.status(400).json({ error: "Titre et loyer (montant positif) obligatoires." });
  }
  if (!Number.isFinite(chargesAmountNum) || chargesAmountNum < 0) {
    return res.status(400).json({ error: "Les charges ne peuvent pas être négatives." });
  }
  if (surfaceM2Num != null && (!Number.isFinite(surfaceM2Num) || surfaceM2Num <= 0)) {
    return res.status(400).json({ error: "Surface invalide." });
  }

  let lotLabel: string | null = null;
  if (property_id) {
    const { data: property } = await supabaseAdmin
      .from("properties")
      .select("id,type")
      .eq("id", property_id)
      .eq("user_id", auth.userId)
      .maybeSingle();
    if (!property) return res.status(403).json({ error: "Bien introuvable ou non autorisé." });

    if (property.type === "building") {
      if (!lot_id) return res.status(400).json({ error: "Veuillez sélectionner le lot concerné par cette annonce." });
      const { data: lot } = await supabaseAdmin
        .from("property_lots")
        .select("id,label")
        .eq("id", lot_id)
        .eq("user_id", auth.userId)
        .eq("property_id", property_id)
        .maybeSingle();
      if (!lot) return res.status(403).json({ error: "Lot introuvable ou non autorisé." });
      lotLabel = lot.label;
    }
  }

  const { data, error } = await supabaseAdmin
    .from("rental_listings")
    .insert({
      user_id: auth.userId,
      property_id: property_id || null,
      lot_id: lotLabel ? lot_id : null,
      lot_label: lotLabel,
      title,
      address: address || null,
      rent_amount: rentAmountNum,
      charges_amount: chargesAmountNum,
      property_type: property_type || "vide",
      surface_m2: surfaceM2Num,
      available_at: available_at || null,
      income_ratio: Number(income_ratio || 3),
      status: "active",
    })
    .select("*")
    .single();

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ listing: data });
}
