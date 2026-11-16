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
      // Un locataire archivé n'a plus de relation en cours (sa messagerie est
      // déjà désactivée côté portail, cf. restrictPortalMessaging dans
      // SectionLocataires.tsx) : inutile de garder son entrée dans la liste.
      const { data: tenants, error: tenantsError } = await supabaseAdmin
        .from("tenants")
        .select("id,full_name,first_name,last_name,email,archived_at")
        .eq("user_id", auth.userId)
        .is("archived_at", null)
        .order("created_at", { ascending: false });
      if (tenantsError) throw tenantsError;

      // Un bien délégué en gestion courante à une agence suit déjà la même
      // règle pour les relances/quittances automatiques (cf. rent-reminders,
      // tenant-payment-reminders) : le bailleur a confié le suivi quotidien,
      // la messagerie lokt bailleur↔locataire n'a pas à rester un canal actif
      // en parallèle de celui de l'agence.
      const { data: leaseRows, error: leaseRowsError } = await supabaseAdmin
        .from("leases")
        .select("tenant_id,co_tenant_id,property_id,status")
        .eq("user_id", auth.userId);
      if (leaseRowsError) throw leaseRowsError;
      const propertyIds = Array.from(new Set((leaseRows || []).map((l: any) => l.property_id).filter(Boolean)));
      const { data: delegatedProperties, error: propertiesError } = propertyIds.length
        ? await supabaseAdmin.from("properties").select("id,delegated_services").eq("user_id", auth.userId).in("id", propertyIds)
        : { data: [] as any[], error: null };
      if (propertiesError) throw propertiesError;
      const delegatedPropertyIds = new Set(
        (delegatedProperties || [])
          .filter((p: any) => Array.isArray(p.delegated_services) && p.delegated_services.includes("gestion_courante"))
          .map((p: any) => p.id)
      );
      const leasesByTenant = new Map<string, any[]>();
      for (const lease of leaseRows || []) {
        for (const tid of [lease.tenant_id, lease.co_tenant_id].filter(Boolean)) {
          if (!leasesByTenant.has(tid)) leasesByTenant.set(tid, []);
          leasesByTenant.get(tid)!.push(lease);
        }
      }
      const isDelegatedTenant = (tenantId: string) => {
        const tenantLeases = leasesByTenant.get(tenantId) || [];
        const relevant = tenantLeases.find((l) => String(l.status || "").toLowerCase() === "active") || tenantLeases[0];
        return relevant ? delegatedPropertyIds.has(relevant.property_id) : false;
      };

      const visibleTenants = (tenants || []).filter((tenant: any) => !isDelegatedTenant(tenant.id));
      const tenantIds = visibleTenants.map((tenant: any) => tenant.id);
      if (tenantIds.length === 0) return res.status(200).json({ threads: [] });

      const [{ data: threads, error: threadsError }, { data: accesses, error: accessError }] = await Promise.all([
        supabaseAdmin.from("tenant_message_threads").select("*").eq("landlord_user_id", auth.userId),
        supabaseAdmin.from("tenant_portal_access").select("tenant_id,status,invited_email,messaging_enabled").eq("landlord_user_id", auth.userId),
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

      const rows = visibleTenants.map((tenant: any) => {
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
        .or(`tenant_id.eq.${tenantId},co_tenant_id.eq.${tenantId}`)
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
