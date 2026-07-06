// lib/irlService.ts
// Lit les valeurs IRL depuis la table Supabase irl_values (mise à jour par cron).
// Fallback automatique sur IRL_TABLE statique si la table est vide ou inaccessible.

import { IRL_TABLE, type IrlEntry } from "./irlData";
import { supabaseAdmin } from "./supabaseAdmin";

let cache: IrlEntry[] | null = null;
let cacheAt = 0;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1h

export async function getIrlTable(): Promise<IrlEntry[]> {
  // Retourne le cache si frais
  if (cache && Date.now() - cacheAt < CACHE_TTL_MS) return cache;

  try {
    if (!supabaseAdmin) throw new Error("supabaseAdmin non disponible");
    const { data, error } = await supabaseAdmin
      .from("irl_values")
      .select("quarter, label, value")
      .order("quarter", { ascending: false });

    if (error || !data || data.length === 0) throw new Error("Table vide ou erreur");

    cache = data.map((r) => ({ quarter: r.quarter, label: r.label, value: Number(r.value) }));
    cacheAt = Date.now();
    return cache;
  } catch {
    // Fallback sur table statique
    return IRL_TABLE;
  }
}

export async function irlByQuarterAsync(quarter: string): Promise<IrlEntry | null> {
  const table = await getIrlTable();
  return table.find((e) => e.quarter === quarter) || null;
}

export async function latestIrlAsync(): Promise<IrlEntry | null> {
  const table = await getIrlTable();
  return table[0] || null;
}
