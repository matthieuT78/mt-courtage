import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../../lib/apiAuth";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Méthode non autorisée." });
  }

  const auth = await requireApiUser(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const rating = Number(req.body?.rating);
  const comment = typeof req.body?.comment === "string" ? req.body.comment.trim().slice(0, 2000) : null;

  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ error: "Note invalide (1 à 5)." });
  }

  if (!supabaseAdmin) return res.status(500).json({ error: "DB indisponible." });

  // Un seul avis par utilisateur
  const { data: existing } = await supabaseAdmin
    .from("app_reviews")
    .select("id")
    .eq("user_id", auth.userId)
    .maybeSingle();

  if (existing) return res.status(200).json({ ok: true, already: true });

  const { error } = await supabaseAdmin.from("app_reviews").insert({
    user_id: auth.userId,
    rating,
    comment: comment || null,
  });

  if (error) {
    try {
      await supabaseAdmin.from("error_logs").insert({
        source: "server",
        error_message: `reviews/submit insert failed: ${error.message}`,
        user_id: auth.userId,
        extra: { rating },
      });
    } catch {
      // Le journal d'erreurs ne doit pas bloquer la réponse d'erreur d'origine.
    }
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ ok: true });
}
