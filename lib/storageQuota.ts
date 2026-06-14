import { storageQuotaBytes } from "./permissions";
import { getServerUserPlan } from "./serverPermissions";
import { supabaseAdmin } from "./supabaseAdmin";

const buckets = ["property-dpe-pdfs", "lease-contract-pdfs", "rent-receipts-pdfs", "inventory-pdfs", "inventory-photos", "water-tools", "finance-documents"];

async function folderSize(bucket: string, prefix: string, seen: Set<string>): Promise<number> {
  if (!supabaseAdmin) throw new Error("Supabase admin non configuré.");
  let total = 0;
  let offset = 0;
  while (true) {
    const { data, error } = await supabaseAdmin.storage.from(bucket).list(prefix, { limit: 100, offset });
    if (error) {
      if (String(error.message || "").toLowerCase().includes("bucket not found")) return 0;
      throw error;
    }
    for (const item of data || []) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id) {
        if (!seen.has(`${bucket}:${path}`)) {
          seen.add(`${bucket}:${path}`);
          total += Number((item.metadata as any)?.size || 0);
        }
      } else {
        total += await folderSize(bucket, path, seen);
      }
    }
    if ((data || []).length < 100) break;
    offset += 100;
  }
  return total;
}

export async function getUserStorageUsage(userId: string) {
  const plan = await getServerUserPlan(userId);
  const seen = new Set<string>();
  let usedBytes = 0;
  for (const bucket of buckets) {
    usedBytes += await folderSize(bucket, userId, seen);
    if (bucket === "inventory-pdfs") usedBytes += await folderSize(bucket, `inventory/${userId}`, seen);
  }
  const quotaBytes = storageQuotaBytes(plan);
  return { plan, usedBytes, quotaBytes, availableBytes: Math.max(0, quotaBytes - usedBytes) };
}
