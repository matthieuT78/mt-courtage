// pages/api/auth/check-email.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

type Resp = { exists: boolean; error?: string };

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  }
);

function normEmail(v: unknown) {
  return String(v || "").trim().toLowerCase();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<Resp>) {
  if (req.method !== "POST") return res.status(405).json({ exists: false, error: "Method not allowed" });

  try {
    const email = normEmail(req.body?.email);
    if (!email) return res.status(400).json({ exists: false, error: "Email manquant" });

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ exists: false, error: "SUPABASE_SERVICE_ROLE_KEY manquant" });
    }

    // ⚠️ On pagine et on cherche côté serveur (compatible SDK qui n'a pas getUserByEmail)
    const PER_PAGE = 1000;
    const MAX_PAGES = 20; // 20k users max scannés (à ajuster)

    for (let page = 1; page <= MAX_PAGES; page++) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: PER_PAGE });
      if (error) return res.status(500).json({ exists: false, error: error.message });

      const users = data?.users || [];
      const found = users.some((u: any) => normEmail(u?.email) === email);
      if (found) return res.status(200).json({ exists: true });

      // si on a moins que PER_PAGE, c'est la dernière page
      if (users.length < PER_PAGE) break;
    }

    return res.status(200).json({ exists: false });
  } catch (e: any) {
    return res.status(500).json({ exists: false, error: e?.message || "Erreur serveur" });
  }
}
