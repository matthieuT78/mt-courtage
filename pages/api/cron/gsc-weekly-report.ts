import type { NextApiRequest, NextApiResponse } from "next";
import { GoogleAuth } from "google-auth-library";
import { sendEmailViaResend } from "../../../lib/mailer/resend";
import { hasValidCronSecret } from "../../../lib/cronAuth";

const SITE = "sc-domain:lokt.fr";
const BASE = "https://searchconsole.googleapis.com/webmasters/v3/sites";
const OWNER_EMAIL = "matthieu.turbier@gmail.com";

function fmtDate(d: Date) {
  return d.toISOString().split("T")[0];
}

function fmtNum(n: number) {
  return n.toLocaleString("fr-FR");
}

function trend(curr: number, prev: number): { symbol: string; color: string; pct: string } {
  if (prev === 0 && curr === 0) return { symbol: "→", color: "#94a3b8", pct: "—" };
  if (prev === 0) return { symbol: "↑", color: "#10b981", pct: "+∞" };
  const diff = ((curr - prev) / prev) * 100;
  if (diff > 5) return { symbol: "↑", color: "#10b981", pct: `+${diff.toFixed(0)}%` };
  if (diff < -5) return { symbol: "↓", color: "#ef4444", pct: `${diff.toFixed(0)}%` };
  return { symbol: "→", color: "#94a3b8", pct: `${diff.toFixed(0)}%` };
}

async function queryGSC(client: Awaited<ReturnType<GoogleAuth["getClient"]>>, startDate: string, endDate: string, dimensions: string[], rowLimit = 50) {
  const res: any = await client.request({
    url: `${BASE}/${encodeURIComponent(SITE)}/searchAnalytics/query`,
    method: "POST",
    data: { startDate, endDate, dimensions, rowLimit, type: "web" },
  });
  return (res.data?.rows || []) as Array<{ keys: string[]; clicks: number; impressions: number; ctr: number; position: number }>;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!hasValidCronSecret(req)) return res.status(401).json({ error: "unauthorized" });

  const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_B64;
  if (!b64) return res.status(500).json({ error: "GOOGLE_SERVICE_ACCOUNT_JSON_B64 manquante" });

  let client: Awaited<ReturnType<GoogleAuth["getClient"]>>;
  try {
    const keyJson = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
    const auth = new GoogleAuth({
      credentials: keyJson,
      scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
    });
    client = await auth.getClient();
  } catch (e: any) {
    return res.status(500).json({ error: `Auth GSC failed: ${e?.message}` });
  }

  // Périodes : semaine courante vs semaine précédente
  const now = new Date();
  const end = new Date(now); end.setDate(end.getDate() - 2); // GSC a 2j de délai
  const start = new Date(end); start.setDate(start.getDate() - 6);
  const prevEnd = new Date(start); prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd); prevStart.setDate(prevStart.getDate() - 6);

  const [sd, ed, psd, ped] = [fmtDate(start), fmtDate(end), fmtDate(prevStart), fmtDate(prevEnd)];

  try {
    const [currQueries, currPages, prevQueries, prevPages, currDaily] = await Promise.all([
      queryGSC(client, sd, ed, ["query"], 50),
      queryGSC(client, sd, ed, ["page"], 25),
      queryGSC(client, psd, ped, ["query"], 50),
      queryGSC(client, psd, ped, ["page"], 25),
      queryGSC(client, sd, ed, ["date"], 7),
    ]);

    // Totaux
    const curr = currQueries.reduce((a, r) => ({ clicks: a.clicks + r.clicks, impr: a.impr + r.impressions }), { clicks: 0, impr: 0 });
    const prev = prevQueries.reduce((a, r) => ({ clicks: a.clicks + r.clicks, impr: a.impr + r.impressions }), { clicks: 0, impr: 0 });
    const tClicks = trend(curr.clicks, prev.clicks);
    const tImpr = trend(curr.impr, prev.impr);

    // Map précédente semaine pour comparaison rapide
    const prevQMap = new Map(prevQueries.map(r => [r.keys[0], r]));
    const prevPMap = new Map(prevPages.map(r => [r.keys[0], r]));

    // Opportunités : pos 4-20, CTR < 4%
    const opportunities = currQueries
      .filter(r => r.position >= 4 && r.position <= 20 && r.ctr < 0.04 && r.impressions >= 10)
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 10);

    // Requêtes en recul (position a empiré)
    const declining = currQueries
      .filter(r => {
        const p = prevQMap.get(r.keys[0]);
        return p && r.position > p.position + 2;
      })
      .sort((a, b) => {
        const pa = prevQMap.get(a.keys[0])!;
        const pb = prevQMap.get(b.keys[0])!;
        return (a.position - pa.position) - (b.position - pb.position);
      })
      .slice(0, 8);

    const html = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Rapport SEO lokt.fr — semaine du ${sd}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<div style="max-width:640px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

  <!-- Header -->
  <div style="background:linear-gradient(135deg,#635bff,#00d4ff);padding:28px 32px;">
    <div style="font-size:22px;font-weight:700;color:#fff;">lokt.fr — Rapport SEO hebdo</div>
    <div style="font-size:13px;color:rgba(255,255,255,0.8);margin-top:4px;">${sd} → ${ed} · vs semaine précédente (${psd} → ${ped})</div>
  </div>

  <!-- KPIs -->
  <div style="display:flex;gap:0;border-bottom:1px solid #e2e8f0;">
    ${[
      { label: "Clics", curr: curr.clicks, prev: prev.clicks, t: tClicks },
      { label: "Impressions", curr: curr.impr, prev: prev.impr, t: tImpr },
    ].map(k => `
    <div style="flex:1;padding:24px 32px;text-align:center;${k.label === "Impressions" ? "border-left:1px solid #e2e8f0;" : ""}">
      <div style="font-size:11px;font-weight:600;color:#94a3b8;letter-spacing:.05em;text-transform:uppercase;">${k.label}</div>
      <div style="font-size:32px;font-weight:700;color:#0f172a;margin:4px 0;">${fmtNum(k.curr)}</div>
      <div style="font-size:13px;color:${k.t.color};font-weight:600;">${k.t.symbol} ${k.t.pct} <span style="color:#94a3b8;font-weight:400;">vs sem. préc. (${fmtNum(k.prev)})</span></div>
    </div>`).join("")}
  </div>

  <!-- Top requêtes -->
  <div style="padding:24px 32px 0;">
    <div style="font-size:15px;font-weight:700;color:#0f172a;margin-bottom:12px;">Top requêtes</div>
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <thead><tr style="color:#94a3b8;text-align:left;">
        <th style="padding:6px 0;font-weight:500;">Requête</th>
        <th style="padding:6px 8px;font-weight:500;text-align:right;">Clics</th>
        <th style="padding:6px 8px;font-weight:500;text-align:right;">Impr.</th>
        <th style="padding:6px 0;font-weight:500;text-align:right;">Pos.</th>
      </tr></thead>
      <tbody>
        ${currQueries.slice(0, 12).map((r, i) => {
          const p = prevQMap.get(r.keys[0]);
          const tPos = p ? trend(p.position, r.position) : null; // inversé : baisse pos = amélioration
          return `<tr style="border-top:1px solid #f1f5f9;">
            <td style="padding:8px 0;color:#334155;max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${r.keys[0]}</td>
            <td style="padding:8px;text-align:right;font-weight:600;color:#0f172a;">${r.clicks}</td>
            <td style="padding:8px;text-align:right;color:#64748b;">${r.impressions}</td>
            <td style="padding:8px 0;text-align:right;color:#64748b;">${r.position.toFixed(1)}${tPos ? ` <span style="color:${tPos.color};font-size:11px;">${tPos.symbol}</span>` : ""}</td>
          </tr>`;
        }).join("")}
      </tbody>
    </table>
  </div>

  <!-- Top pages -->
  <div style="padding:24px 32px 0;">
    <div style="font-size:15px;font-weight:700;color:#0f172a;margin-bottom:12px;">Top pages</div>
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <thead><tr style="color:#94a3b8;text-align:left;">
        <th style="padding:6px 0;font-weight:500;">Page</th>
        <th style="padding:6px 8px;font-weight:500;text-align:right;">Clics</th>
        <th style="padding:6px 8px;font-weight:500;text-align:right;">CTR</th>
        <th style="padding:6px 0;font-weight:500;text-align:right;">Pos.</th>
      </tr></thead>
      <tbody>
        ${currPages.slice(0, 10).map(r => {
          const url = r.keys[0].replace(/https?:\/\/lokt\.fr/, "") || "/";
          const p = prevPMap.get(r.keys[0]);
          const ctrColor = r.ctr < 0.02 ? "#ef4444" : r.ctr < 0.04 ? "#f59e0b" : "#10b981";
          return `<tr style="border-top:1px solid #f1f5f9;">
            <td style="padding:8px 0;color:#334155;max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${url}</td>
            <td style="padding:8px;text-align:right;font-weight:600;color:#0f172a;">${r.clicks}</td>
            <td style="padding:8px;text-align:right;font-weight:600;color:${ctrColor};">${(r.ctr * 100).toFixed(1)}%</td>
            <td style="padding:8px 0;text-align:right;color:#64748b;">${r.position.toFixed(1)}</td>
          </tr>`;
        }).join("")}
      </tbody>
    </table>
  </div>

  ${opportunities.length > 0 ? `
  <!-- Quick wins -->
  <div style="padding:24px 32px 0;">
    <div style="font-size:15px;font-weight:700;color:#0f172a;margin-bottom:4px;">Quick wins — position 4–20, CTR faible</div>
    <div style="font-size:12px;color:#94a3b8;margin-bottom:12px;">Ces requêtes sont proches de la page 1 mais ne génèrent pas de clics</div>
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <thead><tr style="color:#94a3b8;text-align:left;">
        <th style="padding:6px 0;font-weight:500;">Requête</th>
        <th style="padding:6px 8px;font-weight:500;text-align:right;">Pos.</th>
        <th style="padding:6px 8px;font-weight:500;text-align:right;">Impr.</th>
        <th style="padding:6px 0;font-weight:500;text-align:right;">CTR</th>
      </tr></thead>
      <tbody>
        ${opportunities.map(r => `<tr style="border-top:1px solid #f1f5f9;">
          <td style="padding:8px 0;color:#334155;max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${r.keys[0]}</td>
          <td style="padding:8px;text-align:right;color:#f59e0b;font-weight:600;">${r.position.toFixed(1)}</td>
          <td style="padding:8px;text-align:right;color:#64748b;">${r.impressions}</td>
          <td style="padding:8px 0;text-align:right;color:#ef4444;">${(r.ctr * 100).toFixed(1)}%</td>
        </tr>`).join("")}
      </tbody>
    </table>
  </div>` : ""}

  ${declining.length > 0 ? `
  <!-- Requêtes en recul -->
  <div style="padding:24px 32px 0;">
    <div style="font-size:15px;font-weight:700;color:#0f172a;margin-bottom:4px;">Requêtes en recul</div>
    <div style="font-size:12px;color:#94a3b8;margin-bottom:12px;">Position > +2 par rapport à la semaine précédente</div>
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <thead><tr style="color:#94a3b8;text-align:left;">
        <th style="padding:6px 0;font-weight:500;">Requête</th>
        <th style="padding:6px 8px;font-weight:500;text-align:right;">Pos. actuelle</th>
        <th style="padding:6px 0;font-weight:500;text-align:right;">Pos. préc.</th>
      </tr></thead>
      <tbody>
        ${declining.map(r => {
          const p = prevQMap.get(r.keys[0])!;
          return `<tr style="border-top:1px solid #f1f5f9;">
            <td style="padding:8px 0;color:#334155;">${r.keys[0]}</td>
            <td style="padding:8px;text-align:right;color:#ef4444;font-weight:600;">${r.position.toFixed(1)}</td>
            <td style="padding:8px 0;text-align:right;color:#94a3b8;">${p.position.toFixed(1)}</td>
          </tr>`;
        }).join("")}
      </tbody>
    </table>
  </div>` : ""}

  <!-- Footer -->
  <div style="padding:24px 32px;margin-top:24px;border-top:1px solid #e2e8f0;text-align:center;color:#94a3b8;font-size:12px;">
    Rapport automatique lokt.fr · <a href="https://search.google.com/search-console" style="color:#635bff;text-decoration:none;">Ouvrir Search Console</a>
  </div>

</div>
</body>
</html>`;

    await sendEmailViaResend({
      to: OWNER_EMAIL,
      subject: `SEO lokt.fr — ${curr.clicks} clics · ${fmtNum(curr.impr)} impressions (sem. ${sd})`,
      html,
    });

    return res.status(200).json({ ok: true, period: `${sd} → ${ed}`, clicks: curr.clicks, impressions: curr.impr });
  } catch (e: any) {
    console.error("[gsc-weekly-report]", e?.message);
    return res.status(500).json({ error: e?.message || "unknown" });
  }
}
