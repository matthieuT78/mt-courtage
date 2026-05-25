import type { NextApiRequest } from "next";

type RateLimitState = { windowStart: number; count: number };

const memoryStore: Record<string, RateLimitState> = {};

export function getClientIp(req: NextApiRequest) {
  const forwardedFor = req.headers["x-forwarded-for"];
  return (
    (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor)?.split(",")[0]?.trim() ||
    (req.socket as any)?.remoteAddress ||
    "unknown"
  );
}

export function rateLimitEmailSendOrThrow(req: NextApiRequest, options: { max?: number; windowMs?: number } = {}) {
  const max = options.max ?? 3;
  const windowMs = options.windowMs ?? 60_000;
  const ip = getClientIp(req);
  const now = Date.now();
  const current = memoryStore[ip];

  if (!current || now - current.windowStart > windowMs) {
    memoryStore[ip] = { windowStart: now, count: 1 };
    return;
  }

  if (current.count >= max) {
    const waitSeconds = Math.ceil((windowMs - (now - current.windowStart)) / 1000);
    throw new Error(`RATE_LIMIT: réessayez dans ${waitSeconds}s`);
  }

  current.count += 1;
}
