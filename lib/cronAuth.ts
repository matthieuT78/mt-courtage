import type { NextApiRequest } from "next";

export function hasValidCronSecret(req: NextApiRequest) {
  const expected = String(process.env.CRON_SECRET || "");
  if (!expected) return false;

  const customHeader = String(req.headers["x-cron-secret"] || "");
  const authorization = String(req.headers.authorization || "");
  const basicValue = Buffer.from(`lokt-cron:${expected}`).toString("base64");
  return customHeader === expected || authorization === `Bearer ${expected}` || authorization === `Basic ${basicValue}`;
}
