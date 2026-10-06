// lib/irl-service.ts
// Lit l'historique IRL depuis Supabase (table irl_values, alimentée par le
// cron pages/api/cron/sync-irl.ts, source INSEE, série BDM 001515333).
import { supabaseAdmin } from "./supabaseAdmin";

export type IrlQuarter = { quarter: string; label: string; value: number };

export async function getIrlHistory(limit = 9): Promise<IrlQuarter[]> {
  if (!supabaseAdmin) return [];
  const { data, error } = await supabaseAdmin
    .from("irl_values")
    .select("quarter,label,value")
    .order("quarter", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data as IrlQuarter[];
}

function sameQuarterLastYear(quarter: string): string {
  const [y, t] = quarter.split("-T");
  return `${Number(y) - 1}-T${t}`;
}

export async function getIrlTokenData() {
  // 10 trimestres pour que le 6e et dernier de la table (rows.slice(0,6))
  // ait aussi un comparatif N-1 dans byQuarter, pas juste les 5 premiers.
  const history = await getIrlHistory(10);
  if (history.length === 0) return null;

  const byQuarter = new Map(history.map((h) => [h.quarter, h]));
  const latest = history[0];
  const yearAgo = byQuarter.get(sameQuarterLastYear(latest.quarter)) || null;
  const evolutionPct = yearAgo ? ((latest.value / yearAgo.value - 1) * 100) : null;

  // 6 derniers trimestres avec leur évolution sur un an, pour le tableau de
  // l'article — recalculé dynamiquement, pas une liste figée de libellés.
  const rows = history.slice(0, 6).map((q) => {
    const ya = byQuarter.get(sameQuarterLastYear(q.quarter));
    return {
      label: q.label,
      value: q.value,
      evolutionPct: ya ? (q.value / ya.value - 1) * 100 : null,
    };
  });

  return { latest, yearAgo, evolutionPct, rows };
}
