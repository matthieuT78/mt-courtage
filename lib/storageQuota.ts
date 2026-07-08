import { storageQuotaBytes } from "./permissions";
import { getServerUserPlan } from "./serverPermissions";
import { supabaseAdmin } from "./supabaseAdmin";

// ── Cache serveur (in-memory, 5 min par userId) ──────────────────────────────
type CacheEntry = { ts: number; result: StorageUsage };
const _cache = new Map<string, CacheEntry>();
const CACHE_TTL = 5 * 60 * 1000;

export type StorageUsage = {
  plan: string;
  usedBytes: number;
  quotaBytes: number;
  availableBytes: number;
};

// ── Liste des préfixes à scanner (bucket + prefix) ───────────────────────────
// inventory-pdfs a deux préfixes distincts selon l'origine de l'upload
function buildPrefixes(userId: string) {
  return [
    { bucket: "property-dpe-pdfs",    prefix: userId },
    { bucket: "lease-contract-pdfs",  prefix: userId },
    { bucket: "rent-receipts-pdfs",   prefix: userId },
    { bucket: "inventory-pdfs",       prefix: userId },
    { bucket: "inventory-pdfs",       prefix: `inventory/${userId}` },
    { bucket: "inventory-photos",     prefix: userId },
    { bucket: "water-tools",          prefix: userId },
    { bucket: "finance-documents",    prefix: userId },
  ];
}

async function prefixSize(bucket: string, prefix: string, seen: Set<string>): Promise<number> {
  if (!supabaseAdmin) throw new Error("Supabase admin non configuré.");
  let total = 0;
  let offset = 0;
  while (true) {
    const { data, error } = await supabaseAdmin.storage.from(bucket).list(prefix, { limit: 100, offset });
    if (error) {
      if (String(error.message || "").toLowerCase().includes("bucket not found")) return 0;
      throw error;
    }
    const items = data || [];
    // Traiter les fichiers et sous-dossiers en parallèle dans la page
    const subSizes = await Promise.all(
      items.map(async (item) => {
        const path = `${prefix}/${item.name}`;
        if (item.id) {
          // Fichier : déduplique avec le seen Set (single-threaded entre les awaits → safe)
          const key = `${bucket}:${path}`;
          if (seen.has(key)) return 0;
          seen.add(key);
          return Number((item.metadata as any)?.size || 0);
        } else {
          // Sous-dossier : récursion
          return prefixSize(bucket, path, seen);
        }
      })
    );
    total += subSizes.reduce((s, n) => s + n, 0);
    if (items.length < 100) break;
    offset += 100;
  }
  return total;
}

export async function getUserStorageUsage(userId: string): Promise<StorageUsage> {
  // Hit cache
  const cached = _cache.get(userId);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.result;

  const seen = new Set<string>();
  const prefixes = buildPrefixes(userId);

  // Plan + tous les buckets en parallèle
  const [plan, ...sizes] = await Promise.all([
    getServerUserPlan(userId),
    ...prefixes.map(({ bucket, prefix }) => prefixSize(bucket, prefix, seen)),
  ]);

  const usedBytes = sizes.reduce((s, n) => s + n, 0);
  const quotaBytes = storageQuotaBytes(plan);
  const result: StorageUsage = {
    plan,
    usedBytes,
    quotaBytes,
    availableBytes: Math.max(0, quotaBytes - usedBytes),
  };

  _cache.set(userId, { ts: Date.now(), result });
  return result;
}

// Invalider le cache quand un fichier est uploadé ou supprimé
export function invalidateStorageCache(userId: string) {
  _cache.delete(userId);
}
