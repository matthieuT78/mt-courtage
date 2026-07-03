import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../../lib/apiAuth";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!supabaseAdmin) return res.status(500).json({ error: "Supabase admin non configuré." });

  const auth = await requireApiUser(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const { candidature_id } = req.body || {};
  if (!candidature_id) return res.status(400).json({ error: "candidature_id requis." });

  // Vérifier que la candidature appartient au bailleur via l'annonce
  const { data: candidature } = await supabaseAdmin
    .from("candidatures")
    .select("*, rental_listings!inner(user_id)")
    .eq("id", candidature_id)
    .maybeSingle();

  if (!candidature) return res.status(404).json({ error: "Candidature introuvable." });
  if ((candidature.rental_listings as any)?.user_id !== auth.userId) {
    return res.status(403).json({ error: "Non autorisé." });
  }

  // Si déjà convertie : retrouver le locataire et retourner sans recréer
  if (candidature.status === "converted") {
    const existing = candidature.email
      ? (await supabaseAdmin.from("tenants").select("id").eq("user_id", auth.userId).eq("email", candidature.email).maybeSingle()).data
      : null;
    return res.status(200).json({ ok: true, tenant: existing, already_exists: true });
  }

  if (candidature.status !== "accepted") {
    return res.status(409).json({ error: "Seule une candidature retenue peut être convertie." });
  }

  // Vérifier si un locataire avec cet email existe déjà
  if (candidature.email) {
    const { data: existing } = await supabaseAdmin
      .from("tenants")
      .select("id")
      .eq("user_id", auth.userId)
      .eq("email", candidature.email)
      .maybeSingle();

    if (existing) {
      await supabaseAdmin
        .from("candidatures")
        .update({ status: "converted" })
        .eq("id", candidature_id);
      return res.status(200).json({ ok: true, tenant: existing, already_exists: true });
    }
  }

  // Créer le locataire depuis les données de la candidature
  const { data: tenant, error } = await supabaseAdmin
    .from("tenants")
    .insert({
      user_id: auth.userId,
      first_name: candidature.first_name ?? null,
      last_name: candidature.last_name ?? null,
      email: candidature.email ?? null,
      phone: candidature.phone ?? null,
    })
    .select("*")
    .single();

  if (error) return res.status(500).json({ error: error.message });

  // Marquer la candidature comme convertie
  await supabaseAdmin
    .from("candidatures")
    .update({ status: "converted" })
    .eq("id", candidature_id);

  return res.status(200).json({ ok: true, tenant, already_exists: false });
}
