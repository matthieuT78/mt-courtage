import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const email = typeof req.query.email === "string" ? req.query.email.trim() : "";
  if (!email) return res.status(200).json({ exists: false });

  if (!supabaseAdmin) return res.status(500).json({ error: "Supabase admin non configuré." });

  // listUsers avec filtre email (v2 admin). Si ton SDK ne supporte pas "email", dis-moi ta version.
  const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1, email });
  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({ exists: (data?.users || []).length > 0 });
}
