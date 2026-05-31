import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../../lib/apiAuth";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { getOrCreateTenantThread } from "../../../lib/tenantPortal";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (!supabaseAdmin) return res.status(500).json({ error: "Supabase admin non configuré." });
    const auth = await requireApiUser(req);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

    if (req.method === "GET") {
      const { data: tenants, error: tenantsError } = await supabaseAdmin
        .from("tenants")
        .select("id,full_name,first_name,last_name,email,archived_at")
        .eq("user_id", auth.userId)
        .order("created_at", { ascending: false });
      if (tenantsError) throw tenantsError;

      const tenantIds = (tenants || []).map((tenant: any) => tenant.id);
      if (tenantIds.length === 0) return res.status(200).json({ threads: [] });

      const [{ data: threads, error: threadsError }, { data: accesses, error: accessError }] = await Promise.all([
        supabaseAdmin.from("tenant_message_threads").select("*").eq("landlord_user_id", auth.userId),
        supabaseAdmin.from("tenant_portal_access").select("tenant_id,status,invited_email").eq("landlord_user_id", auth.userId),
      ]);
      if (threadsError) throw threadsError;
      if (accessError) throw accessError;

      const threadIds = (threads || []).map((thread: any) => thread.id);
      const { data: messages, error: messagesError } = threadIds.length
        ? await supabaseAdmin
            .from("tenant_messages")
            .select("id,thread_id,sender_role,body,created_at,read_at")
            .in("thread_id", threadIds)
            .order("created_at", { ascending: false })
        : { data: [], error: null };
      if (messagesError) throw messagesError;

      const threadByTenant = new Map((threads || []).map((thread: any) => [thread.tenant_id, thread]));
      const accessByTenant = new Map((accesses || []).map((access: any) => [access.tenant_id, access]));
      const latestByThread = new Map<string, any>();
      const unreadByThread = new Map<string, number>();
      for (const message of messages || []) {
        if (!latestByThread.has(message.thread_id)) latestByThread.set(message.thread_id, message);
        if (message.sender_role === "tenant" && !message.read_at) {
          unreadByThread.set(message.thread_id, (unreadByThread.get(message.thread_id) || 0) + 1);
        }
      }

      const rows = (tenants || []).map((tenant: any) => {
        const thread: any = threadByTenant.get(tenant.id) || null;
        return {
          tenant,
          thread,
          access: accessByTenant.get(tenant.id) || null,
          latestMessage: thread ? latestByThread.get(thread.id) || null : null,
          unreadCount: thread ? unreadByThread.get(thread.id) || 0 : 0,
        };
      });
      return res.status(200).json({ threads: rows });
    }

    if (req.method === "POST") {
      const tenantId = String(req.body?.tenantId || "");
      if (!tenantId) return res.status(400).json({ error: "tenantId requis." });

      const { data: tenant, error: tenantError } = await supabaseAdmin
        .from("tenants")
        .select("id")
        .eq("id", tenantId)
        .eq("user_id", auth.userId)
        .single();
      if (tenantError || !tenant) return res.status(404).json({ error: "Locataire introuvable." });

      const { data: lease } = await supabaseAdmin
        .from("leases")
        .select("id,property_id")
        .eq("user_id", auth.userId)
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const thread = await getOrCreateTenantThread({
        landlordUserId: auth.userId,
        tenantId,
        leaseId: lease?.id || null,
        propertyId: lease?.property_id || null,
      });
      return res.status(200).json({ thread });
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "Erreur interne." });
  }
}
