// pages/api/health/email.ts
import type { NextApiRequest, NextApiResponse } from "next";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const provider = "resend";
  const from = process.env.RESEND_FROM || null;
  const key = process.env.RESEND_API_KEY || null;

  const ok = !!from && !!key;

  return res.status(200).json({
    ok,
    provider,
    from,
    details: ok ? "RESEND_API_KEY et RESEND_FROM détectés." : "RESEND_API_KEY / RESEND_FROM manquants.",
  });
}
