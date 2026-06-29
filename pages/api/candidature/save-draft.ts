import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!supabaseAdmin) return res.status(500).json({ error: "Supabase admin non configuré." });

  const {
    listing_token,
    candidature_token,
    first_name, last_name, email, phone, birth_date,
    professional_situation, employer_name, net_monthly_income,
    has_guarantor, guarantor_first_name, guarantor_last_name,
    guarantor_email, guarantor_situation, guarantor_income,
    docs_identity, docs_payslip_1, docs_payslip_2, docs_payslip_3, docs_tax, docs_address,
  } = req.body || {};

  if (!listing_token) return res.status(400).json({ error: "listing_token requis." });

  const { data: listing } = await supabaseAdmin
    .from("rental_listings")
    .select("id, status")
    .eq("token", listing_token)
    .eq("status", "active")
    .maybeSingle();

  if (!listing) return res.status(404).json({ error: "Annonce introuvable ou fermée." });

  const payload = {
    listing_id: listing.id,
    status: "draft",
    first_name: first_name?.trim() || null,
    last_name: last_name?.trim() ? last_name.trim().toUpperCase() : null,
    email: email?.trim().toLowerCase() || null,
    phone: phone?.trim() || null,
    birth_date: birth_date || null,
    professional_situation: professional_situation || null,
    employer_name: employer_name?.trim() || null,
    net_monthly_income: net_monthly_income ? Number(net_monthly_income) : null,
    has_guarantor: Boolean(has_guarantor),
    guarantor_first_name: guarantor_first_name?.trim() || null,
    guarantor_last_name: guarantor_last_name?.trim() || null,
    guarantor_email: guarantor_email?.trim().toLowerCase() || null,
    guarantor_situation: guarantor_situation || null,
    guarantor_income: guarantor_income ? Number(guarantor_income) : null,
    docs_identity: Boolean(docs_identity),
    docs_payslip_1: Boolean(docs_payslip_1),
    docs_payslip_2: Boolean(docs_payslip_2),
    docs_payslip_3: Boolean(docs_payslip_3),
    docs_payslips: Boolean(docs_payslip_1) || Boolean(docs_payslip_2) || Boolean(docs_payslip_3),
    docs_tax: Boolean(docs_tax),
    docs_address: Boolean(docs_address),
    updated_at: new Date().toISOString(),
  };

  // Mise à jour d'un brouillon existant via son token
  if (candidature_token) {
    const { data: existing } = await supabaseAdmin
      .from("candidatures")
      .select("id, status")
      .eq("token", candidature_token)
      .eq("listing_id", listing.id)
      .maybeSingle();

    if (!existing) return res.status(404).json({ error: "Brouillon introuvable." });
    if (existing.status !== "draft") return res.status(409).json({ error: "Ce dossier a déjà été soumis." });

    const { data, error } = await supabaseAdmin
      .from("candidatures")
      .update(payload)
      .eq("id", existing.id)
      .select("*")
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ candidature: data });
  }

  // Création ou récupération d'un brouillon par email
  if (email) {
    const { data: byEmail } = await supabaseAdmin
      .from("candidatures")
      .select("id, token, status")
      .eq("listing_id", listing.id)
      .eq("email", email.trim().toLowerCase())
      .maybeSingle();

    if (byEmail) {
      if (byEmail.status !== "draft") {
        return res.status(409).json({ error: "Vous avez déjà soumis un dossier pour cette annonce." });
      }
      const { data, error } = await supabaseAdmin
        .from("candidatures")
        .update(payload)
        .eq("id", byEmail.id)
        .select("*")
        .single();

      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ candidature: data });
    }
  }

  // Nouveau brouillon
  const { data, error } = await supabaseAdmin
    .from("candidatures")
    .insert(payload)
    .select("*")
    .single();

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ candidature: data });
}
