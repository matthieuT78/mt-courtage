import type { NextApiRequest, NextApiResponse } from "next";
import { hasValidCronSecret } from "../../../lib/cronAuth";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_AGE_MS = DAY_MS; // relance au bout de 24h
const MAX_AGE_MS = 30 * DAY_MS; // au-delà, on considère l'inscription abandonnée

function appUrl() {
  return (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://lokt.fr").replace(/\/$/, "");
}

async function alreadySent(userId: string) {
  const { data, error } = await supabaseAdmin!
    .from("signup_confirmation_reminder_sends")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return !!data;
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
      const age = now - new Date(u.created_at).getTime();
      return age >= MIN_AGE_MS && age <= MAX_AGE_MS;
    });

    let sent = 0;
    let skipped = 0;
    const results: any[] = [];

    for (const user of candidates) {
      try {
        if (await alreadySent(user.id)) {
          skipped++;
          continue;
        }

        const { error: resendError } = await supabaseAdmin.auth.resend({
          type: "signup",
          email: user.email,
          options: { emailRedirectTo: `${baseUrl}/mon-compte?mode=login` },
        });
        if (resendError) throw resendError;

        const { error: insertError } = await supabaseAdmin.from("signup_confirmation_reminder_sends").insert({
          user_id: user.id,
          email: user.email,
        });
        if (insertError) throw insertError;

        sent++;
        results.push({ userId: user.id, email: user.email, sent: true });
      } catch (e: any) {
        skipped++;
        results.push({ userId: user.id, email: user.email, sent: false, error: e?.message || String(e) });
      }
    }

    return res.status(200).json({ ok: true, candidates: candidates.length, sent, skipped, results });
  } catch (e: any) {
    console.error("[cron/signup-confirmation-reminder] error:", e);
    return res.status(500).json({ error: e?.message || "Erreur interne" });
  }
}
