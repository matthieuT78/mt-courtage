// pages/api/cron/account-deletion-notice.ts
//
// RGPD — étape 2 du pipeline de suppression des comptes jamais confirmés :
// à partir de 30 jours sans confirmation (fin de la fenêtre de relance
// hebdomadaire de signup-confirmation-reminder), on envoie un avertissement
// final unique et on programme la suppression 7 jours plus tard, à moins que
// l'email soit confirmé entre-temps.
import type { NextApiRequest, NextApiResponse } from "next";
import { hasValidCronSecret } from "../../../lib/cronAuth";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { sendEmailViaResend } from "../../../lib/mailer/resend";
import { alertCronFailures } from "../../../lib/cronAlert";
import {
  buildCompteSuppressionProgrammeeEmailHtml,
  buildCompteSuppressionProgrammeeEmailText,
} from "../../../lib/emails/compte-suppression-programmee";

const DAY_MS = 24 * 60 * 60 * 1000;
const NOTICE_AFTER_MS = 30 * DAY_MS; // aligné sur la fin de fenêtre de relance
const GRACE_PERIOD_MS = 7 * DAY_MS;

function appUrl() {
  return (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://lokt.fr").replace(/\/$/, "");
}

function formatDateFr(iso: string) {
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(iso));
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "GET" && req.method !== "POST") {
      res.setHeader("Allow", "GET, POST");
      return res.status(405).json({ error: "Method not allowed" });
    }
    if (!hasValidCronSecret(req)) return res.status(401).json({ error: "Unauthorized" });
    if (!supabaseAdmin) return res.status(500).json({ error: "Supabase admin non configuré." });

    const baseUrl = appUrl();
    const now = Date.now();

    const users: any[] = [];
    let page = 1;
    const perPage = 1000;
    while (true) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
      if (error) throw error;
      const batch = data?.users || [];
      users.push(...batch);
      if (batch.length < perPage) break;
      page++;
    }

    const candidates = users.filter((u) => {
      if (u.email_confirmed_at) return false;
      if (!u.email || !u.created_at) return false;
      return now - new Date(u.created_at).getTime() >= NOTICE_AFTER_MS;
    });

    let notified = 0;
    let skipped = 0;
    const results: any[] = [];

    for (const user of candidates) {
      try {
        const { data: existing, error: existingError } = await supabaseAdmin
          .from("account_deletion_notices")
          .select("id, email_sent_at")
          .eq("user_id", user.id)
          .maybeSingle();
        if (existingError) throw existingError;

        // Déjà notifié avec succès : rien à refaire. Une ligne existante mais
        // sans email_sent_at signifie que l'envoi avait échoué la dernière fois —
        // on retente ci-dessous, avec une date de suppression recalculée à partir
        // de maintenant (le délai de grâce doit démarrer une fois l'email
        // réellement délivré, pas à la première tentative infructueuse).
        if (existing?.email_sent_at) {
          skipped++;
          continue;
        }

        const noticeId = existing?.id ?? null;

        if (!noticeId) {
          // Réserve la ligne avant d'envoyer quoi que ce soit, pour que
          // l'insertion échoue plutôt que de dupliquer si deux exécutions se
          // chevauchent (contrainte unique sur user_id). La date posée ici est
          // provisoire : tant qu'email_sent_at est vide, personne n'a encore
          // été prévenu, donc elle est recalculée juste avant l'envoi ci-dessous.
          const { error: insertError } = await supabaseAdmin.from("account_deletion_notices").insert({
            user_id: user.id,
            email: user.email,
            notified_at: new Date(now).toISOString(),
            scheduled_deletion_at: new Date(now + GRACE_PERIOD_MS).toISOString(),
          });
          if (insertError) throw insertError;
        }

        // Calculée au moment de l'envoi (pas de la réservation) : si l'envoi a
        // échoué plusieurs jours de suite avant de réussir, le délai de grâce
        // de 7 jours démarre bien à partir du jour où l'utilisateur est
        // réellement prévenu, pas du premier essai infructueux.
        const scheduledDeletionAt = new Date(now + GRACE_PERIOD_MS).toISOString();

        const { data: profile } = await supabaseAdmin.from("profiles").select("full_name, first_name").eq("id", user.id).maybeSingle();
        const fullName = (profile as any)?.full_name || (profile as any)?.first_name || "";

        // Renvoie un lien de confirmation frais (le précédent, envoyé lors de la
        // dernière relance, peut avoir expiré) — best-effort, ne bloque pas l'avertissement.
        await supabaseAdmin.auth.resend({
          type: "signup",
          email: user.email,
          options: { emailRedirectTo: `${baseUrl}/mon-compte?mode=login` },
        }).catch((e) => console.error("[cron/account-deletion-notice] resend confirmation error:", e));

        const mail = await sendEmailViaResend({
          to: user.email,
          subject: "Votre compte lokt.fr sera supprimé prochainement",
          html: buildCompteSuppressionProgrammeeEmailHtml({
            fullName,
            deletionDateLabel: formatDateFr(scheduledDeletionAt),
            loginUrl: `${baseUrl}/mon-compte?mode=login`,
          }),
          text: buildCompteSuppressionProgrammeeEmailText({
            fullName,
            deletionDateLabel: formatDateFr(scheduledDeletionAt),
            loginUrl: `${baseUrl}/mon-compte?mode=login`,
          }),
        });
        if (!mail.ok) throw new Error(mail.error || "Échec envoi email");

        const { error: markSentError } = await supabaseAdmin
          .from("account_deletion_notices")
          .update({ email_sent_at: new Date().toISOString(), scheduled_deletion_at: scheduledDeletionAt })
          .eq("user_id", user.id);
        if (markSentError) throw markSentError;

        notified++;
        results.push({ userId: user.id, email: user.email, notified: true, scheduledDeletionAt });
      } catch (e: any) {
        skipped++;
        results.push({ userId: user.id, email: user.email, notified: false, error: e?.message || String(e) });
      }
    }

    const failures = results.filter((r) => r.notified === false);
    await alertCronFailures("account-deletion-notice", failures.map((f) => ({ email: f.email, error: f.error })));

    return res.status(200).json({ ok: true, candidates: candidates.length, notified, skipped, results });
  } catch (e: any) {
    console.error("[cron/account-deletion-notice] error:", e);
    return res.status(500).json({ error: e?.message || "Erreur interne" });
  }
}
