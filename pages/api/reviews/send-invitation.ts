import type { NextApiRequest, NextApiResponse } from "next";
import { hasValidCronSecret } from "../../../lib/cronAuth";
import { sendReviewInvitationEmail } from "../../../lib/emails/reviewInvitation";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();
  if (!hasValidCronSecret(req)) return res.status(401).json({ error: "Unauthorized" });

  const { email, name, source } = req.body ?? {};
  if (!email) return res.status(400).json({ error: "Email requis" });

  const result = await sendReviewInvitationEmail({ email, name, source });
  if (!result.ok) return res.status(500).json({ error: result.error });
  return res.status(200).json({ ok: true, id: result.id, to: email });
}
