import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../../lib/apiAuth";
import { notifyNewTenantMessage } from "../../../lib/messagingNotification";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { requireThreadParticipant } from "../../../lib/tenantPortal";

function requestBaseUrl(req: NextApiRequest) {
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0].trim();
  const protocol = String(req.headers["x-forwarded-proto"] || "http").split(",")[0].trim();
  return host ? `${protocol}://${host}` : null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (!supabaseAdmin) return res.status(500).json({ error: "Supabase admin non configuré." });
    const auth = await requireApiUser(req);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

    const threadId = String(req.method === "GET" ? req.query.threadId || "" : req.body?.threadId || "");
    if (!threadId) return res.status(400).json({ error: "threadId requis." });
    const participant = await requireThreadParticipant(auth.userId, threadId);

    if (req.method === "GET") {
      const { data, error } = await supabaseAdmin
        .from("tenant_messages")
        .select("id,thread_id,sender_user_id,sender_role,body,read_at,created_at")
        .eq("thread_id", threadId)
        .order("created_at", { ascending: true })
        .limit(300);
      if (error) throw error;

      await supabaseAdmin
        .from("tenant_messages")
        .update({ read_at: new Date().toISOString() })
        .eq("thread_id", threadId)
        .neq("sender_role", participant.role)
        .is("read_at", null);

      return res.status(200).json({ thread: participant.thread, role: participant.role, messages: data || [] });
    }

    if (req.method === "POST") {
      const body = String(req.body?.body || "").trim();
      if (!body) return res.status(400).json({ error: "Message vide." });
      if (body.length > 5000) return res.status(400).json({ error: "Message trop long (5000 caractères maximum)." });

      const { data, error } = await supabaseAdmin
        .from("tenant_messages")
        .insert({
          thread_id: threadId,
          sender_user_id: auth.userId,
          sender_role: participant.role,
          body,
        })
        .select("id,thread_id,sender_user_id,sender_role,body,read_at,created_at")
        .single();
      if (error) throw error;

      await supabaseAdmin.from("tenant_message_threads").update({ updated_at: new Date().toISOString() }).eq("id", threadId);

      let notification: Awaited<ReturnType<typeof notifyNewTenantMessage>>;
      try {
        notification = await notifyNewTenantMessage({
          landlordUserId: participant.thread.landlord_user_id,
          tenantId: participant.thread.tenant_id,
          leaseId: participant.thread.lease_id,
          senderRole: participant.role,
          body,
          requestBaseUrl: requestBaseUrl(req),
        });
      } catch (notificationError: any) {
        console.error("[api/messaging/messages] notification error:", notificationError);
        notification = { ok: false, skipped: false, error: notificationError?.message || "Notification email impossible." };
      }

      return res.status(201).json({ message: data, notification });
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (e: any) {
    const status = e?.message === "Accès refusé." ? 403 : e?.message === "Conversation introuvable." ? 404 : 500;
    return res.status(status).json({ error: e?.message || "Erreur interne." });
  }
}
