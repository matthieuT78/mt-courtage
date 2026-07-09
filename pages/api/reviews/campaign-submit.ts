import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

const ADMIN_EMAIL = "matthieu.turbier@gmail.com";
const RESEND_KEY = process.env.RESEND_API_KEY;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://lokt.fr";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();
  if (!supabaseAdmin) return res.status(500).json({ error: "Supabase indisponible" });

  const { email, name, note, commentaire, source } = req.body ?? {};

  if (!email || typeof email !== "string") return res.status(400).json({ error: "Email requis" });
  if (!note || note < 1 || note > 5) return res.status(400).json({ error: "Note invalide (1-5)" });
  if (!commentaire || commentaire.trim().length < 10) return res.status(400).json({ error: "Commentaire trop court (10 car. min.)" });

  const { data, error } = await supabaseAdmin
    .from("reviews")
    .insert({
      email,
      name: name?.trim() || null,
      note,
      commentaire: commentaire.trim(),
      source: source ?? "direct",
    })
    .select("id, approval_token")
    .single();

  if (error) return res.status(500).json({ error: error.message });

  if (RESEND_KEY) {
    const approveUrl = `${SITE_URL}/api/reviews/approve?id=${data.id}&token=${data.approval_token}`;
    const stars = "★".repeat(note) + "☆".repeat(5 - note);

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "lokt.fr <alerts@lokt.fr>",
        to: ADMIN_EMAIL,
        subject: `⭐ Nouvel avis lokt.fr — ${note}/5 de ${name || email}`,
        html: `
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1f2937">
  <h2 style="color:#0f172a">Nouvel avis à approuver</h2>
  <p>
    <strong>De :</strong> ${name || "—"} (${email})<br>
    <strong>Note :</strong> <span style="color:#f59e0b;font-size:18px">${stars}</span> (${note}/5)<br>
    <strong>Source :</strong> ${source ?? "direct"}
  </p>
  <blockquote style="border-left:3px solid #06b6d4;margin:16px 0;padding:12px 16px;background:#f0f9ff;border-radius:4px;font-style:italic">
    "${commentaire}"
  </blockquote>
  <a href="${approveUrl}"
     style="display:inline-block;margin-top:8px;padding:12px 28px;background:#0891b2;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">
    ✅ Approuver et publier
  </a>
  <p style="color:#6b7280;font-size:12px;margin-top:24px">
    Cliquer publie l'avis immédiatement sur lokt.fr.
  </p>
</div>`,
      }),
    });
  }

  return res.status(200).json({ ok: true });
}
