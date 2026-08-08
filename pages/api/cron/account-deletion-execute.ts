// pages/api/cron/account-deletion-execute.ts
//
// RGPD — étape 3 du pipeline de suppression des comptes jamais confirmés :
// exécute la suppression définitive des comptes dont le délai de grâce
// (account_deletion_notices.scheduled_deletion_at) est dépassé et qui sont
// toujours non confirmés. Si l'email a été confirmé entre-temps, l'avis est
// simplement annulé (le compte n'est plus candidat).
import type { NextApiRequest, NextApiResponse } from "next";
import { hasValidCronSecret } from "../../../lib/cronAuth";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { sendEmailViaResend } from "../../../lib/mailer/resend";
import { deleteUserStorage } from "../../../lib/deleteUserStorage";
import {
  buildCompteSupprimeInactiviteEmailHtml,
  buildCompteSupprimeInactiviteEmailText,
} from "../../../lib/emails/compte-supprime-inactivite";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "GET" && req.method !== "POST") {
      res.setHeader("Allow", "GET, POST");
      return res.status(405).json({ error: "Method not allowed" });
    }
    if (!hasValidCronSecret(req)) return res.status(401).json({ error: "Unauthorized" });
    if (!supabaseAdmin) return res.status(500).json({ error: "Supabase admin non configuré." });

    const now = new Date().toISOString();

    const { data: dueNotices, error: dueError } = await supabaseAdmin
      .from("account_deletion_notices")
      .select("id, user_id, email")
      .is("deleted_at", null)
      // email_sent_at prouve que l'avertissement a bien été délivré — sans ça,
      // account-deletion-notice retentera l'envoi les jours suivants plutôt que
      // de laisser ce cron supprimer un compte qui n'a jamais été prévenu.
      .not("email_sent_at", "is", null)
      .lte("scheduled_deletion_at", now);
    if (dueError) throw dueError;

    let deleted = 0;
    let cancelled = 0;
    let skipped = 0;
    const results: any[] = [];

    for (const notice of dueNotices || []) {
      try {
        const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(notice.user_id);
        if (userError) throw userError;
        const user = userData?.user;

        // Confirmé entre-temps (ou compte déjà supprimé autrement) : l'avis n'a plus lieu d'être.
        if (!user || user.email_confirmed_at) {
          await supabaseAdmin.from("account_deletion_notices").delete().eq("id", notice.id);
          cancelled++;
          results.push({ userId: notice.user_id, email: notice.email, cancelled: true });
          continue;
        }

        const { data: profile } = await supabaseAdmin.from("profiles").select("full_name, first_name").eq("id", notice.user_id).maybeSingle();
        const fullName = (profile as any)?.full_name || (profile as any)?.first_name || "";

        const { removed, errors } = await deleteUserStorage(notice.user_id).catch((e) => {
          console.error("[cron/account-deletion-execute] storage cleanup error:", e?.message || e);
          return { removed: 0, errors: [String(e)] };
        });
        if (errors.length > 0) {
          console.error(`[cron/account-deletion-execute] storage cleanup partiel userId=${notice.user_id} — ${removed} fichier(s), erreurs:`, errors);
        }

        await supabaseAdmin.from("profiles").delete().eq("id", notice.user_id);

        const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(notice.user_id);
        if (deleteUserError) throw deleteUserError;

        await supabaseAdmin.from("account_deletion_notices").update({ deleted_at: new Date().toISOString() }).eq("id", notice.id);

        // Best-effort — le compte est déjà supprimé, un échec d'envoi ne doit rien annuler.
        const mail = await sendEmailViaResend({
          to: notice.email,
          subject: "Votre compte lokt.fr a été supprimé",
          html: buildCompteSupprimeInactiviteEmailHtml({ fullName }),
          text: buildCompteSupprimeInactiviteEmailText({ fullName }),
        });
        if (!mail.ok) console.error("[cron/account-deletion-execute] email confirmation error:", mail.error);

        deleted++;
        results.push({ userId: notice.user_id, email: notice.email, deleted: true });
      } catch (e: any) {
        skipped++;
        results.push({ userId: notice.user_id, email: notice.email, deleted: false, error: e?.message || String(e) });
      }
    }

    return res.status(200).json({ ok: true, due: (dueNotices || []).length, deleted, cancelled, skipped, results });
  } catch (e: any) {
    console.error("[cron/account-deletion-execute] error:", e);
    return res.status(500).json({ error: e?.message || "Erreur interne" });
  }
}
