import type { NextApiRequest, NextApiResponse } from "next";
import { hasValidCronSecret } from "../../../lib/cronAuth";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { sendEmailViaResend } from "../../../lib/mailer/resend";
import { buildNoPropertyEmail, buildNoLeaseEmail } from "../../../lib/lifecycleEmails";
import { alertCronFailures } from "../../../lib/cronAlert";

const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_AGE_MS = 5 * DAY_MS;

function appUrl() {
  return (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://lokt.fr").replace(/\/$/, "");
}

async function alreadySent(userId: string, emailKey: string) {
  const { data, error } = await supabaseAdmin!
    .from("lifecycle_email_sends")
    .select("id")
    .eq("user_id", userId)
    .eq("email_key", emailKey)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

async function markSent(userId: string, emailKey: string) {
  const { error } = await supabaseAdmin!.from("lifecycle_email_sends").insert({ user_id: userId, email_key: emailKey });
  if (error) throw error;
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
    const debug = String(req.query.debug || "") === "1";

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
      if (!u.email_confirmed_at) return false;
      if (u.user_metadata?.account_type === "tenant") return false;
      if (!u.email || !u.created_at) return false;
      const age = now - new Date(u.created_at).getTime();
      return age >= MIN_AGE_MS;
    });

    let sent = 0;
    let skipped = 0;
    const results: any[] = [];

    for (const user of candidates) {
      try {
        const [{ count: propertyCount }, { count: tenantCount }, { count: leaseCount }] = await Promise.all([
          supabaseAdmin.from("properties").select("id", { count: "exact", head: true }).eq("user_id", user.id),
          supabaseAdmin.from("tenants").select("id", { count: "exact", head: true }).eq("user_id", user.id),
          supabaseAdmin.from("leases").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        ]);

        const landlordName = String(user.user_metadata?.full_name || user.user_metadata?.first_name || "").trim();

        let emailKey: string | null = null;
        let built: { subject: string; html: string } | null = null;

        if (!propertyCount) {
          emailKey = "no_property_5d";
          built = buildNoPropertyEmail({ baseUrl, landlordName });
        } else if (propertyCount > 0 && (tenantCount || 0) > 0 && !leaseCount) {
          emailKey = "no_lease_5d";
          built = buildNoLeaseEmail({ baseUrl, landlordName });
        }

        if (!emailKey || !built) {
          skipped++;
          if (debug) results.push({ userId: user.id, email: user.email, skip: "setup_complete_or_no_match" });
          continue;
        }

        if (await alreadySent(user.id, emailKey)) {
          skipped++;
          if (debug) results.push({ userId: user.id, email: user.email, skip: "already_sent", emailKey });
          continue;
        }

        const mail = await sendEmailViaResend({ to: user.email, subject: built.subject, html: built.html });
        if (!mail.ok) throw new Error(mail.error);

        await markSent(user.id, emailKey);
        sent++;
        results.push({ userId: user.id, email: user.email, sent: true, emailKey });
      } catch (e: any) {
        skipped++;
        results.push({ userId: user.id, email: user.email, sent: false, error: e?.message || String(e) });
      }
    }

    const failures = results.filter((r) => r.sent === false);
    await alertCronFailures("lifecycle-emails", failures.map((f) => ({ email: f.email, error: f.error })));

    return res.status(200).json({ ok: true, candidates: candidates.length, sent, skipped, ...(debug ? { results } : {}) });
  } catch (e: any) {
    console.error("[cron/lifecycle-emails] error:", e);
    return res.status(500).json({ error: e?.message || "Erreur interne" });
  }
}
