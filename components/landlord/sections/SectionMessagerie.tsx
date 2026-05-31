import React, { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { ChatBubbleLeftRightIcon, PaperAirplaneIcon, UserPlusIcon } from "@heroicons/react/24/outline";
import { supabase } from "../../../lib/supabaseClient";
import { SectionTitle } from "../UiBits";
import { cx } from "../ui/uiHelpers";

type Tenant = {
  id: string;
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  archived_at?: string | null;
};

type ThreadRow = {
  tenant: Tenant;
  thread: { id: string; updated_at: string } | null;
  access: { status: string; invited_email: string } | null;
  latestMessage: { body: string; created_at: string } | null;
  unreadCount: number;
};

type Message = {
  id: string;
  sender_role: "landlord" | "tenant";
  body: string;
  created_at: string;
};

type Props = {
  initialTenantId?: string | null;
  onTenantSelected?: () => void;
};

async function authHeaders() {
  if (!supabase) throw new Error("Supabase non initialisé.");
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const token = data.session?.access_token;
  if (!token) throw new Error("Session expirée. Reconnectez-vous.");
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

function tenantName(tenant?: Tenant | null) {
  if (!tenant) return "Locataire";
  return tenant.full_name || [tenant.first_name, tenant.last_name].filter(Boolean).join(" ") || tenant.email || "Locataire";
}

function formatDate(value?: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function SectionMessagerie({ initialTenantId, onTenantSelected }: Props) {
  const [rows, setRows] = useState<ThreadRow[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(initialTenantId || null);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const selectedRow = useMemo(() => rows.find((row) => row.tenant.id === selectedTenantId) || null, [rows, selectedTenantId]);

  const loadThreads = useCallback(async () => {
    try {
      const response = await fetch("/api/messaging/threads", { headers: await authHeaders() });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json?.error || "Chargement de la messagerie impossible.");
      setRows(json?.threads || []);
    } catch (e: any) {
      setErr(e?.message || "Chargement de la messagerie impossible.");
    }
  }, []);

  const ensureThread = useCallback(async (tenantId: string) => {
    const response = await fetch("/api/messaging/threads", {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ tenantId }),
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(json?.error || "Conversation impossible.");
    return String(json.thread.id);
  }, []);

  const loadMessages = useCallback(async (nextThreadId: string) => {
    const response = await fetch(`/api/messaging/messages?threadId=${encodeURIComponent(nextThreadId)}`, {
      headers: await authHeaders(),
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(json?.error || "Chargement des messages impossible.");
    setMessages(json?.messages || []);
  }, []);

  useEffect(() => {
    loadThreads();
  }, [loadThreads]);

  useEffect(() => {
    if (!initialTenantId) return;
    setSelectedTenantId(initialTenantId);
    onTenantSelected?.();
  }, [initialTenantId, onTenantSelected]);

  useEffect(() => {
    if (!selectedTenantId) {
      setThreadId(null);
      setMessages([]);
      return;
    }
    let active = true;
    setLoading(true);
    setErr(null);
    (async () => {
      try {
        const id = selectedRow?.thread?.id || (await ensureThread(selectedTenantId));
        if (!active) return;
        setThreadId(id);
        await loadMessages(id);
        await loadThreads();
      } catch (e: any) {
        if (active) setErr(e?.message || "Conversation impossible.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [ensureThread, loadMessages, loadThreads, selectedRow?.thread?.id, selectedTenantId]);

  useEffect(() => {
    if (!threadId) return;
    const timer = window.setInterval(() => loadMessages(threadId).catch(() => {}), 12000);
    return () => window.clearInterval(timer);
  }, [loadMessages, threadId]);

  const sendMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!threadId || !body.trim()) return;
    setSending(true);
    setErr(null);
    try {
      const response = await fetch("/api/messaging/messages", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ threadId, body }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json?.error || "Envoi impossible.");
      setBody("");
      await loadMessages(threadId);
      await loadThreads();
    } catch (e: any) {
      setErr(e?.message || "Envoi impossible.");
    } finally {
      setSending(false);
    }
  };

  const inviteTenant = async () => {
    if (!selectedTenantId) return;
    setLoading(true);
    setErr(null);
    setOk(null);
    try {
      const response = await fetch("/api/tenant-portal/invite", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ tenantId: selectedTenantId }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json?.error || "Invitation impossible.");
      setOk(json?.message || "Accès locataire activé.");
      await loadThreads();
    } catch (e: any) {
      setErr(e?.message || "Invitation impossible.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <SectionTitle
        kicker="Messagerie"
        title="Échanges locataires"
        desc="Centralisez les échanges liés à la location et invitez chaque locataire dans son espace documentaire."
      />

      {err ? <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div> : null}
      {ok ? <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{ok}</div> : null}

      <div className="mt-5 grid min-h-[620px] overflow-hidden rounded-2xl border border-slate-200 lg:grid-cols-[310px,1fr]">
        <aside className="border-b border-slate-200 bg-slate-50 lg:border-b-0 lg:border-r">
          <div className="border-b border-slate-200 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Locataires</p>
          </div>
          <div className="max-h-[260px] overflow-y-auto lg:max-h-[570px]">
            {rows.map((row) => (
              <button
                key={row.tenant.id}
                type="button"
                onClick={() => setSelectedTenantId(row.tenant.id)}
                className={cx(
                  "w-full border-b border-slate-200 px-4 py-3 text-left transition",
                  selectedTenantId === row.tenant.id ? "bg-white" : "hover:bg-white/80"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate text-sm font-semibold text-slate-950">{tenantName(row.tenant)}</p>
                  {row.unreadCount > 0 ? (
                    <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[0.65rem] font-bold text-white">{row.unreadCount}</span>
                  ) : null}
                </div>
                <p className="mt-1 truncate text-xs text-slate-500">{row.latestMessage?.body || "Aucun message pour l’instant"}</p>
                <p className="mt-1 text-[0.68rem] font-semibold text-slate-400">
                  {row.access ? "Espace locataire activé" : "Espace locataire à inviter"}
                </p>
              </button>
            ))}
          </div>
        </aside>

        <section className="flex min-h-[450px] flex-col">
          {selectedRow ? (
            <>
              <header className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-950">{tenantName(selectedRow.tenant)}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{selectedRow.tenant.email || "Email locataire manquant"}</p>
                </div>
                <button
                  type="button"
                  disabled={loading || !selectedRow.tenant.email}
                  onClick={inviteTenant}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-800 hover:bg-indigo-100 disabled:opacity-50"
                >
                  <UserPlusIcon className="h-4 w-4" />
                  {selectedRow.access ? "Vérifier / réactiver l’accès" : "Inviter dans l’espace locataire"}
                </button>
              </header>

              <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 px-4 py-4">
                {loading ? <p className="text-sm text-slate-500">Chargement de la conversation...</p> : null}
                {!loading && messages.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-5 text-sm text-slate-600">
                    Commencez l’échange ici. Le locataire retrouvera ensuite vos messages dans son espace.
                  </div>
                ) : null}
                {messages.map((message) => (
                  <div key={message.id} className={cx("flex", message.sender_role === "landlord" ? "justify-end" : "justify-start")}>
                    <div
                      className={cx(
                        "max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm",
                        message.sender_role === "landlord" ? "bg-slate-950 text-white" : "border border-slate-200 bg-white text-slate-800"
                      )}
                    >
                      <p className="whitespace-pre-wrap leading-5">{message.body}</p>
                      <p className={cx("mt-1 text-[0.65rem]", message.sender_role === "landlord" ? "text-slate-300" : "text-slate-400")}>
                        {formatDate(message.created_at)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <form onSubmit={sendMessage} className="flex gap-2 border-t border-slate-200 bg-white p-3">
                <textarea
                  rows={2}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Écrire un message..."
                  className="min-h-[48px] flex-1 resize-none rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
                <button
                  type="submit"
                  disabled={sending || !body.trim()}
                  className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white hover:bg-slate-800 disabled:opacity-50"
                  title="Envoyer le message"
                >
                  <PaperAirplaneIcon className="h-5 w-5" />
                </button>
              </form>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center px-5 text-center">
              <div>
                <ChatBubbleLeftRightIcon className="mx-auto h-10 w-10 text-slate-300" />
                <p className="mt-3 text-sm font-semibold text-slate-800">Sélectionnez un locataire</p>
                <p className="mt-1 text-sm text-slate-500">Ouvrez une conversation ou invitez-le dans son espace.</p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
