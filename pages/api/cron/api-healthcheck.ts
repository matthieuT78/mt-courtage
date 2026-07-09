// Healthcheck quotidien — toutes les APIs externes
// Envoie un email d'alerte si au moins une API est KO

import type { NextApiRequest, NextApiResponse } from "next";
import { hasValidCronSecret } from "../../../lib/cronAuth";

const ALERT_EMAIL = "matthieu.turbier@gmail.com";

type CheckResult = {
  name: string;
  ok: boolean;
  status?: number;
  latencyMs: number;
  error?: string;
};

async function probe(name: string, url: string, opts?: RequestInit): Promise<CheckResult> {
  const start = performance.now();
  try {
    const res = await fetch(url, {
      method: "GET",
      ...opts,
      signal: AbortSignal.timeout(8000),
    });
    return { name, ok: res.ok, status: res.status, latencyMs: Math.round(performance.now() - start) };
  } catch (e: any) {
    return { name, ok: false, latencyMs: Math.round(performance.now() - start), error: e?.message ?? "timeout" };
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!hasValidCronSecret(req)) return res.status(401).json({ error: "Unauthorized" });

  const RESEND_KEY = process.env.RESEND_API_KEY;
  const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
  const INSEE_TOKEN = process.env.INSEE_API_TOKEN;

  const checks = await Promise.all([
    probe("Stripe", "https://api.stripe.com/v1/products?limit=1", {
      headers: { Authorization: `Bearer ${STRIPE_KEY}` },
    }),
    probe("Resend", "https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${RESEND_KEY}` },
    }),
    probe("Geo API Gouv (villes)", "https://geo.api.gouv.fr/communes?nom=Paris&limit=1"),
    probe("API Adresse Gouv", "https://api-adresse.data.gouv.fr/search/?q=Paris&limit=1"),
    probe("Open-Meteo", "https://api.open-meteo.com/v1/forecast?latitude=48.86&longitude=2.35&current=temperature_2m"),
    probe("INSEE BDM (IRL)", "https://api.insee.fr/series/BDM/V1/data/SERIES_BDM/001515333?format=json&lastNObservations=1", {
      headers: INSEE_TOKEN ? { Authorization: `Bearer ${INSEE_TOKEN}` } : {},
    }),
  ]);

  const failed = checks.filter((c) => !c.ok);

  if (failed.length > 0 && RESEND_KEY) {
    const statusColor = (ok: boolean) => (ok ? "#16a34a" : "#dc2626");
    const statusLabel = (ok: boolean) => (ok ? "✓ OK" : "✗ KO");
    const rows = checks
      .map(
        (c) => `<tr style="background:${c.ok ? "#f0fdf4" : "#fef2f2"}">
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-weight:500">${c.name}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-weight:bold;color:${statusColor(c.ok)}">${statusLabel(c.ok)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${c.status ?? "—"}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${c.latencyMs} ms</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:12px">${c.error ?? ""}</td>
      </tr>`
      )
      .join("");

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "lokt.fr <alerts@lokt.fr>",
        to: ALERT_EMAIL,
        subject: `⚠️ lokt.fr — ${failed.length} API KO : ${failed.map((f) => f.name).join(", ")}`,
        html: `
<div style="font-family:sans-serif;max-width:640px;margin:0 auto">
  <p>Healthcheck quotidien lokt.fr — <strong style="color:#dc2626">${failed.length} API${failed.length > 1 ? "s" : ""} en erreur</strong>.</p>
  <table style="border-collapse:collapse;font-size:14px;width:100%">
    <thead>
      <tr style="background:#f3f4f6;text-align:left">
        <th style="padding:8px 12px">API</th>
        <th style="padding:8px 12px">Statut</th>
        <th style="padding:8px 12px">HTTP</th>
        <th style="padding:8px 12px">Latence</th>
        <th style="padding:8px 12px">Erreur</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <p style="color:#6b7280;font-size:12px;margin-top:16px">Cron /api/cron/api-healthcheck — quotidien 6h30 UTC</p>
</div>`,
      }),
    });
  }

  return res.status(200).json({ ok: failed.length === 0, total: checks.length, failed: failed.length, checks });
}
