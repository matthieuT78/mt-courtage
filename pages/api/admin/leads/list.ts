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
    const page = Math.max(parseInt((req.query.page as string) || "1", 10), 1);
    const pageSize = Math.min(Math.max(parseInt((req.query.pageSize as string) || "25", 10), 5), 200);

    const tool = (req.query.tool as string) || "";
    const status = (req.query.status as string) || "";
    const q = ((req.query.q as string) || "").trim();

    let query = supabaseAdmin
      .from("leads")
      .select(
        "id, created_at, tool, user_id, email, phone, postal_code, city, consent_analysis, consent_contact, status",
        { count: "exact" }
      )
      .order("created_at", { ascending: false });

    if (tool) query = query.eq("tool", tool);
    if (status) query = query.eq("status", status);
    if (q) {
      // petit “search” simple sur email / ville / CP
      query = query.or(
        `email.ilike.%${q}%,city.ilike.%${q}%,postal_code.ilike.%${q}%`
      );
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, count, error } = await query.range(from, to);
    if (error) throw error;

    return res.status(200).json({
      ok: true,
      page,
      pageSize,
      total: count || 0,
      items: data || [],
    });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || "Server error" });
  }
}
