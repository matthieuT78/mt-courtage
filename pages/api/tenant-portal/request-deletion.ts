// pages/api/tenant-portal/request-deletion.ts
//
// Canal RGPD côté locataire : permet à un locataire connecté à son espace de
// demander la suppression/anonymisation de ses données personnelles. On ne
// supprime rien automatiquement ici (le bailleur a son propre intérêt
// légitime à conserver quittances/bail pour sa comptabilité) — on notifie le
// bailleur et contact@lokt.fr pour traitement manuel, avec accusé de
// réception au locataire.
import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../../lib/apiAuth";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { getTenantPortalAccess } from "../../../lib/tenantPortal";
import { sendEmailViaResend } from "../../../lib/mailer/resend";

function displayName(row?: Record<string, any> | null, fallback = "Locataire") {
  return (
    String(row?.display_name || row?.full_name || "").trim() ||
    [row?.first_name, row?.last_name].filter(Boolean).join(" ").trim() ||
    fallback
  );
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    if (!supabaseAdmin) return res.status(500).json({ ok: false, error: "Supabase admin non configuré." });

    const auth = await requireApiUser(req);
    if (!auth.ok) return res.status(auth.status).json({ ok: false, error: auth.error });

    const accesses = await getTenantPortalAccess(auth.userId);
    if (accesses.length === 0) {
      return res.status(403).json({ ok: false, error: "Aucun accès locataire pour ce compte." });
    }

    const tenantIds = Array.from(new Set(accesses.map((a) => a.tenant_id)));
    const landlordUserIds = Array.from(new Set(accesses.map((a) => a.landlord_user_id)));

    const [{ data: tenants, error: tenantsError }, { data: landlords, error: landlordsError }] = await Promise.all([
      supabaseAdmin.from("tenants").select("id,email,full_name,first_name,last_name").in("id", tenantIds),
      supabaseAdmin.from("landlords").select("user_id,display_name").in("user_id", landlordUserIds),
    ]);
    if (tenantsError) throw tenantsError;
    if (landlordsError) throw landlordsError;

    const tenant = (tenants || [])[0] || null;
    const tenantName = displayName(tenant);
    const tenantEmail = String(tenant?.email || auth.email || "").trim();
    const landlordByUserId = new Map((landlords || []).map((l) => [l.user_id, l]));

    const results = await Promise.all(
      landlordUserIds.map(async (landlordUserId) => {
        const { data: authUser, error: authUserError } = await supabaseAdmin!.auth.admin.getUserById(landlordUserId);
        if (authUserError) throw authUserError;
        const to = String(authUser.user?.email || "").trim();
        if (!to) return { landlordUserId, ok: false as const, error: "Email bailleur introuvable." };

        const landlordName = displayName(landlordByUserId.get(landlordUserId), "Bailleur");
        const subject = `Demande de suppression de données — ${tenantName}`;
        const text = [
          `Bonjour ${landlordName},`,
          "",
          `${tenantName}${tenantEmail ? ` (${tenantEmail})` : ""} a demandé, depuis son espace locataire sur lokt.fr, la suppression ou l'anonymisation de ses données personnelles (droit à l'effacement RGPD).`,
          "",
          "Cette demande ne déclenche aucune suppression automatique : le bail et les documents financiers liés (quittances, comptabilité) restent votre responsabilité et peuvent être conservés selon vos obligations légales. Il vous appartient d'anonymiser les données du locataire une fois ce besoin de conservation éteint.",
          "",
          "Pour vous faire accompagner sur cette demande, vous pouvez répondre à cet email ou écrire à contact@lokt.fr.",
        ].join("\n");
        const html = text
          .split("\n\n")
          .map((p) => `<p>${p.replace(/\n/g, "<br/>")}</p>`)
          .join("");

        const sent = await sendEmailViaResend({ to, cc: "contact@lokt.fr", subject, html, text });

        try {
          await supabaseAdmin!.from("email_logs").insert({
            user_id: landlordUserId,
            to_email: to,
            subject,
            body_preview: text.slice(0, 200),
            sent_at: new Date().toISOString(),
            status: sent.ok ? "sent" : "error",
            error_message: sent.ok ? null : sent.error,
          });
        } catch {
          // Le journal d'email ne doit jamais bloquer la demande.
        }

        return { landlordUserId, ok: sent.ok, error: sent.ok ? null : sent.error };
      })
    );

    if (tenantEmail) {
      const confirmSubject = "Votre demande de suppression de données a bien été transmise";
      const confirmText = [
        `Bonjour ${tenantName},`,
        "",
        "Nous avons bien transmis votre demande de suppression/anonymisation de données personnelles à votre bailleur, avec copie à notre équipe (contact@lokt.fr).",
        "",
        "Le traitement peut nécessiter un délai, le temps que votre bailleur concilie votre demande avec ses propres obligations de conservation (comptabilité, litiges éventuels). Vous pouvez nous écrire à contact@lokt.fr pour toute question.",
      ].join("\n");
      const confirmHtml = confirmText
        .split("\n\n")
        .map((p) => `<p>${p.replace(/\n/g, "<br/>")}</p>`)
        .join("");
      await sendEmailViaResend({ to: tenantEmail, subject: confirmSubject, html: confirmHtml, text: confirmText });
    }

    const anySent = results.some((r) => r.ok);
    if (!anySent) {
      return res.status(502).json({ ok: false, error: "Échec de l'envoi de la demande. Réessayez plus tard." });
    }

    return res.status(200).json({ ok: true });
  } catch (e: any) {
    console.error("[request-deletion] error:", e?.message);
    return res.status(500).json({ ok: false, error: e?.message || "Erreur interne" });
  }
}
