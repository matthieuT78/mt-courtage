// Remplace le popup ReviewPrompt (jamais utilisé en 4 mois, 0 soumission) —
// décision du 2026-11-14. Déclenché par un vrai signal d'usage, envoyé une
// seule fois par utilisateur (profiles.review_invitation_sent_at). Deux
// critères en OU, pour ne pas rater les bailleurs qui n'envoient jamais de
// quittance via l'outil (délégation agence, receipts_disabled...) :
//   A. 1ère quittance envoyée (signal fort, prioritaire)
//   B. compte créé depuis ≥ 60 jours ET au moins un bien actif (signal
//      d'usage réel plus faible, en filet de sécurité)
import type { NextApiRequest, NextApiResponse } from "next";
import { hasValidCronSecret } from "../../../lib/cronAuth";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { sendReviewInvitationEmail } from "../../../lib/emails/reviewInvitation";

const MIN_ACCOUNT_AGE_DAYS = 60;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!hasValidCronSecret(req)) return res.status(401).json({ error: "Unauthorized" });
  if (!supabaseAdmin) return res.status(500).json({ error: "Supabase admin non configuré." });

  const { data: sentReceipts, error: receiptsError } = await supabaseAdmin.from("rent_receipts").select("owner_user_id").eq("status", "sent");
  if (receiptsError) return res.status(500).json({ error: receiptsError.message });
  const receiptUserIds = new Set((sentReceipts || []).map((r: any) => r.owner_user_id).filter(Boolean));

  const { data: activeProps, error: propsError } = await supabaseAdmin.from("properties").select("user_id, status");
  if (propsError) return res.status(500).json({ error: propsError.message });
  const activePropertyUserIds = new Set(
    (activeProps || []).filter((p: any) => (p.status || "active") !== "archived").map((p: any) => p.user_id).filter(Boolean)
  );

  const candidateIds = Array.from(new Set([...receiptUserIds, ...activePropertyUserIds]));
  if (candidateIds.length === 0) return res.status(200).json({ sent: 0, skipped: 0 });

  const { data: candidateProfiles, error: profilesError } = await supabaseAdmin
    .from("profiles")
    .select("id, email, full_name, first_name, created_at")
    .in("id", candidateIds)
    .is("review_invitation_sent_at", null)
    .not("email", "is", null);
  if (profilesError) return res.status(500).json({ error: profilesError.message });

  const ageThresholdMs = MIN_ACCOUNT_AGE_DAYS * 86_400_000;
  const eligibleProfiles = (candidateProfiles || []).filter((p: any) => {
    if (receiptUserIds.has(p.id)) return true; // critère A, prioritaire, pas de condition d'ancienneté
    const accountAgeMs = Date.now() - new Date(p.created_at).getTime();
    return activePropertyUserIds.has(p.id) && accountAgeMs >= ageThresholdMs; // critère B
  });

  let sent = 0;
  let skipped = 0;
  const failures: Array<{ userId: string; error: any }> = [];

  for (const profile of eligibleProfiles) {
    const name = (profile as any).first_name || (profile as any).full_name || null;
    const source = receiptUserIds.has((profile as any).id) ? "first_receipt" : "account_age";
    const result = await sendReviewInvitationEmail({ email: (profile as any).email, name, source });

    if (!result.ok) {
      skipped++;
      failures.push({ userId: (profile as any).id, error: result.error });
      continue;
    }

    await supabaseAdmin.from("profiles").update({ review_invitation_sent_at: new Date().toISOString() }).eq("id", (profile as any).id);
    sent++;
  }

  return res.status(200).json({ sent, skipped, failures: failures.length ? failures : undefined });
}
