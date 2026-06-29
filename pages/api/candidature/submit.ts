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
    docs_identity, docs_payslips, docs_tax, docs_address,
  } = req.body || {};

  if (!listing_token || !first_name || !last_name || !email) {
    return res.status(400).json({ error: "Champs obligatoires manquants (prénom, nom, email)." });
  }

  // Récupérer l'annonce
  const { data: listing } = await supabaseAdmin
    .from("rental_listings")
    .select("id, status")
    .eq("token", listing_token)
    .eq("status", "active")
    .maybeSingle();

  if (!listing) return res.status(404).json({ error: "Annonce introuvable ou fermée." });

  // Résoudre le brouillon existant : par candidature_token ou par email
  let existing: { id: string; status: string } | null = null;

  if (candidature_token) {
    const { data } = await supabaseAdmin
      .from("candidatures")
      .select("id, status")
      .eq("token", candidature_token)
      .eq("listing_id", listing.id)
      .maybeSingle();
    existing = data;
  } else if (email) {
    const { data } = await supabaseAdmin
      .from("candidatures")
      .select("id, status")
      .eq("listing_id", listing.id)
      .eq("email", email.trim().toLowerCase())
      .maybeSingle();
    existing = data;
  }

  if (existing && existing.status !== "draft") {
    return res.status(409).json({ error: "Vous avez déjà soumis un dossier pour cette annonce." });
  }

  const payload = {
    listing_id: listing.id,
    status: "submitted",
    first_name: first_name.trim(),
    last_name: last_name.trim().toUpperCase(),
    email: email.trim().toLowerCase(),
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
    docs_payslips: Boolean(docs_payslips),
    docs_tax: Boolean(docs_tax),
    docs_address: Boolean(docs_address),
    submitted_at: new Date().toISOString(),
  };

  let data, error;
  if (existing) {
    ({ data, error } = await supabaseAdmin.from("candidatures").update(payload).eq("id", existing.id).select("*").single());
  } else {
    ({ data, error } = await supabaseAdmin.from("candidatures").insert(payload).select("*").single());
  }

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ candidature: data });
}
