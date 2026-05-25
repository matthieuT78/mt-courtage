import { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import AppHeader from "../components/AppHeader";
import { supabase } from "../lib/supabaseClient";

type Lease = {
  id: string;
  user_id: string;
  property_id: string | null;
  tenant_id: string | null;
  start_date: string | null;
  rent_amount: number | null;
  charges_amount: number | null;
  payment_day: number | null;
  payment_method: string | null;
  status: string | null;
};

type Property = {
  id: string;
  label: string | null;
  city: string | null;
};

type Tenant = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type Receipt = {
  id: string;
  lease_id: string;
  period_start: string;
  period_end: string;
  total_amount: number | null;
  status: string | null;
  pdf_url: string | null;
  sent_at: string | null;
  sent_to_tenant_email: string | null;
  send_error: string | null;
  created_at: string | null;
};

type UserLite = {
  id: string;
  email?: string | null;
};

const pad2 = (n: number) => String(n).padStart(2, "0");
const isoDate = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const monthStart = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), 1);
const monthEnd = (d = new Date()) => new Date(d.getFullYear(), d.getMonth() + 1, 0);

function formatEuro(v: number | null | undefined) {
  if (v == null) return "-";
  return Number(v).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

async function parseResponse(resp: Response) {
  const raw = await resp.text();
  let json: any = null;
  try {
    json = raw ? JSON.parse(raw) : null;
  } catch {}
  if (!resp.ok) throw new Error(json?.error || raw || `Erreur ${resp.status}`);
  return json ?? {};
}

export default function TestQuittancePage() {
  const router = useRouter();

  const [checking, setChecking] = useState(true);
  const [user, setUser] = useState<UserLite | null>(null);
  const [leases, setLeases] = useState<Lease[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);

  const [leaseId, setLeaseId] = useState("");
  const [periodStart, setPeriodStart] = useState(isoDate(monthStart()));
  const [periodEnd, setPeriodEnd] = useState(isoDate(monthEnd()));
  const [receiptId, setReceiptId] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [lastJson, setLastJson] = useState<any>(null);
  const [lastPdfUrl, setLastPdfUrl] = useState<string | null>(null);
  const [lastReceiptId, setLastReceiptId] = useState<string | null>(null);
  const [confirmUrl, setConfirmUrl] = useState<string | null>(null);
  const [confirmToken, setConfirmToken] = useState<string | null>(null);

  const propertyById = useMemo(() => new Map(properties.map((p) => [p.id, p])), [properties]);
  const tenantById = useMemo(() => new Map(tenants.map((t) => [t.id, t])), [tenants]);
  const selectedLease = useMemo(() => leases.find((l) => l.id === leaseId) || null, [leases, leaseId]);
  const selectedReceipt = useMemo(() => receipts.find((r) => r.id === receiptId) || null, [receipts, receiptId]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      if (!supabase) {
        setErr("Supabase non initialise.");
        setChecking(false);
        return;
      }

      try {
        const { data } = await supabase.auth.getSession();
        const sessionUser = data.session?.user;
        if (!mounted) return;

        if (!sessionUser?.id) {
          router.replace(`/mon-compte?mode=login&redirect=${encodeURIComponent("/test-quittance")}`);
          return;
        }

        setUser({ id: sessionUser.id, email: sessionUser.email });
      } finally {
        if (mounted) setChecking(false);
      }
    })();

    const { data: sub } =
      supabase?.auth.onAuthStateChange((_event, session) => {
        const sessionUser = session?.user;
        if (!sessionUser?.id) {
          router.replace(`/mon-compte?mode=login&redirect=${encodeURIComponent("/test-quittance")}`);
          return;
        }
        setUser({ id: sessionUser.id, email: sessionUser.email });
      }) ?? { data: { subscription: { unsubscribe: () => {} } } };

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, [router]);

  const authHeaders = async () => {
    if (!supabase) throw new Error("Supabase non initialise.");
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    const token = data.session?.access_token;
    if (!token) throw new Error("Session expiree. Reconnecte-toi.");
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  };

  const refresh = async () => {
    if (!supabase || !user?.id) return;

    setLoading("refresh");
    setErr(null);
    try {
      const [leaseRes, propertyRes, tenantRes, receiptRes] = await Promise.all([
        supabase.from("leases").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("properties").select("id,label,city").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("tenants").select("id,full_name,email").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase
          .from("rent_receipts")
          .select("id,lease_id,period_start,period_end,total_amount,status,pdf_url,sent_at,sent_to_tenant_email,send_error,created_at")
          .order("created_at", { ascending: false })
          .limit(50),
      ]);

      if (leaseRes.error) throw leaseRes.error;
      if (propertyRes.error) throw propertyRes.error;
      if (tenantRes.error) throw tenantRes.error;
      if (receiptRes.error) throw receiptRes.error;

      const nextLeases = (leaseRes.data as Lease[]) || [];
      const nextReceipts = (receiptRes.data as Receipt[]) || [];
      setLeases(nextLeases);
      setProperties((propertyRes.data as Property[]) || []);
      setTenants((tenantRes.data as Tenant[]) || []);
      setReceipts(nextReceipts);

      if (!leaseId && nextLeases[0]?.id) setLeaseId(nextLeases[0].id);
      if (!receiptId && nextReceipts[0]?.id) setReceiptId(nextReceipts[0].id);
    } catch (e: any) {
      setErr(e?.message || "Chargement impossible.");
    } finally {
      setLoading(null);
    }
  };

  useEffect(() => {
    if (user?.id) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const runAction = async (name: string, fn: () => Promise<any>) => {
    setLoading(name);
    setErr(null);
    setOk(null);
    setLastJson(null);

    try {
      const json = await fn();
      setLastJson(json);
      if (json?.receipt_id) {
        setReceiptId(json.receipt_id);
        setLastReceiptId(json.receipt_id);
      }
      if (json?.signedUrl) setLastPdfUrl(json.signedUrl);
      if (json?.confirmUrl) setConfirmUrl(json.confirmUrl);
      if (json?.token) setConfirmToken(json.token);
      setOk("Action executee. Si un PDF a ete genere, le lien apparait ci-dessous.");
      await refresh();
      return json;
    } catch (e: any) {
      setErr(e?.message || "Action impossible.");
      return null;
    } finally {
      setLoading(null);
    }
  };

  const generatePdf = async () => {
    if (!user?.id || !leaseId) throw new Error("Choisis un bail.");
    const resp = await fetch("/api/receipts/generate", {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ userId: user.id, leaseId, periodStart, periodEnd }),
    });
    const json = await parseResponse(resp);
    if (json.receipt_id) {
      setReceiptId(json.receipt_id);
      setLastReceiptId(json.receipt_id);
    }
    if (json.signedUrl) setLastPdfUrl(json.signedUrl);
    return json;
  };

  const markPaid = async () => {
    if (!user?.id || !leaseId) throw new Error("Choisis un bail.");
    const resp = await fetch("/api/payments/confirm", {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ userId: user.id, leaseId, periodStart, periodEnd }),
    });
    return parseResponse(resp);
  };

  const sendMail = async () => {
    if (!user?.id || !receiptId) throw new Error("Choisis ou genere une quittance.");
    const resp = await fetch("/api/receipts/send", {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ userId: user.id, receiptId, resendOnly: true }),
    });
    return parseResponse(resp);
  };

  const confirmThenGenerateThenSend = async () => {
    const generated = await generatePdf();
    await markPaid();
    const nextReceiptId = generated?.receipt_id || receiptId;
    if (!nextReceiptId) throw new Error("Quittance introuvable apres generation.");

    const resp = await fetch("/api/receipts/send", {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ userId: user?.id, receiptId: nextReceiptId, resendOnly: true }),
    });
    return parseResponse(resp);
  };

  const openPdf = async () => {
    if (!receiptId) throw new Error("Choisis une quittance.");
    const resp = await fetch("/api/receipts/signed-url", {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ receiptId }),
    });
    const json = await parseResponse(resp);
    if (json.signedUrl) {
      setLastPdfUrl(json.signedUrl);
      window.open(json.signedUrl, "_blank", "noopener,noreferrer");
    }
    return json;
  };

  const runReminderCron = async () => {
    const resp = await fetch("/api/cron/rent-reminders");
    return parseResponse(resp);
  };

  const createConfirmPaidLink = async () => {
    if (!user?.id || !leaseId) throw new Error("Choisis un bail.");
    const resp = await fetch("/api/test/receipt-confirm-token", {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ userId: user.id, leaseId, periodStart, periodEnd }),
    });
    return parseResponse(resp);
  };

  const sendOwnerReminderTestEmail = async () => {
    if (!user?.id || !leaseId) throw new Error("Choisis un bail.");
    const resp = await fetch("/api/test/rent-reminder-email", {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ userId: user.id, leaseId, periodStart, periodEnd, toEmail: user.email }),
    });
    return parseResponse(resp);
  };

  const openConfirmPaidLink = async () => {
    if (!confirmUrl) throw new Error("Cree d'abord un lien unique Loyer recu.");
    const opened = window.open(confirmUrl, "_blank", "noopener,noreferrer");
    return {
      ok: true,
      confirmUrl,
      popupOpened: !!opened,
      message: "Lien ouvert. Cette page confirme le paiement, genere la quittance et tente l'envoi au locataire.",
    };
  };

  if (checking) {
    return (
      <main className="min-h-screen bg-slate-50 text-slate-900">
        <AppHeader />
        <div className="mx-auto max-w-5xl px-4 py-10 text-sm text-slate-600">Verification de la session...</div>
      </main>
    );
  }

  const buttonBase =
    "rounded-lg border px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <Head>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <AppHeader />

      <div className="mx-auto max-w-6xl px-4 py-8 space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Page test</p>
            <h1 className="mt-1 text-2xl font-bold">Test quittance</h1>
            <p className="mt-1 text-sm text-slate-600">
              Genere une quittance, confirme un paiement, teste le clic "Loyer recu", ouvre le PDF et teste l'envoi email avec les vrais endpoints.
            </p>
          </div>
          <Link href="/espace-bailleur" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50">
            Retour espace bailleur
          </Link>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Cette page est volontairement technique. Les actions creent ou modifient de vraies lignes Supabase et peuvent envoyer de vrais emails si
          Resend est configure. Le lien "Loyer recu" cree un token unique, comme le lien envoye au proprietaire par email.
        </div>

        {err ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{err}</div> : null}
        {ok ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{ok}</div> : null}

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="md:col-span-2">
              <label className="text-xs font-semibold text-slate-700">Bail</label>
              <select value={leaseId} onChange={(e) => setLeaseId(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <option value="">Selectionner</option>
                {leases.map((lease) => {
                  const property = lease.property_id ? propertyById.get(lease.property_id) : null;
                  const tenant = lease.tenant_id ? tenantById.get(lease.tenant_id) : null;
                  return (
                    <option key={lease.id} value={lease.id}>
                      {property?.label || "Bien"} - {tenant?.full_name || "Locataire"} - {formatEuro(Number(lease.rent_amount || 0) + Number(lease.charges_amount || 0))}
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700">Debut periode</label>
              <input
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700">Fin periode</label>
              <input
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          {selectedLease ? (
            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              Bail actif pour test : paiement J{selectedLease.payment_day || "-"} par {selectedLease.payment_method || "-"}.
            </div>
          ) : null}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap gap-2">
            <button disabled={!!loading} onClick={() => runAction("generate", generatePdf)} className={`${buttonBase} border-slate-900 bg-slate-900 text-white hover:bg-slate-800`}>
              Generer PDF
            </button>
            <button disabled={!!loading} onClick={() => runAction("paid", markPaid)} className={`${buttonBase} border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100`}>
              Marquer paye
            </button>
            <button disabled={!!loading} onClick={() => runAction("confirm-link", createConfirmPaidLink)} className={`${buttonBase} border-teal-300 bg-teal-50 text-teal-950 hover:bg-teal-100`}>
              Creer lien Loyer recu
            </button>
            <button disabled={!!loading} onClick={() => runAction("owner-mail-test", sendOwnerReminderTestEmail)} className={`${buttonBase} border-orange-300 bg-orange-50 text-orange-950 hover:bg-orange-100`}>
              Envoyer mail bailleur test
            </button>
            <button disabled={!!loading || !confirmUrl} onClick={() => runAction("confirm-click", openConfirmPaidLink)} className={`${buttonBase} border-emerald-400 bg-emerald-600 text-white hover:bg-emerald-500`}>
              Cliquer Loyer recu
            </button>
            <button disabled={!!loading} onClick={() => runAction("send", sendMail)} className={`${buttonBase} border-sky-300 bg-sky-50 text-sky-900 hover:bg-sky-100`}>
              Envoyer email
            </button>
            <button disabled={!!loading} onClick={() => runAction("full", confirmThenGenerateThenSend)} className={`${buttonBase} border-indigo-300 bg-indigo-50 text-indigo-900 hover:bg-indigo-100`}>
              Test complet
            </button>
            <button disabled={!!loading} onClick={() => runAction("open", openPdf)} className={`${buttonBase} border-slate-300 bg-white text-slate-800 hover:bg-slate-50`}>
              Ouvrir PDF
            </button>
            <button disabled={!!loading} onClick={() => runAction("cron", runReminderCron)} className={`${buttonBase} border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100`}>
              Lancer cron rappel
            </button>
            <button disabled={!!loading} onClick={() => refresh()} className={`${buttonBase} border-slate-300 bg-white text-slate-800 hover:bg-slate-50`}>
              Rafraichir
            </button>
          </div>

          {loading ? <p className="mt-3 text-sm text-slate-600">Action en cours : {loading}</p> : null}

          {lastPdfUrl ? (
            <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">
              <p className="font-semibold">PDF prêt</p>
              <p className="mt-1">
                Quittance : <span className="font-mono text-xs">{lastReceiptId || receiptId || "-"}</span>
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href={lastPdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-600"
                >
                  Voir le PDF
                </a>
                <button
                  type="button"
                  onClick={() => navigator.clipboard?.writeText(lastPdfUrl)}
                  className="rounded-lg border border-emerald-300 bg-white px-4 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-100"
                >
                  Copier le lien
                </button>
              </div>
              <p className="mt-2 text-xs text-emerald-800">Le lien est temporaire. Si besoin, clique sur “Ouvrir PDF” pour en regenerer un.</p>
            </div>
          ) : null}

          {confirmUrl ? (
            <div className="mt-4 rounded-lg border border-teal-200 bg-teal-50 p-3 text-sm text-teal-950">
              <p className="font-semibold">Lien unique "Loyer recu" prêt</p>
              <p className="mt-1">
                Token : <span className="break-all font-mono text-xs">{confirmToken || "-"}</span>
              </p>
              <p className="mt-1 text-xs text-teal-800">
                Ce lien est a usage unique. En l'ouvrant, tu confirmes le paiement pour la periode choisie, puis le workflow genere la quittance et tente l'envoi email.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href={confirmUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-600"
                >
                  Ouvrir le lien
                </a>
                <button
                  type="button"
                  onClick={() => navigator.clipboard?.writeText(confirmUrl)}
                  className="rounded-lg border border-teal-300 bg-white px-4 py-2 text-xs font-semibold text-teal-900 hover:bg-teal-100"
                >
                  Copier le lien
                </button>
              </div>
            </div>
          ) : null}
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold">Quittances recentes</h2>
            <select value={receiptId} onChange={(e) => setReceiptId(e.target.value)} className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="">Selectionner</option>
              {receipts.map((receipt) => (
                <option key={receipt.id} value={receipt.id}>
                  {receipt.period_start} au {receipt.period_end} - {receipt.status || "-"} - {receipt.id.slice(0, 8)}
                </option>
              ))}
            </select>

            {selectedReceipt ? (
              <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 space-y-1">
                <p>
                  <span className="font-semibold">ID :</span> {selectedReceipt.id}
                </p>
                <p>
                  <span className="font-semibold">Statut :</span> {selectedReceipt.status || "-"}
                </p>
                <p>
                  <span className="font-semibold">PDF :</span> {selectedReceipt.pdf_url ? "present" : "absent"}
                </p>
                <p>
                  <span className="font-semibold">Email :</span> {selectedReceipt.sent_at ? `envoye a ${selectedReceipt.sent_to_tenant_email || "-"}` : "non envoye"}
                </p>
                {selectedReceipt.send_error ? <p className="text-red-700">Erreur email : {selectedReceipt.send_error}</p> : null}
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-500">Aucune quittance selectionnee.</p>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold">Derniere reponse API</h2>
            <pre className="mt-3 max-h-80 overflow-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-100">
              {lastJson ? JSON.stringify(lastJson, null, 2) : "Aucune action lancee."}
            </pre>
          </div>
        </section>
      </div>
    </main>
  );
}
