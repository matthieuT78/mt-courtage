import React, { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import {
  ArrowDownTrayIcon,
  BellAlertIcon,
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  HomeModernIcon,
  InformationCircleIcon,
  PaperAirplaneIcon,
} from "@heroicons/react/24/outline";
import AppHeader from "../../components/AppHeader";
import { supabaseTenant as supabase } from "../../lib/supabaseTenantClient";
import { signOutAll } from "../../lib/authUtils";

type PortalTab = "accueil" | "alertes" | "quittances" | "documents" | "messagerie";
type PortalData = Record<string, any>;

async function authHeaders() {
  if (!supabase) throw new Error("Supabase non initialisé.");
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const token = data.session?.access_token;
  if (!token) throw new Error("Session expirée. Reconnectez-vous.");
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}
function displayTenant(tenant?: any) {
  return tenant?.full_name || [tenant?.first_name, tenant?.last_name].filter(Boolean).join(" ") || "Locataire";
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("fr-FR");
}

function formatMoney(value?: number | null) {
  return Number(value || 0).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

function openBlankWindow() {
  return window.open("", "_blank", "noopener,noreferrer");
}

export default function EspaceLocatairePage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PortalData | null>(null);
  const [active, setActive] = useState<PortalTab>("accueil");
  const [messages, setMessages] = useState<any[]>([]);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const thread = data?.threads?.[0] || null;
  const tenant = data?.tenants?.[0] || null;
  const propertyById = useMemo(() => new Map((data?.properties || []).map((row: any) => [row.id, row])), [data?.properties]);
  const leaseById = useMemo(() => new Map((data?.leases || []).map((row: any) => [row.id, row])), [data?.leases]);
  const activeLease = data?.leases?.[0] || null;
  const property: any = activeLease ? propertyById.get(activeLease.property_id) || null : null;

  const loadPortal = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const response = await fetch("/api/tenant-portal/data", { headers: await authHeaders() });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json?.error || "Chargement de l'espace locataire impossible.");
      setData(json);
    } catch (e: any) {
      setErr(e?.message || "Chargement de l'espace locataire impossible.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMessages = useCallback(async () => {
    if (!thread?.id) return;
    try {
      const response = await fetch(`/api/messaging/messages?threadId=${encodeURIComponent(thread.id)}`, { headers: await authHeaders() });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json?.error || "Chargement des messages impossible.");
      setMessages(json?.messages || []);
    } catch (e: any) {
      setErr(e?.message || "Chargement des messages impossible.");
    }
  }, [thread?.id]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!supabase) return;
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        router.replace("/espace-locataire/connexion");
        return;
      }
      if (mounted) {
        setChecking(false);
        await loadPortal();
      }
    })();
    return () => {
      mounted = false;
    };
  }, [loadPortal, router]);

  useEffect(() => {
    if (active !== "messagerie" || !thread?.id) return;
    loadMessages();
    const timer = window.setInterval(loadMessages, 12000);
    return () => window.clearInterval(timer);
  }, [active, loadMessages, thread?.id]);

  useEffect(() => {
    if (router.query.tab === "messagerie") setActive("messagerie");
  }, [router.query.tab]);

  const openDocument = async (kind: "receipt" | "inventory" | "lease_contract" | "dpe", documentId: string) => {
    const pdfWindow = openBlankWindow();
    setErr(null);
    try {
      const response = await fetch("/api/tenant-portal/document-url", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ kind, documentId }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok || !json?.signedUrl) throw new Error(json?.error || "Ouverture du document impossible.");
      if (pdfWindow) pdfWindow.location.href = json.signedUrl;
      else window.open(json.signedUrl, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      pdfWindow?.close();
      setErr(e?.message || "Ouverture du document impossible.");
    }
  };

  const sendMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!thread?.id || !body.trim()) return;
    setSending(true);
    setErr(null);
    try {
      const response = await fetch("/api/messaging/messages", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ threadId: thread.id, body }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json?.error || "Envoi impossible.");
      setBody("");
      await loadMessages();
    } catch (e: any) {
      setErr(e?.message || "Envoi impossible.");
    } finally {
      setSending(false);
    }
  };

  const tenantAlerts = useMemo(() => {
    if (!activeLease || !data) return [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const pad2 = (n: number) => String(n).padStart(2, "0");
    const currentYYYYMM = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}`;
    const prevYYYYMM = (() => {
      const d = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
    })();

    const items: Array<{ tone: "red" | "amber" | "emerald" | "slate"; icon: React.ReactNode; title: string; desc: string }> = [];

    const paymentDay = Number(activeLease.payment_day || 1);
    const dueThisMonth = new Date(today.getFullYear(), today.getMonth(), Math.min(paymentDay, 28));
    const duePassed = today.getTime() >= dueThisMonth.getTime();

    const currentPayment = (data.payments || []).find(
      (p: any) => p.lease_id === activeLease.id && String(p.period_start || "").startsWith(currentYYYYMM)
    );
    const prevPayment = (data.payments || []).find(
      (p: any) => p.lease_id === activeLease.id && String(p.period_start || "").startsWith(prevYYYYMM)
    );

    const currentReceipt = (data.receipts || []).find(
      (r: any) => r.lease_id === activeLease.id && String(r.period_start || "").startsWith(currentYYYYMM)
    );
    const prevReceipt = (data.receipts || []).find(
      (r: any) => r.lease_id === activeLease.id && String(r.period_start || "").startsWith(prevYYYYMM)
    );

    const monthLabel = today.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

    if (currentPayment?.paid_at) {
      const total = Number(currentPayment.total_amount || 0).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
      items.push({
        tone: "emerald",
        icon: <CheckCircleIcon className="h-5 w-5 text-emerald-600" />,
        title: `Loyer de ${monthLabel} confirme`,
        desc: `Votre bailleur a confirme la reception de votre loyer (${total}).`,
      });
    } else if (duePassed) {
      items.push({
        tone: "red",
        icon: <ExclamationTriangleIcon className="h-5 w-5 text-red-600" />,
        title: `Loyer de ${monthLabel} non confirme`,
        desc: `L'echeance du ${dueThisMonth.toLocaleDateString("fr-FR")} est passee et votre bailleur n'a pas encore confirme la reception de votre loyer.`,
      });
    } else {
      const euro = Number(activeLease.rent_amount || 0) + Number(activeLease.charges_amount || 0);
      items.push({
        tone: "slate",
        icon: <InformationCircleIcon className="h-5 w-5 text-slate-500" />,
        title: `Loyer de ${monthLabel} a venir`,
        desc: `Echeance le ${dueThisMonth.toLocaleDateString("fr-FR")}. Montant attendu : ${euro.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}.`,
      });
    }

    if (currentReceipt?.pdf_url) {
      items.push({
        tone: "emerald",
        icon: <DocumentTextIcon className="h-5 w-5 text-emerald-600" />,
        title: `Quittance de ${monthLabel} disponible`,
        desc: "Votre quittance de loyer est prete. Retrouvez-la dans l'onglet Quittances.",
      });
    }

    if (prevPayment?.paid_at && !prevReceipt?.pdf_url) {
      const prevMonthLabel = new Date(today.getFullYear(), today.getMonth() - 1, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
      items.push({
        tone: "amber",
        icon: <ExclamationTriangleIcon className="h-5 w-5 text-amber-600" />,
        title: `Quittance de ${prevMonthLabel} en attente`,
        desc: "Votre loyer du mois precedent a ete confirme mais la quittance n'est pas encore disponible.",
      });
    }

    return items;
  }, [activeLease, data]);

  if (checking) return null;

  const tabs: Array<{ key: PortalTab; label: string; icon: React.ReactNode; badge?: number }> = [
    { key: "accueil", label: "Accueil", icon: <HomeModernIcon className="h-4 w-4" /> },
    {
      key: "alertes",
      label: "Alertes",
      icon: <BellAlertIcon className="h-4 w-4" />,
      badge: tenantAlerts.filter((a) => a.tone === "red" || a.tone === "amber").length || undefined,
    },
    { key: "quittances", label: "Quittances", icon: <DocumentTextIcon className="h-4 w-4" /> },
    { key: "documents", label: "Documents", icon: <ArrowDownTrayIcon className="h-4 w-4" /> },
    { key: "messagerie", label: "Messagerie", icon: <ChatBubbleLeftRightIcon className="h-4 w-4" /> },
  ];

  return (
    <div className="min-h-screen bg-[#f6f9fc]">
      <Head>
        <title>Espace locataire | lokt.fr</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <AppHeader />

      <main className="mx-auto max-w-7xl px-4 py-6">
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="h-1.5 bg-gradient-to-r from-[#635bff] via-[#00d4ff] to-[#00e5a8]" />
          <div className="p-5">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-indigo-700">Espace locataire</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-950">Bonjour {displayTenant(tenant)}</h1>
            <p className="mt-2 text-sm text-slate-600">
              Retrouvez vos documents locatifs et échangez directement avec votre bailleur.
            </p>
          </div>
        </div>

        {err ? <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div> : null}
        {loading ? <div className="mt-4 text-sm text-slate-500">Chargement de votre espace...</div> : null}

        {!loading && data ? (
          <div className="mt-4 grid gap-4 lg:grid-cols-[230px,1fr]">
            <nav className="h-max rounded-3xl border border-slate-200 bg-white p-2 shadow-sm">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActive(tab.key)}
                  className={`flex w-full items-center gap-2 rounded-2xl px-3 py-2.5 text-left text-sm font-semibold transition ${
                    active === tab.key ? "bg-slate-950 text-white" : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {tab.icon}
                  <span className="flex-1">{tab.label}</span>
                  {tab.badge ? (
                    <span className={`flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1 text-[0.65rem] font-bold ${active === tab.key ? "bg-white text-slate-950" : "bg-red-500 text-white"}`}>
                      {tab.badge}
                    </span>
                  ) : null}
                </button>
              ))}
              <div className="mt-1 border-t border-slate-100 pt-1">
                <button
                  type="button"
                  onClick={async () => { await signOutAll(); window.location.href = "/"; }}
                  className="flex w-full items-center gap-2 rounded-2xl px-3 py-2.5 text-left text-sm font-semibold text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
                >
                  Se deconnecter
                </button>
              </div>
            </nav>

            <section className="min-w-0 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              {active === "accueil" ? (
                <div>
                  <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-slate-500">Votre location</p>
                  <h2 className="mt-1 text-xl font-semibold text-slate-950">{property?.label || property?.address_line1 || "Logement"}</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    {[property?.address_line1, property?.postal_code, property?.city].filter(Boolean).join(", ") || "Adresse non renseignée"}
                  </p>
                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <Stat label="Début du bail" value={formatDate(activeLease?.start_date)} />
                    <Stat label="Quittances disponibles" value={String(data.receipts?.length || 0)} />
                    <Stat label="Documents" value={String((data.inventoryReports?.length || 0) + (data.leaseContracts?.length || 0) + (data.dpes?.length || 0))} />
                  </div>
                </div>
              ) : null}

              {active === "alertes" ? (
                <div>
                  <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-slate-500">Alertes</p>
                  <h2 className="mt-1 text-xl font-semibold text-slate-950">Etat de votre location</h2>
                  <div className="mt-5 space-y-3">
                    {tenantAlerts.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                        Aucune alerte pour le moment.
                      </div>
                    ) : null}
                    {tenantAlerts.map((alert, i) => (
                      <div
                        key={i}
                        className={`flex gap-3 rounded-2xl border p-4 ${
                          alert.tone === "red"
                            ? "border-red-200 bg-red-50"
                            : alert.tone === "amber"
                            ? "border-amber-200 bg-amber-50"
                            : alert.tone === "emerald"
                            ? "border-emerald-200 bg-emerald-50"
                            : "border-slate-200 bg-slate-50"
                        }`}
                      >
                        <div className="mt-0.5 shrink-0">{alert.icon}</div>
                        <div>
                          <p className="text-sm font-semibold text-slate-950">{alert.title}</p>
                          <p className="mt-0.5 text-xs text-slate-600">{alert.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {active === "quittances" ? (
                <DocumentList
                  title="Vos quittances"
                  empty="Aucune quittance PDF disponible pour le moment."
                  rows={(data.receipts || []).map((receipt: any) => ({
                    id: receipt.id,
                    title: `Quittance - ${formatDate(receipt.period_start)}`,
                    subtitle: `${formatMoney(receipt.total_amount)} · période du ${formatDate(receipt.period_start)} au ${formatDate(receipt.period_end)}`,
                  }))}
                  onOpen={(id) => openDocument("receipt", id)}
                />
              ) : null}

              {active === "documents" ? (
                <div className="space-y-7">
                  <DocumentList
                    title="Contrat de location"
                    empty="Aucun bail signé disponible pour le moment."
                    rows={(data.leaseContracts || []).map((contract: any) => ({
                      id: contract.id,
                      title: "Bail signé",
                      subtitle: `${formatDate(contract.signed_at)} · ${contract.document_source === "external" ? "document transmis par le bailleur" : contract.contract_kind || "contrat de location"}`,
                    }))}
                    onOpen={(id) => openDocument("lease_contract", id)}
                  />
                  <DocumentList
                    title="Diagnostics énergétiques"
                    empty="Aucun DPE disponible pour le moment."
                    rows={(data.dpes || []).map((dpe: any) => ({
                      id: dpe.id,
                      title: "Diagnostic de performance énergétique",
                      subtitle: `${dpe.file_name} · ${formatDate(dpe.created_at)}`,
                    }))}
                    onOpen={(id) => openDocument("dpe", id)}
                  />
                  <DocumentList
                    title="États des lieux"
                    empty="Aucun état des lieux PDF disponible pour le moment."
                    rows={(data.inventoryReports || []).map((report: any) => ({
                      id: report.id,
                      title: report.report_type === "exit" ? "État des lieux de sortie" : "État des lieux d'entrée",
                      subtitle: `${formatDate(report.performed_at)} · ${report.status || "document"}`,
                    }))}
                    onOpen={(id) => openDocument("inventory", id)}
                  />
                </div>
              ) : null}

              {active === "messagerie" ? (
                <div className="flex min-h-[540px] flex-col">
                  <div>
                    <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-indigo-700">Messagerie</p>
                    <h2 className="mt-1 text-xl font-semibold text-slate-950">Échanger avec votre bailleur</h2>
                  </div>
                  <div className="mt-4 flex-1 space-y-3 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    {messages.length === 0 ? <p className="text-sm text-slate-500">Aucun message pour le moment.</p> : null}
                    {messages.map((message) => (
                      <div key={message.id} className={`flex ${message.sender_role === "tenant" ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${message.sender_role === "tenant" ? "bg-slate-950 text-white" : "border border-slate-200 bg-white text-slate-800"}`}>
                          <p className="whitespace-pre-wrap">{message.body}</p>
                          <p className="mt-1 text-[0.65rem] opacity-60">{formatDate(message.created_at)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <form onSubmit={sendMessage} className="mt-3 flex gap-2">
                    <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} placeholder="Écrire un message..." className="flex-1 resize-none rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                    <button type="submit" disabled={sending || !body.trim()} className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-slate-950 text-white disabled:opacity-50" title="Envoyer">
                      <PaperAirplaneIcon className="h-5 w-5" />
                    </button>
                  </form>
                </div>
              ) : null}
            </section>
          </div>
        ) : null}
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function DocumentList({
  title,
  empty,
  rows,
  onOpen,
}: {
  title: string;
  empty: string;
  rows: Array<{ id: string; title: string; subtitle: string }>;
  onOpen: (id: string) => void;
}) {
  return (
    <div>
      <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-indigo-700">Documents</p>
      <h2 className="mt-1 text-xl font-semibold text-slate-950">{title}</h2>
      <div className="mt-4 space-y-2">
        {rows.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-600">{empty}</div> : null}
        {rows.map((row) => (
          <div key={row.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-950">{row.title}</p>
              <p className="mt-1 text-xs text-slate-500">{row.subtitle}</p>
            </div>
            <button type="button" onClick={() => onOpen(row.id)} className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800">
              <ArrowDownTrayIcon className="h-4 w-4" />
              Ouvrir le PDF
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
