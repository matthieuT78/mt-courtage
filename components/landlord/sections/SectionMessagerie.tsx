import React, { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeftIcon, ChatBubbleLeftRightIcon, ChevronRightIcon, NoSymbolIcon, PaperAirplaneIcon, UserPlusIcon } from "@heroicons/react/24/outline";
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
  access: { status: string; invited_email: string; messaging_enabled?: boolean } | null;
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

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
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
  const [togglingMsg, setTogglingMsg] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!selectedTenantId) {
      setThreadId(null);
      setMessages([]);
      return;
    }
    let active = true;
    setLoading(true);
    setErr(null);
    setOk(null);
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
    const timer = setInterval(() => loadMessages(threadId).catch(() => {}), 12000);
    return () => clearInterval(timer);
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
      // Préserver le réglage messagerie existant si le portail est déjà activé
      const currentAccess = rows.find((r) => r.tenant.id === selectedTenantId)?.access;
      const messagingEnabled = currentAccess ? currentAccess.messaging_enabled !== false : true;
      const response = await fetch("/api/tenant-portal/invite", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ tenantId: selectedTenantId, messagingEnabled }),
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

  const toggleMessagingForTenant = async (enabled: boolean) => {
    if (!selectedTenantId) return;
    setTogglingMsg(true);
    setErr(null);
    setOk(null);
    try {
      const response = await fetch("/api/tenant-portal/toggle-messaging", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ tenantId: selectedTenantId, messagingEnabled: enabled }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json?.error || "Modification impossible.");
      setOk(enabled ? "Messagerie activée." : "Messagerie désactivée.");
      await loadThreads();
    } catch (e: any) {
      setErr(e?.message || "Modification impossible.");
    } finally {
      setTogglingMsg(false);
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

      <div className="mt-5 grid overflow-hidden rounded-2xl border border-slate-200 lg:min-h-[620px] lg:grid-cols-[310px,1fr]">
        <aside className={cx("border-b border-slate-200 bg-slate-50 lg:border-b-0 lg:border-r", selectedRow ? "hidden lg:block" : "block")}>
          <div className="border-b border-slate-200 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Locataires</p>
          </div>
          <div className="lg:max-h-[570px] lg:overflow-y-auto">
            {rows.length === 0 ? (
              <div className="px-4 py-5 text-sm text-slate-500">Aucun locataire pour l'instant.</div>
            ) : null}
            {rows.map((row) => (
              <button
                key={row.tenant.id}
                type="button"
                onClick={() => setSelectedTenantId(row.tenant.id)}
                className={cx(
                  "flex w-full items-center gap-3 border-b border-slate-100 px-4 py-2.5 text-left transition last:border-b-0",
                  selectedTenantId === row.tenant.id ? "bg-white lg:bg-indigo-50/60" : "hover:bg-white/80"
                )}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
                  {initials(tenantName(row.tenant))}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-slate-950">{tenantName(row.tenant)}</p>
                    {row.unreadCount > 0 ? (
                      <span className="shrink-0 rounded-full bg-indigo-600 px-1.5 py-0.5 text-[0.65rem] font-bold leading-none text-white">
                        {row.unreadCount}
                      </span>
                    ) : null}
                  </div>
                  <p className="truncate text-xs text-slate-500">
                    {row.latestMessage?.body || (row.access ? "Aucun message pour l’instant" : "Espace locataire à inviter")}
                  </p>
                </div>
                <ChevronRightIcon className="h-4 w-4 shrink-0 text-slate-300 lg:hidden" aria-hidden="true" />
              </button>
            ))}
          </div>
        </aside>

        <section
          className={cx(
            "flex-col",
            selectedRow
              ? "fixed inset-0 z-[60] flex bg-white lg:static lg:z-auto lg:min-h-[450px]"
              : "hidden lg:flex lg:min-h-[450px]"
          )}
        >
          {selectedRow ? (
            <>
              <header className="flex flex-col gap-2 border-b border-slate-200 px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedTenantId(null)}
                      className="-ml-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 lg:hidden"
                      aria-label="Retour à la liste des locataires"
                    >
                      <ArrowLeftIcon className="h-5 w-5" aria-hidden="true" />
                    </button>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-950">{tenantName(selectedRow.tenant)}</p>
                      <p className="mt-0.5 truncate text-xs text-slate-500">{selectedRow.tenant.email || "Email locataire manquant"}</p>
                    </div>
                  </div>
                  {!selectedRow.access ? (
                    <button
                      type="button"
                      disabled={loading || !selectedRow.tenant.email}
                      onClick={inviteTenant}
                      className="shrink-0 inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-800 hover:bg-indigo-100 disabled:opacity-50"
                    >
                      <UserPlusIcon className="h-4 w-4" />
                      Activer l’espace locataire
                    </button>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      {selectedRow.access.messaging_enabled !== false ? (
                        <button
                          type="button"
                          disabled={togglingMsg}
                          onClick={() => toggleMessagingForTenant(false)}
                          className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          <NoSymbolIcon className="h-3.5 w-3.5" />
                          {togglingMsg ? "…" : "Désactiver la messagerie"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={togglingMsg}
                          onClick={() => toggleMessagingForTenant(true)}
                          className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
                        >
                          <ChatBubbleLeftRightIcon className="h-3.5 w-3.5" />
                          {togglingMsg ? "…" : "Activer la messagerie"}
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={loading || !selectedRow.tenant.email}
                        onClick={inviteTenant}
                        className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                      >
                        <UserPlusIcon className="h-3.5 w-3.5" />
                        Renvoyer l’invitation
                      </button>
                    </div>
                  )}
                </div>
                {selectedRow.access?.messaging_enabled === false ? (
                  <p className="text-[0.7rem] text-amber-600">
                    La messagerie est désactivée pour ce locataire — il voit ses documents mais ne peut pas vous écrire.
                  </p>
                ) : null}
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
                <div ref={messagesEndRef} />
              </div>

              <form
                onSubmit={sendMessage}
                className="flex gap-2 border-t border-slate-200 bg-white p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] lg:pb-3"
              >
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
