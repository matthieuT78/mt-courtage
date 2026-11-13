// Rappel ponctuel, à usage unique — PAS un système générique de rappel de
// fin d'essai (ça viendra plus tard, côté client, cf. décision du
// 2026-11-13). Sert uniquement à prévenir Matthieu avant l'échéance du
// geste commercial accordé à Nadia Gabriel (3 mois lokt·plus offerts,
// cf. issue #2) — à supprimer (code + job cron-job.org) une fois passé.
import type { NextApiRequest, NextApiResponse } from "next";
import { hasValidCronSecret } from "../../../lib/cronAuth";
import { sendEmailViaResend } from "../../../lib/mailer/resend";

const ALERT_EMAIL = "matthieu.turbier@gmail.com";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!hasValidCronSecret(req)) return res.status(401).json({ ok: false, error: "Unauthorized" });

  const result = await sendEmailViaResend({
    to: ALERT_EMAIL,
    subject: "Rappel — fin du geste commercial Nadia Gabriel le 13/02/2027",
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <p>Rappel ponctuel : l'accès lokt·plus offert à <b>Nadia Gabriel</b> (nadia.gabriel.work@gmail.com) suite à l'incident de double facturation du 13/11/2026 expire le <b>13 février 2027</b>.</p>
        <p>À faire avant cette date : décider avec elle si elle souscrit un abonnement payant ou repasse en gratuit, et envoyer le mail de rappel côté cliente (pas encore automatisé).</p>
        <p style="color:#6b7280;font-size:12px">Ce job cron-job.org et cet endpoint sont à usage unique — à supprimer après envoi.</p>
      </div>`,
  });

  return res.status(200).json({ ok: result.ok, error: result.ok ? undefined : result.error });
}
