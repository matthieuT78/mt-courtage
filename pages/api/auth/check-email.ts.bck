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

export default async function handler(req: NextApiRequest, res: NextApiResponse<Resp>) {
  if (req.method !== "POST") return res.status(405).json({ exists: false, error: "Method not allowed" });

  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    if (!email) return res.status(400).json({ exists: false, error: "Email manquant" });

    // ✅ Fonction admin prévue pour ça
    const { data, error } = await supabaseAdmin.auth.admin.getUserByEmail(email);

    if (error) {
      // Si Supabase renvoie une erreur "not found", on considère que ça n'existe pas
      // (selon versions, c'est parfois une error, parfois data.user = null)
      const msg = (error.message || "").toLowerCase();
      if (msg.includes("not found") || msg.includes("user not found")) {
        return res.status(200).json({ exists: false });
      }
      return res.status(500).json({ exists: false, error: error.message });
    }

    return res.status(200).json({ exists: !!data?.user });
  } catch (e: any) {
    return res.status(500).json({ exists: false, error: e?.message || "Erreur serveur" });
  }
}
