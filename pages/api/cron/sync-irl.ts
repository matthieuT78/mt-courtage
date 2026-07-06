// pages/api/cron/sync-irl.ts
// Appelé par un cron mensuel (ex: Vercel Cron).
// Récupère les dernières valeurs IRL depuis l'API BDM INSEE et met à jour la table irl_values.
// Endpoint public INSEE (série 001515333 = IRL base 100 T1 1998).

import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

const INSEE_BDM_URL =
  "https://api.insee.fr/series/BDM/V1/data/SERIES_BDM/001515333?format=json&lastNObservations=8";

// Convertit un identifiant période INSEE (ex: "2026-T01") en notre format "2026-T1"
function parsePeriod(period: string): { quarter: string; label: string } | null {
  // INSEE format: "2026-T01", "2025-T04", etc.
  const m = period.match(/^(\d{4})-T0?(\d)$/);
  if (!m) return null;
  const [, year, q] = m;
  return { quarter: `${year}-T${q}`, label: `T${q} ${year}` };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Vérification clé cron
  const authHeader = req.headers["authorization"];
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const results: Array<{ quarter: string; value: number; status: string }> = [];

  try {
    const inseeToken = process.env.INSEE_API_TOKEN;
    const headers: Record<string, string> = {
      Accept: "application/json",
    };
    if (inseeToken) headers["Authorization"] = `Bearer ${inseeToken}`;

    const response = await fetch(INSEE_BDM_URL, { headers });

    if (!response.ok) {
      // INSEE non disponible — on log et on retourne sans erreur (le cron ne doit pas échouer)
      console.warn("[sync-irl] INSEE API non disponible:", response.status);
      return res.status(200).json({ ok: true, synced: 0, warning: `INSEE API ${response.status}` });
    }

    const data = await response.json();

    // Structure BDM : data.DataSet.Series.Obs[] avec @TIME_PERIOD et @OBS_VALUE
    const observations: Array<{ "@TIME_PERIOD": string; "@OBS_VALUE": string }> =
      data?.DataSet?.Series?.Obs ?? [];

    if (!Array.isArray(observations) || observations.length === 0) {
      return res.status(200).json({ ok: true, synced: 0, warning: "Aucune observation reçue" });
    }

    for (const obs of observations) {
      const period = obs["@TIME_PERIOD"];
      const value = parseFloat(obs["@OBS_VALUE"]);
      if (!period || isNaN(value)) continue;

      const parsed = parsePeriod(period);
      if (!parsed) continue;

      const { error } = await supabaseAdmin
        .from("irl_values")
        .upsert(
          { quarter: parsed.quarter, label: parsed.label, value, updated_at: new Date().toISOString() },
          { onConflict: "quarter" }
        );

      results.push({ quarter: parsed.quarter, value, status: error ? `error: ${error.message}` : "ok" });
    }

    return res.status(200).json({ ok: true, synced: results.filter((r) => r.status === "ok").length, results });
  } catch (e: any) {
    console.error("[sync-irl] Erreur:", e);
    // Ne pas retourner 500 pour ne pas faire échouer le cron — on log et on continue
    return res.status(200).json({ ok: true, synced: 0, warning: e?.message || "Erreur inconnue" });
  }
}
