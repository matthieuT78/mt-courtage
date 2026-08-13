// pages/api/cron/sync-irl.ts
// Appelé par un cron mensuel (Vercel Cron).
// Récupère les dernières valeurs IRL depuis l'API BDM INSEE et met à jour la table irl_values.
// Endpoint public INSEE (série 001515333 = IRL base 100 T1 1998).
//
// L'API BDM ne supporte pas de sortie JSON (le paramètre format=json renvoie une
// erreur 400 "Unknown query parameter") : elle répond toujours en XML/SDMX, d'où
// le parsing par regex ci-dessous plutôt qu'un .json(). Le TIME_PERIOD est au
// format "2026-Q2" (Q, pas T) — à convertir vers notre format "2026-T2".

import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { hasValidCronSecret } from "../../../lib/cronAuth";
import { alertCronFailures } from "../../../lib/cronAlert";

const INSEE_BDM_URL =
  "https://api.insee.fr/series/BDM/V1/data/SERIES_BDM/001515333?lastNObservations=8";

// Convertit un identifiant période INSEE (ex: "2026-Q2") en notre format "2026-T2"
function parsePeriod(period: string): { quarter: string; label: string } | null {
  const m = period.match(/^(\d{4})-Q(\d)$/);
  if (!m) return null;
  const [, year, q] = m;
  return { quarter: `${year}-T${q}`, label: `T${q} ${year}` };
}

function parseObservations(xml: string): Array<{ period: string; value: number }> {
  const out: Array<{ period: string; value: number }> = [];
  const re = /<Obs TIME_PERIOD="([^"]+)" OBS_VALUE="([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const value = parseFloat(m[2]);
    if (!isNaN(value)) out.push({ period: m[1], value });
  }
  return out;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!hasValidCronSecret(req)) return res.status(401).json({ error: "Unauthorized" });
  if (!supabaseAdmin) return res.status(500).json({ error: "Supabase admin non configuré." });

  const results: Array<{ quarter: string; value: number; status: string }> = [];

  try {
    const response = await fetch(INSEE_BDM_URL, { headers: { Accept: "application/xml" } });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.warn("[sync-irl] INSEE API non disponible:", response.status, body.slice(0, 300));
      await alertCronFailures("sync-irl", [{ error: `INSEE API ${response.status}: ${body.slice(0, 200)}` }]);
      return res.status(200).json({ ok: true, synced: 0, warning: `INSEE API ${response.status}` });
    }

    const xml = await response.text();
    const observations = parseObservations(xml);

    if (observations.length === 0) {
      await alertCronFailures("sync-irl", [{ error: "Aucune observation reçue (réponse INSEE inattendue)" }]);
      return res.status(200).json({ ok: true, synced: 0, warning: "Aucune observation reçue" });
    }

    for (const obs of observations) {
      const parsed = parsePeriod(obs.period);
      if (!parsed) continue;

      const { error } = await supabaseAdmin
        .from("irl_values")
        .upsert(
          { quarter: parsed.quarter, label: parsed.label, value: obs.value, updated_at: new Date().toISOString() },
          { onConflict: "quarter" }
        );

      results.push({ quarter: parsed.quarter, value: obs.value, status: error ? `error: ${error.message}` : "ok" });
    }

    const failures = results.filter((r) => r.status !== "ok");
    if (failures.length > 0) {
      await alertCronFailures("sync-irl", failures.map((f) => ({ error: `${f.quarter}: ${f.status}` })));
    }

    return res.status(200).json({ ok: true, synced: results.filter((r) => r.status === "ok").length, results });
  } catch (e: any) {
    console.error("[sync-irl] Erreur:", e);
    await alertCronFailures("sync-irl", [{ error: e?.message || "Erreur inconnue" }]);
    // Ne pas retourner 500 pour ne pas faire échouer le cron — on log et on continue
    return res.status(200).json({ ok: true, synced: 0, warning: e?.message || "Erreur inconnue" });
  }
}
