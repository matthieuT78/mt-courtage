// pages/api/diagnostics/email.ts
import type { NextApiRequest, NextApiResponse } from "next";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const apiKey = process.env.RESEND_API_KEY || "";
  const from = process.env.RESEND_FROM || "";

  const active = Boolean(apiKey && from);

  return res.status(200).json({
    active,
    provider: "resend",
    from: from || null,
    info: active ? null : "RESEND_API_KEY / RESEND_FROM manquants.",
  });
}
