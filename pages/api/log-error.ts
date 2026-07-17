import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../lib/supabaseAdmin";

// Patterns à ignorer : extensions browser, libs tierces, erreurs réseau bénignes
const IGNORE_PATTERNS = [
  /ResizeObserver loop/i,
  /Script error/i,
  /Non-Error promise rejection captured with value: undefined/i,
  /chrome-extension/i,
  /moz-extension/i,
  /safari-extension/i,
  /webkit-masked-url/i,
  /Loading chunk/i,
  /Hydration/i,
  /ChunkLoadError/i,
];

function shouldIgnore(msg: string) {
  return IGNORE_PATTERNS.some((p) => p.test(msg));
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const {
    source = "client",
    error_message,
    error_stack,
    url,
    user_id,
    user_agent,
    extra,
  } = req.body ?? {};

  if (!error_message || typeof error_message !== "string") {
    return res.status(400).json({ error: "error_message required" });
  }

  if (shouldIgnore(error_message)) {
    return res.status(200).json({ ok: true, skipped: true });
  }

  const { error } = await supabaseAdmin.from("error_logs").insert({
    source: String(source).slice(0, 20),
    error_message: String(error_message).slice(0, 1000),
    error_stack: error_stack ? String(error_stack).slice(0, 4000) : null,
    url: url ? String(url).slice(0, 500) : null,
    user_id: user_id ? String(user_id).slice(0, 100) : null,
    user_agent: user_agent ? String(user_agent).slice(0, 300) : null,
    extra: extra ?? null,
  });

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ ok: true });
}
