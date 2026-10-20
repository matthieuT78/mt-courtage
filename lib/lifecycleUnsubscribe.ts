import crypto from "crypto";

function secret() {
  return process.env.INTERNAL_API_SECRET || "";
}

export function signUnsubscribeToken(userId: string) {
  return crypto.createHmac("sha256", secret()).update(userId).digest("hex");
}

export function verifyUnsubscribeToken(userId: string, token: string) {
  if (!secret() || !userId || !token) return false;
  const expected = signUnsubscribeToken(userId);
  if (expected.length !== token.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(token));
}

export function buildUnsubscribeUrl(baseUrl: string, userId: string) {
  const sig = signUnsubscribeToken(userId);
  return `${baseUrl}/api/lifecycle-unsubscribe?u=${encodeURIComponent(userId)}&sig=${sig}`;
}
