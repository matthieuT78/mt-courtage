import type { NextApiRequest, NextApiResponse } from "next";
import { sendEmailViaResend } from "../../../lib/mailer/resend";
import { rateLimitEmailSendOrThrow } from "../../../lib/emailRateLimit";
import { getCityPriceData } from "../../../lib/cityPriceData";
import { citySlug, parseCitySlug } from "../../../lib/cityPriceSlug";

const SITE_URL = "https://lokt.fr";

function safeEmail(v: any) {
  return String(v || "").trim().toLowerCase();
}

function formatEur(n: number | null) {
  if (n == null) return "—";
  return `${Math.round(n).toLocaleString("fr-FR")} €`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    rateLimitEmailSendOrThrow(req);
    const email = safeEmail(req.body?.email);
    const slug = String(req.body?.slug || "");

    if (!email || !email.includes("@")) {
      return res.status(400).json({ ok: false, error: "Email invalide" });
    }

    const inseeCode = parseCitySlug(slug);
    if (!inseeCode) return res.status(400).json({ ok: false, error: "Ville invalide" });

    const city = await getCityPriceData(inseeCode);
    if (!city) return res.status(404).json({ ok: false, error: "Ville introuvable" });

    const pageUrl = `${SITE_URL}/prix-m2/${citySlug(city.cityName, city.inseeCode)}`;
    const rows = city.history
      .filter((h) => h.priceM2 != null)
      .map((h) => `<tr><td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;">${h.year}</td><td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;font-weight:600;">${formatEur(h.priceM2)}/m²</td></tr>`)
      .join("");

    const html = `
<div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;color:#0f172a;">
  <p style="font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:#635bff;font-weight:600;">Rapport prix immobilier</p>
  <h1 style="font-size:22px;margin:8px 0 16px;">${city.cityName} (${city.postalCode})</h1>
  <table style="border-collapse:collapse;width:100%;font-size:14px;margin-bottom:16px;">
    <tr><td style="padding:6px 10px;color:#64748b;">Prix médian</td><td style="padding:6px 10px;font-weight:700;font-size:18px;">${formatEur(city.priceM2)}/m²</td></tr>
    <tr><td style="padding:6px 10px;color:#64748b;">Loyer estimé</td><td style="padding:6px 10px;font-weight:600;">${city.rentM2 ? `${city.rentM2.toFixed(1)} €/m²/mois` : "—"}</td></tr>
    <tr><td style="padding:6px 10px;color:#64748b;">Évolution</td><td style="padding:6px 10px;font-weight:600;">${city.evolution5y != null ? `${city.evolution5y >= 0 ? "+" : ""}${city.evolution5y.toFixed(1)} %` : "—"}</td></tr>
  </table>
  <h2 style="font-size:15px;margin:20px 0 8px;">Historique</h2>
  <table style="border-collapse:collapse;width:100%;font-size:13px;">${rows}</table>
  <p style="margin-top:24px;">
    <a href="${pageUrl}" style="display:inline-block;background:#635bff;color:#fff;padding:10px 20px;border-radius:999px;text-decoration:none;font-weight:600;font-size:14px;">Voir la page complète →</a>
  </p>
  <p style="margin-top:24px;font-size:12px;color:#94a3b8;">
    Données DVF (DGFiP), ventes réellement actées — pas des prix d'annonce. lokt.fr, gestion locative pour bailleurs particuliers.
  </p>
</div>`;

    const text = `Prix immobilier à ${city.cityName} (${city.postalCode})\nPrix médian : ${formatEur(city.priceM2)}/m²\nLoyer estimé : ${city.rentM2 ? `${city.rentM2.toFixed(1)} €/m²/mois` : "—"}\nÉvolution : ${city.evolution5y != null ? `${city.evolution5y.toFixed(1)} %` : "—"}\n\nVoir la page complète : ${pageUrl}`;

    const result = await sendEmailViaResend({
      to: email,
      subject: `Prix immobilier à ${city.cityName} — lokt.fr`,
      html,
      text,
      replyTo: "contact@lokt.fr",
    });

    if (!result.ok) return res.status(500).json({ ok: false, error: result.error });
    return res.status(200).json({ ok: true });
  } catch (e: any) {
    if (String(e?.message || "").startsWith("RATE_LIMIT:")) {
      return res.status(429).json({ ok: false, error: e.message });
    }
    return res.status(500).json({ ok: false, error: e?.message || "unknown_error" });
  }
}
