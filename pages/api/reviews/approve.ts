import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id, token } = req.query;

  if (!id || !token || typeof id !== "string" || typeof token !== "string") {
    return res.status(400).send("Lien invalide.");
  }

  if (!supabaseAdmin) return res.status(500).send("Erreur serveur.");

  const { data, error } = await supabaseAdmin
    .from("reviews")
    .update({ approved: true })
    .eq("id", id)
    .eq("approval_token", token)
    .select("name, email, note")
    .single();

  if (error || !data) {
    return res.status(404).send("Avis introuvable ou lien expiré.");
  }

  const stars = "★".repeat(data.note) + "☆".repeat(5 - data.note);

  return res.status(200).send(`
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><title>Avis approuvé — lokt.fr</title>
<style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f1f5f9}
.card{background:#fff;border-radius:16px;padding:40px;max-width:420px;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,.08)}
h1{color:#0f172a;margin:0 0 8px}p{color:#475569}
.stars{font-size:28px;color:#f59e0b;margin:16px 0}
a{color:#0891b2;text-decoration:none;font-weight:600}</style>
</head>
<body>
<div class="card">
  <div class="stars">${stars}</div>
  <h1>Avis publié ✅</h1>
  <p><strong>${data.name || data.email}</strong> — ${data.note}/5</p>
  <p style="margin-top:24px"><a href="https://lokt.fr">← Retour sur lokt.fr</a></p>
</div>
</body>
</html>`);
}
