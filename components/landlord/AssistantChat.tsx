// components/landlord/AssistantChat.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowTopRightOnSquareIcon, XMarkIcon, PaperAirplaneIcon } from "@heroicons/react/24/outline";
import { supabase } from "../../lib/supabaseClient";

type ContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, any> }
  | { type: "tool_result"; tool_use_id: string; content: string };

type ApiMessage = { role: "user" | "assistant"; content: string | ContentBlock[] };

type PendingAction = {
  toolUseId: string;
  toolName: string;
  args: Record<string, any>;
  description: string;
  summary?: Array<{ label: string; value: string }> | null;
};

type SuggestedNavigation = {
  section: string;
  link: Record<string, any>;
  label: string;
};

const TOOL_ACTION_LABEL: Record<string, string> = {
  create_property: "Créer ce bien",
  create_tenant: "Créer cette fiche locataire",
  create_lease: "Créer ce bail",
  confirm_payment: "Confirmer ce paiement",
  cancel_payment: "Annuler ce paiement",
  resend_receipt: "Renvoyer cette quittance",
  send_payment_reminder: "Envoyer cette relance",
  terminate_lease: "Résilier ce bail",
  manage_deposit: "Confirmer cette opération sur le dépôt",
  add_finance_transaction: "Ajouter cette écriture",
  delete_finance_transaction: "Supprimer cette écriture",
  stop_recurring_transaction: "Arrêter cette récurrente",
  update_recurring_transaction: "Modifier cette récurrente",
  send_rent_revision: "Envoyer cette révision de loyer",
  cancel_rent_revision: "Annuler cette révision",
  generate_mise_en_demeure: "Générer cette mise en demeure",
  generate_conge: "Générer cette lettre de congé",
  create_listing: "Publier cette annonce",
};

function textOf(content: string | ContentBlock[]): string {
  if (typeof content === "string") return content;
  return content
    .filter((b): b is { type: "text"; text: string } => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

async function getAccessToken(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || null;
}

// Rend cliquables les liens vers les guides/articles gratuits que l'assistant
// peut citer (voir l'outil find_help_content) : ce sont des pages publiques,
// pas des sections du cockpit, donc un lien classique (nouvel onglet) plutôt
// qu'une navigation interne.
const LINK_PATTERN = /(https?:\/\/[^\s)]+|\/(?:guides|blog)\/[a-z0-9-]+)/g;
const LINK_TEST = /^(?:https?:\/\/[^\s)]+|\/(?:guides|blog)\/[a-z0-9-]+)$/;

function renderWithLinks(text: string) {
  const parts = text.split(LINK_PATTERN);
  return parts.map((part, i) => {
    if (!part || !LINK_TEST.test(part)) return part;
    return (
      <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:opacity-80">
        {part}
      </a>
    );
  });
}

export default function AssistantChat({
  open,
  onClose,
  onNavigate,
  initialMessage,
}: {
  open: boolean;
  onClose: () => void;
  onNavigate?: (section: string, link: Record<string, any>) => void;
  initialMessage?: { key: number; text: string } | null;
}) {
  const [apiMessages, setApiMessages] = useState<ApiMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [suggestedNavigations, setSuggestedNavigations] = useState<SuggestedNavigation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [quotaScope, setQuotaScope] = useState<"monthly_budget" | "trial" | null>(null);
  const [quotaLimit, setQuotaLimit] = useState<number | null>(null);
  const [limitReached, setLimitReached] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const quotaUsedPercent = useMemo(() => {
    if (!quotaLimit || quotaLimit <= 0 || remaining == null) return null;
    const used = Math.max(0, quotaLimit - remaining);
    return Math.min(100, Math.round((used / quotaLimit) * 100));
  }, [quotaLimit, remaining]);

  const displayMessages = useMemo(
    () =>
      apiMessages
        .map((m) => ({ role: m.role, text: textOf(m.content) }))
        .filter((m) => m.text.length > 0),
    [apiMessages]
  );

  useEffect(() => {
    if (!open) return;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [displayMessages, pendingAction, suggestedNavigations, sending, open]);

  useEffect(() => {
    if (!open || !initialMessage?.text) return;
    void send(initialMessage.text);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialMessage?.key]);

  const callAssistant = async (body: Record<string, any>) => {
    const token = await getAccessToken();
    if (!token) throw new Error("Session expirée, merci de recharger la page.");
    const res = await fetch("/api/landlord/assistant/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || "L'assistant n'a pas pu répondre.");
    return data as {
      messages: ApiMessage[];
      done: boolean;
      pendingAction?: PendingAction;
      suggestedNavigations?: SuggestedNavigation[];
      remaining?: number;
      quotaScope?: "monthly_budget" | "trial";
      quotaLimit?: number;
      limitReached?: boolean;
      limitMessage?: string;
    };
  };

  const applyResult = (data: Awaited<ReturnType<typeof callAssistant>>) => {
    if (typeof data.quotaScope === "string") setQuotaScope(data.quotaScope);
    if (typeof data.quotaLimit === "number") setQuotaLimit(data.quotaLimit);
    if (data.limitReached) {
      setApiMessages([...data.messages, { role: "assistant", content: data.limitMessage || "Limite atteinte." }]);
      setPendingAction(null);
      setSuggestedNavigations([]);
      setRemaining(0);
      setLimitReached(true);
      return;
    }
    setApiMessages(data.messages);
    setPendingAction(data.pendingAction || null);
    setSuggestedNavigations(Array.isArray(data.suggestedNavigations) ? data.suggestedNavigations : []);
    if (typeof data.remaining === "number") setRemaining(data.remaining);
  };

  const send = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || sending || pendingAction || limitReached) return;
    setError(null);
    setInput("");
    const nextMessages: ApiMessage[] = [...apiMessages, { role: "user", content: text }];
    setApiMessages(nextMessages);
    setSending(true);
    try {
      const data = await callAssistant({ messages: nextMessages });
      applyResult(data);
    } catch (err: any) {
      setError(err?.message || "Une erreur est survenue.");
    } finally {
      setSending(false);
    }
  };

  const respondToPending = async (accept: boolean) => {
    if (!pendingAction || sending) return;
    setSending(true);
    setError(null);
    try {
      const data = await callAssistant({
        messages: apiMessages,
        ...(accept ? { confirmedToolUseId: pendingAction.toolUseId } : { cancelledToolUseId: pendingAction.toolUseId }),
      });
      applyResult(data);
    } catch (err: any) {
      setError(err?.message || "Une erreur est survenue.");
    } finally {
      setSending(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-3">
      <div className="absolute inset-0 bg-slate-950/30 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 flex h-[100dvh] w-full max-w-lg flex-col overflow-hidden bg-white shadow-2xl sm:h-[85vh] sm:rounded-3xl sm:border sm:border-slate-200">
        <div className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-indigo-700 to-cyan-500 px-4 py-3 text-white">
          <div className="flex min-w-0 items-center gap-2.5">
            <img src="/loky-avatar.png" alt="Loky" className="h-8 w-8 shrink-0 rounded-full object-cover ring-2 ring-white/30" />
            <div className="min-w-0">
              <p className="text-sm font-semibold">Loky</p>
              <p className="truncate text-[0.72rem] text-white/80">Décris ce que tu veux faire, je m'en occupe.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/30 bg-white/10 text-white hover:bg-white/20"
            aria-label="Fermer"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>

        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4">
          <div className="flex items-end justify-start gap-2">
            <img src="/loky-avatar.png" alt="Loky" className="h-6 w-6 shrink-0 rounded-full object-cover" />
            <div className="max-w-[85%] rounded-2xl rounded-bl-sm border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-sm">
              Bonjour 👋 je suis Loky, que souhaitez-vous faire ?
            </div>
          </div>

          {displayMessages.map((m, i) => (
            <div key={i} className={"flex items-end gap-2 " + (m.role === "user" ? "justify-end" : "justify-start")}>
              {m.role === "assistant" && <img src="/loky-avatar.png" alt="Loky" className="h-6 w-6 shrink-0 rounded-full object-cover" />}
              <div
                className={
                  "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm shadow-sm " +
                  (m.role === "user"
                    ? "rounded-br-sm bg-slate-900 text-white"
                    : "rounded-bl-sm border border-slate-200 bg-white text-slate-800")
                }
              >
                {renderWithLinks(m.text)}
              </div>
            </div>
          ))}

          {pendingAction && (
            <div className="flex justify-start">
              <div className="max-w-[85%] rounded-2xl rounded-bl-sm border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm text-amber-900 shadow-sm">
                <p className="font-semibold">{TOOL_ACTION_LABEL[pendingAction.toolName] || "Confirmer cette action"} ?</p>
                {Array.isArray(pendingAction.summary) && pendingAction.summary.length > 0 && (
                  <div className="mt-2 space-y-1 rounded-xl bg-white/60 px-2.5 py-2">
                    {pendingAction.summary.map((row, i) => (
                      <div key={i} className="flex gap-1.5 text-xs">
                        <span className="shrink-0 font-semibold text-amber-800">{row.label} :</span>
                        <span className="min-w-0 break-words text-amber-900">{row.value}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-2.5 flex gap-2">
                  <button
                    type="button"
                    onClick={() => respondToPending(true)}
                    disabled={sending}
                    className="rounded-full bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Confirmer
                  </button>
                  <button
                    type="button"
                    onClick={() => respondToPending(false)}
                    disabled={sending}
                    className="rounded-full border border-amber-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            </div>
          )}

          {suggestedNavigations.length > 0 && !pendingAction && (
            <div className="flex flex-col items-start gap-1.5">
              {suggestedNavigations.map((nav, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    onNavigate?.(nav.section, nav.link);
                    setSuggestedNavigations([]);
                    onClose();
                  }}
                  className="flex max-w-[85%] items-center gap-2 rounded-2xl rounded-bl-sm border border-indigo-200 bg-indigo-50 px-3.5 py-2.5 text-left text-sm font-semibold text-indigo-800 shadow-sm transition hover:bg-indigo-100"
                >
                  <ArrowTopRightOnSquareIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {nav.label}
                </button>
              ))}
            </div>
          )}

          {!pendingAction && !limitReached && quotaUsedPercent != null && quotaUsedPercent >= 80 && (
            <div className="flex justify-center">
              <div className="max-w-[90%] rounded-2xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-center text-xs font-medium text-amber-800 shadow-sm">
                {quotaScope === "trial"
                  ? "Tu arrives à 80% de ton essai gratuit avec Loky. Il ne se renouvelle pas — passe à un abonnement lokt pour continuer à en profiter."
                  : "Tu as atteint 80% de ton crédit Loky inclus dans ton abonnement ce mois-ci. Ça se remet à jour le mois prochain."}
              </div>
            </div>
          )}

          {sending && !pendingAction && (
            <div className="flex items-end justify-start gap-2">
              <img src="/loky-avatar.png" alt="Loky" className="h-6 w-6 shrink-0 rounded-full object-cover" />
              <div className="rounded-2xl rounded-bl-sm border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-400 shadow-sm">
                Loky réfléchit…
              </div>
            </div>
          )}

          {error && <p className="text-center text-xs font-medium text-red-600">{error}</p>}
        </div>

        <div className="border-t border-slate-200 bg-white p-3">
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={1}
              placeholder="Ex : je veux créer un bail"
              disabled={sending || !!pendingAction || limitReached}
              className="max-h-28 flex-1 resize-none rounded-2xl border border-slate-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50"
            />
            <button
              type="button"
              onClick={() => send()}
              disabled={sending || !!pendingAction || limitReached || !input.trim()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-indigo-700 to-cyan-500 text-white disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Envoyer"
            >
              <PaperAirplaneIcon className="h-4 w-4" />
            </button>
          </div>
          {pendingAction && (
            <p className="mt-1.5 text-center text-[0.7rem] text-slate-400">Réponds à la confirmation ci-dessus avant de continuer.</p>
          )}
        </div>
      </div>
    </div>
  );
}
