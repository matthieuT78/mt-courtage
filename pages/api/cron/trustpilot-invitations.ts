// Relais Trustpilot, 60 jours après l'email d'avis interne
// (pages/api/cron/review-invitations.ts). Envoyé à tout le monde à cette
// échéance, qu'ils aient répondu au premier email ou non — jamais filtré par
// réponse ou par note ("review gating" interdit par Trustpilot). Décision du
// 2026-11-14.
import type { NextApiRequest, NextApiResponse } from "next";
import { hasValidCronSecret } from "../../../lib/cronAuth";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { sendTrustpilotInvitationEmail } from "../../../lib/emails/trustpilotInvitation";

const DELAY_DAYS = 60;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!hasValidCronSecret(req)) return res.status(401).json({ error: "Unauthorized" });
  if (!supabaseAdmin) return res.status(500).json({ error: "Supabase admin non configuré." });

  const threshold = new Date(Date.now() - DELAY_DAYS * 86_400_000).toISOString();

  const { data: eligibleProfiles, error: profilesError } = await supabaseAdmin
    .from("profiles")
    .select("id, email, full_name, first_name")
    .lte("review_invitation_sent_at", threshold)
    .is("trustpilot_invitation_sent_at", null)
    .not("email", "is", null);
  if (profilesError) return res.status(500).json({ error: profilesError.message });

  let sent = 0;
  let skipped = 0;
  const failures: Array<{ userId: string; error: any }> = [];

  for (const profile of eligibleProfiles || []) {
    const name = (profile as any).first_name || (profile as any).full_name || null;
    const result = await sendTrustpilotInvitationEmail({ email: (profile as any).email, name });

    if (!result.ok) {
      skipped++;
      failures.push({ userId: (profile as any).id, error: result.error });
      continue;
    }

    await supabaseAdmin.from("profiles").update({ trustpilot_invitation_sent_at: new Date().toISOString() }).eq("id", (profile as any).id);
    sent++;
  }

  return res.status(200).json({ sent, skipped, failures: failures.length ? failures : undefined });
}
