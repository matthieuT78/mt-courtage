import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { verifyUnsubscribeToken } from "../../lib/lifecycleUnsubscribe";

function htmlPage(message: string) {
  return `<!doctype html>
<html lang="fr">
<head><meta charset="utf-8" /><title>lokt.fr</title></head>
<body style="font-family:Arial,sans-serif;background:#f1f5f9;margin:0;padding:48px 24px;">
  <div style="max-width:420px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:32px;text-align:center;">
    <p style="margin:0;font-size:15px;line-height:1.6;color:#0f172a;">${message}</p>
    <a href="https://lokt.fr" style="display:inline-block;margin-top:20px;color:#4f46e5;text-decoration:none;font-weight:700;font-size:14px;">Retour à lokt.fr</a>
  </div>
</body>
</html>`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = String(req.query.u || "");
  const sig = String(req.query.sig || "");

  if (!verifyUnsubscribeToken(userId, sig)) {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(400).send(htmlPage("Lien invalide ou expiré."));
  }
  if (!supabaseAdmin) {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(500).send(htmlPage("Une erreur est survenue, réessayez plus tard."));
  }

  const { error } = await supabaseAdmin.from("lifecycle_email_optouts").upsert({ user_id: userId }, { onConflict: "user_id" });
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  if (error) return res.status(500).send(htmlPage("Une erreur est survenue, réessayez plus tard."));

  return res.status(200).send(htmlPage("Vous ne recevrez plus ces emails de relance. Votre compte lokt.fr reste inchangé."));
}
