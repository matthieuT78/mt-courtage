import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { sendEmailViaResend } from "../../../lib/mailer/resend";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!supabaseAdmin) return res.status(500).json({ error: "Supabase admin non configuré." });

  const {
    listing_token,
    candidature_token,
    first_name, last_name, email, phone, birth_date,
    professional_situation, employer_name, net_monthly_income,
    has_guarantor, guarantor_type, visale_number,
    guarantor_first_name, guarantor_last_name,
    guarantor_email, guarantor_situation, guarantor_income,
    docs_identity, docs_payslip_1, docs_payslip_2, docs_payslip_3, docs_tax, docs_address,
    guarantor_docs_identity, guarantor_docs_payslip_1, guarantor_docs_payslip_2, guarantor_docs_payslip_3, guarantor_docs_tax,
    consent,
  } = req.body || {};

  if (
    !listing_token || !first_name || !last_name || !email || !phone || !birth_date ||
    !professional_situation || !docs_identity || !docs_payslip_1
  ) {
    return res.status(400).json({ error: "Champs obligatoires manquants." });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(String(email).trim())) {
    return res.status(400).json({ error: "Adresse email invalide." });
  }

  // Un étudiant sans revenu propre, adossé à un garant (physique ou Visale),
  // n'a pas de revenu net mensuel à déclarer — ce n'est plus exigé dans ce cas.
  const incomeWaived = professional_situation === "etudiant" && Boolean(has_guarantor);

  let income: number | null = null;
  if (net_monthly_income !== undefined && net_monthly_income !== null && net_monthly_income !== "") {
    income = Number(net_monthly_income);
    if (!Number.isFinite(income) || income <= 0) {
      return res.status(400).json({ error: "Revenus nets invalides." });
    }
  } else if (!incomeWaived) {
    return res.status(400).json({ error: "Revenus nets requis." });
  }

  let guarantorIncomeValue: number | null = null;
  if (has_guarantor) {
    if (guarantor_type !== "individual" && guarantor_type !== "visale") {
      return res.status(400).json({ error: "Type de garant requis." });
    }
    if (guarantor_type === "visale") {
      if (!visale_number || !String(visale_number).trim()) {
        return res.status(400).json({ error: "Numéro de visa Visale requis." });
      }
    } else {
      if (!guarantor_first_name || !guarantor_last_name) {
        return res.status(400).json({ error: "Nom et prénom du garant requis." });
      }
      if (!guarantor_docs_identity || !guarantor_docs_payslip_1) {
        return res.status(400).json({ error: "Pièces du garant manquantes (identité + fiche de paie)." });
      }
      if (!guarantor_income) {
        return res.status(400).json({ error: "Revenus du garant requis." });
      }
      guarantorIncomeValue = Number(guarantor_income);
      if (!Number.isFinite(guarantorIncomeValue) || guarantorIncomeValue <= 0) {
        return res.status(400).json({ error: "Revenus du garant invalides." });
      }
    }
  }

  if (!consent) {
    return res.status(400).json({ error: "Le consentement au traitement des données est requis." });
  }

  // Récupérer l'annonce
  const { data: listing } = await supabaseAdmin
    .from("rental_listings")
    .select("id, status, user_id, title")
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
    net_monthly_income: income,
    has_guarantor: Boolean(has_guarantor),
    guarantor_type: has_guarantor ? guarantor_type : null,
    visale_number: has_guarantor && guarantor_type === "visale" ? String(visale_number).trim() : null,
    guarantor_first_name: guarantor_first_name?.trim() || null,
    guarantor_last_name: guarantor_last_name?.trim() || null,
    guarantor_email: guarantor_email?.trim().toLowerCase() || null,
    guarantor_situation: guarantor_situation || null,
    guarantor_income: guarantorIncomeValue,
    docs_identity: Boolean(docs_identity),
    docs_payslip_1: Boolean(docs_payslip_1),
    docs_payslip_2: Boolean(docs_payslip_2),
    docs_payslip_3: Boolean(docs_payslip_3),
    docs_payslips: Boolean(docs_payslip_1) || Boolean(docs_payslip_2) || Boolean(docs_payslip_3),
    docs_tax: Boolean(docs_tax),
    docs_address: Boolean(docs_address),
    guarantor_docs_identity: Boolean(guarantor_docs_identity),
    guarantor_docs_payslip_1: Boolean(guarantor_docs_payslip_1),
    guarantor_docs_payslip_2: Boolean(guarantor_docs_payslip_2),
    guarantor_docs_payslip_3: Boolean(guarantor_docs_payslip_3),
    guarantor_docs_payslips: Boolean(guarantor_docs_payslip_1) || Boolean(guarantor_docs_payslip_2) || Boolean(guarantor_docs_payslip_3),
    guarantor_docs_tax: Boolean(guarantor_docs_tax),
    submitted_at: new Date().toISOString(),
    consent_at: new Date().toISOString(),
  };

  let data, error;
  if (existing) {
    ({ data, error } = await supabaseAdmin.from("candidatures").update(payload).eq("id", existing.id).select("*").single());
  } else {
    ({ data, error } = await supabaseAdmin.from("candidatures").insert(payload).select("*").single());
  }

  if (error) return res.status(500).json({ error: error.message });

  // Notification email au bailleur (best-effort, ne bloque pas la réponse)
  try {
    const userRes = await supabaseAdmin.auth.admin.getUserById(listing.user_id);
    const landlordEmail = userRes?.data?.user?.email;
    if (landlordEmail) {
      const candidateName = `${payload.first_name} ${payload.last_name}`;
      const situationLabel: Record<string, string> = {
        CDI: "CDI", CDI_essai: "CDI (période d'essai)", CDD: "CDD",
        fonctionnaire: "Fonctionnaire", independant: "Indépendant",
        etudiant: "Étudiant", retraite: "Retraité", autre: "Autre",
      };
      const situation = payload.professional_situation ? situationLabel[payload.professional_situation] ?? payload.professional_situation : null;
      const income = payload.net_monthly_income ? `${Number(payload.net_monthly_income).toLocaleString("fr-FR")} €/mois` : null;
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://lokt.fr";

      const profileLines = [situation, income, payload.has_guarantor ? "Avec garant" : null].filter(Boolean);

      await sendEmailViaResend({
        to: landlordEmail,
        subject: `Nouvelle candidature reçue — ${listing.title}`,
        html: `
          <div style="font-family:ui-sans-serif,system-ui,-apple-system,sans-serif;line-height:1.6;color:#0f172a;max-width:520px;margin:0 auto">
            <p style="margin:0 0 16px">Bonjour,</p>
            <p style="margin:0 0 16px">
              <strong>${candidateName}</strong> vient de déposer un dossier de candidature pour votre annonce
              <strong>${listing.title}</strong>.
            </p>
            ${profileLines.length > 0 ? `
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px 16px;margin:0 0 20px">
              <p style="margin:0 0 4px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:#64748b">Profil déclaré</p>
              <p style="margin:0;font-size:14px;color:#0f172a">${profileLines.join(" · ")}</p>
            </div>` : ""}
            <p style="margin:0 0 20px">Connectez-vous pour consulter le dossier complet et le comparer aux autres candidatures.</p>
            <a href="${baseUrl}/espace-bailleur" style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;text-decoration:none;padding:10px 20px;border-radius:10px;font-size:14px;font-weight:600">
              Voir le dossier →
            </a>
            <p style="margin:24px 0 0;font-size:12px;color:#94a3b8">lokt.fr · Gestion locative simplifiée</p>
          </div>
        `,
        text: `Nouvelle candidature de ${candidateName} pour "${listing.title}"${profileLines.length ? " — " + profileLines.join(", ") : ""}. Connectez-vous sur ${baseUrl}/espace-bailleur pour la consulter.`,
      });
    }
  } catch {
    // Ne jamais bloquer la soumission pour une erreur d'email
  }

  return res.status(200).json({ candidature: data });
}
