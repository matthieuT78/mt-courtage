// pages/api/upsert.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { requireApiUser, requireMatchingUser } from "../../lib/apiAuth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!supabaseAdmin) return res.status(500).json({ error: "Supabase admin non configuré." });

  try {
    const auth = await requireApiUser(req);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

    const body = req.body ?? {};
    const userId = typeof body.userId === "string" ? body.userId : "";
    const profile = (body.profile && typeof body.profile === "object") ? body.profile : {};

    if (!userId) return res.status(400).json({ error: "userId requis" });
    const userCheck = requireMatchingUser(auth, userId);
    if (!userCheck.ok) return res.status(userCheck.status).json({ error: userCheck.error });

    const payload = {
      id: userId,
      ...profile,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabaseAdmin
      .from("profiles")
      .upsert(payload, { onConflict: "id" });

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "Erreur serveur" });
  }
}
