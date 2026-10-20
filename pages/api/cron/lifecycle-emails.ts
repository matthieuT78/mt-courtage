import type { NextApiRequest, NextApiResponse } from "next";
import { hasValidCronSecret } from "../../../lib/cronAuth";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { sendEmailViaResend } from "../../../lib/mailer/resend";
import { buildNoPropertyEmail, buildNoTenantEmail, buildNoLeaseEmail } from "../../../lib/lifecycleEmails";
import { buildUnsubscribeUrl } from "../../../lib/lifecycleUnsubscribe";
import { alertCronFailures } from "../../../lib/cronAlert";

const DAY_MS = 24 * 60 * 60 * 1000;
const FIRST_TOUCH_AGE_MS = 5 * DAY_MS;
const REPEAT_INTERVAL_MS = 7 * DAY_MS;
const MAX_ATTEMPTS = 4;

type FunnelState = "no_property" | "no_tenant" | "no_lease";

// Les clés en base gardent le suffixe "_5d" (historique, de l'époque où
// l'envoi était unique à J+5) pour que les envois déjà enregistrés comptent
// bien dans l'historique des tentatives — renommer la clé aurait fait repartir
// le compteur de certains comptes à zéro.
const EMAIL_KEYS: Record<FunnelState, string> = {
  no_property: "no_property_5d",
  no_tenant: "no_tenant_5d",
  no_lease: "no_lease_5d",
};

function appUrl() {
  return (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://lokt.fr").replace(/\/$/, "");
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
    const dryRun = String(req.query.dryRun || "") === "1";

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
      return now - new Date(u.created_at).getTime() >= FIRST_TOUCH_AGE_MS;
    });

    const [{ data: optouts, error: optoutsError }, { data: sends, error: sendsError }] = await Promise.all([
      supabaseAdmin.from("lifecycle_email_optouts").select("user_id"),
      supabaseAdmin.from("lifecycle_email_sends").select("user_id,email_key,sent_at"),
    ]);
    if (optoutsError) throw optoutsError;
    if (sendsError) throw sendsError;

    const optedOutIds = new Set((optouts || []).map((o: any) => o.user_id));
    const sendsByUserKey = new Map<string, number[]>();
    for (const s of (sends || []) as any[]) {
      const mapKey = `${s.user_id}:${s.email_key}`;
      if (!sendsByUserKey.has(mapKey)) sendsByUserKey.set(mapKey, []);
      sendsByUserKey.get(mapKey)!.push(new Date(s.sent_at).getTime());
    }

    let sent = 0;
    let skipped = 0;
    const results: any[] = [];

    for (const user of candidates) {
      try {
        if (optedOutIds.has(user.id)) {
          skipped++;
          if (debug) results.push({ userId: user.id, email: user.email, skip: "opted_out" });
          continue;
        }

        const [{ count: propertyCount }, { count: tenantCount }, { count: leaseCount }] = await Promise.all([
          supabaseAdmin.from("properties").select("id", { count: "exact", head: true }).eq("user_id", user.id),
          supabaseAdmin.from("tenants").select("id", { count: "exact", head: true }).eq("user_id", user.id),
          supabaseAdmin.from("leases").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        ]);

        let state: FunnelState | null = null;
        if (!propertyCount) state = "no_property";
        else if (!tenantCount) state = "no_tenant";
        else if (!leaseCount) state = "no_lease";

        if (!state) {
          skipped++;
          if (debug) results.push({ userId: user.id, email: user.email, skip: "setup_complete" });
          continue;
        }

        const emailKey = EMAIL_KEYS[state];
        const history = (sendsByUserKey.get(`${user.id}:${emailKey}`) || []).sort((a, b) => a - b);
        const attemptsSoFar = history.length;

        if (attemptsSoFar >= MAX_ATTEMPTS) {
          skipped++;
          if (debug) results.push({ userId: user.id, email: user.email, skip: "max_attempts_reached", state });
          continue;
        }

        const lastSentAt = history[attemptsSoFar - 1] ?? null;
        const eligible = lastSentAt === null ? true : now - lastSentAt >= REPEAT_INTERVAL_MS;

        if (!eligible) {
          skipped++;
          if (debug) results.push({ userId: user.id, email: user.email, skip: "too_soon", state, lastSentAt: new Date(lastSentAt!).toISOString() });
          continue;
        }

        const landlordName = String(user.user_metadata?.full_name || user.user_metadata?.first_name || "").trim();
        const attemptNumber = attemptsSoFar + 1;
        const unsubscribeHref = buildUnsubscribeUrl(baseUrl, user.id);
        const emailParams = { baseUrl, landlordName, unsubscribeHref, attemptNumber };

        const built =
          state === "no_property"
            ? buildNoPropertyEmail(emailParams)
            : state === "no_tenant"
            ? buildNoTenantEmail(emailParams)
            : buildNoLeaseEmail(emailParams);

        if (dryRun) {
          sent++;
          results.push({ userId: user.id, email: user.email, dryRun: true, state, attemptNumber, subject: built.subject });
          continue;
        }

        const mail = await sendEmailViaResend({ to: user.email, subject: built.subject, html: built.html });
        if (!mail.ok) throw new Error(mail.error);

        await markSent(user.id, emailKey);
        sent++;
        results.push({ userId: user.id, email: user.email, sent: true, state, attemptNumber });
      } catch (e: any) {
        skipped++;
        results.push({ userId: user.id, email: user.email, sent: false, error: e?.message || String(e) });
      }
    }

    const failures = results.filter((r) => r.sent === false && r.error);
    await alertCronFailures("lifecycle-emails", failures.map((f) => ({ email: f.email, error: f.error })));

    return res.status(200).json({ ok: true, dryRun, candidates: candidates.length, sent, skipped, ...(debug ? { results } : {}) });
  } catch (e: any) {
    console.error("[cron/lifecycle-emails] error:", e);
    // Panne avant même la boucle par utilisateur (ex: listUsers ou les requêtes
    // optouts/sends échouent) : sans alerte ici, ce cron ne tournant pas sur
    // cron-job.org, rien ne le remonterait jamais — même angle mort que celui
    // documenté dans alertCronFailures pour signup-confirmation-reminder.
    await alertCronFailures("lifecycle-emails", [{ error: `Échec complet du cron : ${e?.message || String(e)}` }]);
    return res.status(500).json({ error: e?.message || "Erreur interne" });
  }
}
