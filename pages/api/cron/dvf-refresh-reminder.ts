// Rappel annuel — 1er novembre
// Envoie un email avec les instructions pour rafraîchir city_market_benchmarks depuis DVF

import type { NextApiRequest, NextApiResponse } from "next";
import { hasValidCronSecret } from "../../../lib/cronAuth";

const ALERT_EMAIL = "matthieu.turbier@gmail.com";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!hasValidCronSecret(req)) return res.status(401).json({ error: "Unauthorized" });

  const RESEND_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_KEY) return res.status(500).json({ error: "RESEND_API_KEY manquant" });

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "lokt.fr <alerts@lokt.fr>",
      to: ALERT_EMAIL,
      subject: "📅 lokt.fr — Rappel : mettre à jour les prix immobiliers DVF (annuel)",
      html: `
<div style="font-family:sans-serif;max-width:640px;margin:0 auto;color:#1f2937">

  <h2 style="color:#0f172a">Mise à jour annuelle DVF — city_market_benchmarks</h2>

  <p>Les données de prix au m² et loyers de la calculette investissement ont été chargées
  en <strong>décembre 2025</strong> depuis DVF 2024. Elles ont maintenant ~12 mois — il est
  temps de les rafraîchir avec DVF 2025.</p>

  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">

  <h3 style="color:#0f172a">Étape 1 — Télécharger DVF 2025</h3>
  <p>Aller sur data.gouv.fr et télécharger le fichier des mutations 2025 :</p>
  <p style="background:#f3f4f6;padding:12px;border-radius:6px;font-family:monospace;font-size:13px">
    https://www.data.gouv.fr/fr/datasets/demandes-de-valeurs-foncieres/
  </p>
  <p>Fichier à télécharger : <code>valeursfoncieres-2025.txt</code> (~500 Mo, séparateur pipe <code>|</code>)<br>
  Le placer dans : <code>courtier-simulateur/data/valeursfoncieres-2025.txt</code></p>

  <h3 style="color:#0f172a">Étape 2 — Recréer le script Python de traitement</h3>
  <p>Le script original a été perdu. Le venv Python est intact dans le projet
  (<code>courtier-simulateur/venv/</code>, pandas + numpy installés).</p>
  <p>Demander à Claude Code de générer le script en lui montrant :</p>
  <ul>
    <li>Le fichier source : <code>data/valeursfoncieres-2024.txt</code> (pour la structure des colonnes)</li>
    <li>Le CSV de sortie attendu : <code>data/city_market_benchmarks_from_dvf.csv</code> (colonnes : insee_code, city_name, postal_code, reference_price_m2_sale, reference_rent_m2, source)</li>
    <li>Logique : médian du prix/m² par code INSEE sur les ventes de maisons + appartements, loyer estimé par heuristique rendement brut (~5,5% en province, ~3,2% à Paris)</li>
  </ul>
  <p>Sauvegarder le script dans <code>scripts/process-dvf.py</code> pour ne plus le perdre.</p>

  <h3 style="color:#0f172a">Étape 3 — Générer le nouveau CSV</h3>
  <p style="background:#f3f4f6;padding:12px;border-radius:6px;font-family:monospace;font-size:13px">
    cd courtier-simulateur<br>
    source venv/bin/activate<br>
    python scripts/process-dvf.py
  </p>
  <p>Sortie attendue : <code>data/city_market_benchmarks_from_dvf.csv</code> (~30 000 lignes)</p>

  <h3 style="color:#0f172a">Étape 4 — Importer dans Supabase</h3>
  <p>Dans Supabase Dashboard → Table Editor → <code>city_market_benchmarks</code> → Import CSV.<br>
  Ou via SQL :</p>
  <p style="background:#f3f4f6;padding:12px;border-radius:6px;font-family:monospace;font-size:13px">
    -- Vider et réimporter<br>
    TRUNCATE city_market_benchmarks;<br>
    -- puis importer via l'interface Supabase (CSV upload)
  </p>

  <h3 style="color:#0f172a">Étape 5 — Vérifier</h3>
  <p style="background:#f3f4f6;padding:12px;border-radius:6px;font-family:monospace;font-size:13px">
    SELECT COUNT(*), MIN(updated_at), MAX(updated_at)<br>
    FROM city_market_benchmarks;
  </p>
  <p>Tester la calculette investissement sur Paris, Lyon, Marseille — vérifier que les prix affichés sont cohérents avec le marché actuel.</p>

  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">

  <p style="color:#6b7280;font-size:13px">
    Fichiers de référence dans le repo :<br>
    • <code>data/valeursfoncieres-2024.txt</code> — source DVF 2024 (structure de référence)<br>
    • <code>data/city_market_benchmarks_from_dvf.csv</code> — CSV de sortie 2024 (format de référence)<br>
    • <code>pages/api/market-benchmarks.ts</code> — API qui lit city_market_benchmarks<br>
    • <code>components/InvestissementWizard.tsx</code> — consommateur principal
  </p>

  <p style="color:#6b7280;font-size:12px;margin-top:16px">Cron /api/cron/dvf-refresh-reminder — déclenché le 1er novembre chaque année</p>
</div>`,
    }),
  });

  return res.status(200).json({ ok: true, sent_to: ALERT_EMAIL });
}
