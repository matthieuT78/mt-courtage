import { supabaseAdmin } from "./supabaseAdmin";

export type TenantPortalAccess = {
  id: string;
  tenant_id: string;
  landlord_user_id: string;
  tenant_user_id: string;
  invited_email: string;
  status: "invited" | "active" | "revoked";
  messaging_enabled: boolean;
};

export async function getTenantPortalAccess(userId: string, tenantId?: string) {
  if (!supabaseAdmin) throw new Error("Supabase admin non configuré.");

  let query = supabaseAdmin
    .from("tenant_portal_access")
    .select("*")
    .eq("tenant_user_id", userId)
    .in("status", ["invited", "active"]);

  if (tenantId) query = query.eq("tenant_id", tenantId);

  const { data, error } = await query.order("created_at", { ascending: true });
  if (error) throw error;
  return (data || []) as TenantPortalAccess[];
}
export async function getTenantPortalAccessForLandlord(landlordUserId: string, tenantId: string) {
  if (!supabaseAdmin) throw new Error("Supabase admin non configuré.");
  const { data, error } = await supabaseAdmin
    .from("tenant_portal_access")
    .select("*")
    .eq("landlord_user_id", landlordUserId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw error;
  return (data || null) as TenantPortalAccess | null;
}

export async function getOrCreateTenantThread(params: {
  landlordUserId: string;
  tenantId: string;
  propertyId?: string | null;
  leaseId?: string | null;
}) {
  if (!supabaseAdmin) throw new Error("Supabase admin non configuré.");

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("tenant_message_threads")
    .select("*")
    .eq("landlord_user_id", params.landlordUserId)
    .eq("tenant_id", params.tenantId)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) return existing;

  const { data, error } = await supabaseAdmin
    .from("tenant_message_threads")
    .insert({
      landlord_user_id: params.landlordUserId,
      tenant_id: params.tenantId,
      property_id: params.propertyId || null,
      lease_id: params.leaseId || null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function requireThreadParticipant(userId: string, threadId: string) {
  if (!supabaseAdmin) throw new Error("Supabase admin non configuré.");

  const { data: thread, error } = await supabaseAdmin
    .from("tenant_message_threads")
    .select("*")
    .eq("id", threadId)
    .single();
  if (error || !thread) throw new Error("Conversation introuvable.");

  if (thread.landlord_user_id === userId) {
    return { thread, role: "landlord" as const };
  }

  const accesses = await getTenantPortalAccess(userId, thread.tenant_id);
  if (accesses.length > 0) {
    return { thread, role: "tenant" as const };
  }

  throw new Error("Accès refusé.");
}

export function parseStoredPdfUrl(raw?: string | null) {
  const value = String(raw || "").trim();
  const index = value.indexOf(":");
  if (index <= 0) return null;
  const bucket = value.slice(0, index).trim();
  const path = value.slice(index + 1).replace(/^\/+/, "").trim();
  return bucket && path ? { bucket, path } : null;
}
