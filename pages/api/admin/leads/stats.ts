import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN!;

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function requireAdmin(req: NextApiRequest, res: NextApiResponse) {
  const token = (req.headers["x-admin-token"] as string) || (req.query.token as string) || "";
  if (!ADMIN_TOKEN || token !== ADMIN_TOKEN) {
    res.status(401).json({ ok: false, error: "Unauthorized" });
    return false;
  }
  return true;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "Method not allowed" });
  if (!requireAdmin(req, res)) return;

  try {
    const days = Math.min(Math.max(parseInt((req.query.days as string) || "30", 10), 1), 365);

    // Total
    const { count: total, error: eTotal } = await supabaseAdmin
      .from("leads")
      .select("id", { count: "exact", head: true });
    if (eTotal) throw eTotal;

    // By tool
    const { data: rowsTool, error: eTool } = await supabaseAdmin
      .from("leads")
      .select("tool");
    if (eTool) throw eTool;

    const byToolMap = new Map<string, number>();
    for (const r of rowsTool || []) byToolMap.set(r.tool, (byToolMap.get(r.tool) || 0) + 1);
    const byTool = Array.from(byToolMap.entries())
      .map(([tool, count]) => ({ tool, count }))
      .sort((a, b) => b.count - a.count);

    // Status distribution
    const { data: rowsStatus, error: eStatus } = await supabaseAdmin
      .from("leads")
      .select("status");
    if (eStatus) throw eStatus;

    const byStatusMap = new Map<string, number>();
    for (const r of rowsStatus || []) {
      const s = (r.status || "null") as string;
      byStatusMap.set(s, (byStatusMap.get(s) || 0) + 1);
    }
    const byStatus = Array.from(byStatusMap.entries())
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count);

    // Consent rates
    const { data: rowsConsent, error: eConsent } = await supabaseAdmin
      .from("leads")
      .select("consent_analysis, consent_contact");
    if (eConsent) throw eConsent;

    let consentAnalysisYes = 0;
    let consentContactYes = 0;
    for (const r of rowsConsent || []) {
      if (r.consent_analysis) consentAnalysisYes++;
      if (r.consent_contact) consentContactYes++;
    }

    // Time series last N days (grouping côté Node pour rester simple)
    const sinceIso = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();
    const { data: rowsRecent, error: eRecent } = await supabaseAdmin
      .from("leads")
      .select("created_at")
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: true });
    if (eRecent) throw eRecent;

    const byDayMap = new Map<string, number>();
    for (const r of rowsRecent || []) {
      const day = new Date(r.created_at).toISOString().slice(0, 10); // YYYY-MM-DD
      byDayMap.set(day, (byDayMap.get(day) || 0) + 1);
    }
    const byDay = Array.from(byDayMap.entries())
      .map(([day, count]) => ({ day, count }))
      .sort((a, b) => (a.day < b.day ? -1 : 1));

    return res.status(200).json({
      ok: true,
      total: total || 0,
      byTool,
      byStatus,
      consents: {
        consent_analysis_yes: consentAnalysisYes,
        consent_contact_yes: consentContactYes,
        consent_analysis_rate: total ? consentAnalysisYes / total : 0,
        consent_contact_rate: total ? consentContactYes / total : 0,
      },
      byDay,
      window_days: days,
    });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || "Server error" });
  }
}
