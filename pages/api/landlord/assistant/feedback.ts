// pages/api/landlord/assistant/feedback.ts
//
// Enregistre un vote pouce haut/bas sur une réponse de Loky, avec la question
// et la réponse concernées — sert uniquement au monitoring interne (page
// admin locale), jamais affiché à l'utilisateur lui-même.
import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../../../lib/apiAuth";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    if (!supabaseAdmin) return res.status(500).json({ error: "Supabase admin non configuré." });

    const auth = await requireApiUser(req);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

    const { rating, question, response } = (req.body || {}) as { rating?: string; question?: string; response?: string };
    if (rating !== "up" && rating !== "down") return res.status(400).json({ error: "rating doit être 'up' ou 'down'." });
    if (!response || !String(response).trim()) return res.status(400).json({ error: "response requis." });

    const { error } = await supabaseAdmin.from("assistant_feedback").insert({
      user_id: auth.userId,
      rating,
      question: question ? String(question).trim() : null,
      response: String(response).trim(),
    });
    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json({ ok: true });
  } catch (error: any) {
    console.error("[api/landlord/assistant/feedback] error:", error);
    return res.status(500).json({ error: error?.message || "Erreur interne." });
  }
}
