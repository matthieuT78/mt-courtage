import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { sendEmailViaResend } from "../../../lib/mailer/resend";
import { hasValidCronSecret } from "../../../lib/cronAuth";

const DIGEST_TO = "matthieu.turbier@gmail.com";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!hasValidCronSecret(req)) return res.status(401).json({ error: "unauthorized" });

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: rows, error } = await supabaseAdmin
    .from("error_logs")
    .select("id, created_at, source, error_message, url, user_id")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return res.status(500).json({ error: error.message });

  if (!rows || rows.length === 0) {
    return res.status(200).json({ ok: true, sent: false, reason: "no errors in last 24h" });
  }

  const bySource: Record<string, typeof rows> = {};
  for (const r of rows) {
    const s = r.source ?? "unknown";
    bySource[s] = bySource[s] ?? [];
    bySource[s].push(r);
  }

  const tableRows = rows
    .slice(0, 50)
    .map(
      (r) => `
    <tr style="border-bottom:1px solid #f1f5f9;">
      <td style="padding:6px 10px;font-size:12px;color:#64748b;white-space:nowrap;">${new Date(r.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" })}</td>
      <td style="padding:6px 10px;font-size:12px;"><span style="background:${r.source === "client" ? "#fef3c7" : "#fce7f3"};padding:2px 6px;border-radius:4px;font-size:11px;">${r.source}</span></td>
      <td style="padding:6px 10px;font-size:12px;color:#0f172a;max-width:380px;word-break:break-word;">${escHtml(r.error_message ?? "")}</td>
      <td style="padding:6px 10px;font-size:11px;color:#64748b;max-width:200px;word-break:break-all;">${r.url ? escHtml(r.url.replace(/https?:\/\/[^/]+/, "")) : "—"}</td>
    </tr>`
    )
    .join("");

  const summary = Object.entries(bySource)
    .map(([s, arr]) => `<strong>${arr.length}</strong> ${s}`)
    .join(" · ");

  const html = `
<!DOCTYPE html>
<html>
<body style="font-family:system-ui,sans-serif;background:#f8fafc;padding:24px;color:#0f172a;">
  <div style="max-width:700px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
    <div style="background:#3535D4;padding:16px 24px;">
      <span style="color:#fff;font-weight:800;font-size:18px;">lokt.fr · Digest erreurs</span>
      <span style="color:#a5b4fc;font-size:13px;margin-left:16px;">${new Date().toLocaleDateString("fr-FR", { timeZone: "Europe/Paris", weekday: "long", day: "numeric", month: "long" })}</span>
    </div>
    <div style="padding:20px 24px;">
      <p style="margin:0 0 16px;font-size:14px;">
        <strong>${rows.length} erreur${rows.length > 1 ? "s" : ""}</strong> sur les dernières 24h — ${summary}
        ${rows.length > 50 ? `<br><span style="color:#ef4444;font-size:12px;">⚠ Tableau limité aux 50 premières</span>` : ""}
      </p>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="background:#f8fafc;">
            <th style="padding:8px 10px;text-align:left;font-size:11px;color:#64748b;font-weight:600;">Heure</th>
            <th style="padding:8px 10px;text-align:left;font-size:11px;color:#64748b;font-weight:600;">Source</th>
            <th style="padding:8px 10px;text-align:left;font-size:11px;color:#64748b;font-weight:600;">Message</th>
            <th style="padding:8px 10px;text-align:left;font-size:11px;color:#64748b;font-weight:600;">URL</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>
    <div style="padding:12px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;">
      lokt.fr error digest · cron quotidien 08h00 · <a href="https://app.supabase.com" style="color:#3535D4;">Supabase → error_logs</a>
    </div>
  </div>
</body>
</html>`;

  const result = await sendEmailViaResend({
    to: DIGEST_TO,
    subject: `[lokt.fr] ${rows.length} erreur${rows.length > 1 ? "s" : ""} — ${new Date().toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" })}`,
    html,
  });

  return res.status(200).json({ ok: result.ok, sent: true, count: rows.length });
}

function escHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
