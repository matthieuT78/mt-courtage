import { supabaseAdmin } from "./supabaseAdmin";

// Mêmes buckets et préfixes que lib/storageQuota.ts (qui les scanne pour calculer
// l'usage), plus property-photos et candidature-documents qui suivent la même
// convention ${userId}/... mais n'entrent pas dans le calcul de quota.
function buildPrefixes(userId: string) {
  return [
    { bucket: "property-dpe-pdfs", prefix: userId },
    { bucket: "lease-contract-pdfs", prefix: userId },
    { bucket: "rent-receipts-pdfs", prefix: userId },
    { bucket: "inventory-pdfs", prefix: userId },
    { bucket: "inventory-pdfs", prefix: `inventory/${userId}` },
    { bucket: "inventory-photos", prefix: userId },
    { bucket: "water-tools", prefix: userId },
    { bucket: "finance-documents", prefix: userId },
    { bucket: "property-photos", prefix: userId },
    { bucket: "candidature-documents", prefix: userId },
  ];
}

async function removePrefixRecursive(bucket: string, prefix: string): Promise<number> {
  if (!supabaseAdmin) throw new Error("Supabase admin non configuré.");
  let removed = 0;
  let offset = 0;
  while (true) {
    const { data, error } = await supabaseAdmin.storage.from(bucket).list(prefix, { limit: 100, offset });
    if (error) {
      if (String(error.message || "").toLowerCase().includes("bucket not found")) return removed;
      throw error;
    }
    const items = data || [];
    const filePaths: string[] = [];
    for (const item of items) {
      const path = `${prefix}/${item.name}`;
      if (item.id) {
        filePaths.push(path);
      } else {
        removed += await removePrefixRecursive(bucket, path);
      }
    }
    if (filePaths.length > 0) {
      const { error: removeError } = await supabaseAdmin.storage.from(bucket).remove(filePaths);
      if (removeError) throw removeError;
      removed += filePaths.length;
    }
    if (items.length < 100) break;
    offset += 100;
  }
  return removed;
}

// Supprime tous les fichiers de storage d'un utilisateur, tous buckets confondus —
// utilisé lors de la suppression de compte (RGPD), en best-effort : une erreur sur
// un bucket ne doit pas empêcher la suppression du compte lui-même, mais est
// remontée pour être loguée par l'appelant.
export async function deleteUserStorage(userId: string): Promise<{ removed: number; errors: string[] }> {
  const prefixes = buildPrefixes(userId);
  let removed = 0;
  const errors: string[] = [];

  await Promise.all(
    prefixes.map(async ({ bucket, prefix }) => {
      try {
        removed += await removePrefixRecursive(bucket, prefix);
      } catch (e: any) {
        errors.push(`${bucket}:${prefix} — ${e?.message || String(e)}`);
      }
    })
  );

  return { removed, errors };
}
