// components/landlord/sections/SectionQuittances.tsx
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { SectionTitle, fmtDate } from "../UiBits";
import type { RentReceipt, Lease, Property, Tenant, LandlordSettings } from "../../../lib/landlord/types";

type Props = {
  userId: string;
  userEmail?: string | null;
  landlord?: LandlordSettings | null;

  receipts?: RentReceipt[];
  leases?: Lease[];
  propertyById?: Map<string, Property>;
  tenantById?: Map<string, Tenant>;

  onRefresh: () => Promise<void>;
};

type EmailDiag = {
  active: boolean;
  provider: "resend" | "none";
  from: string | null;
  info: string;
};

const toMonthISO = (d: Date) => d.toISOString().slice(0, 7);
const toISODate = (d: Date) => d.toISOString().slice(0, 10);

const monthStartEnd = (yyyymm: string) => {
  const [y, m] = yyyymm.split("-").map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0);
  return { start, end };
};

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

function parsePdfUrl(pdfUrl?: string | null) {
  // expected: rent-receipts-pdfs:<path>
  if (!pdfUrl) return null;
  const [bucket, path] = String(pdfUrl).split(":");
  if (bucket !== "rent-receipts-pdfs" || !path) return null;
  return { bucket, path };
}

function yyyymmFromReceipt(r: any) {
  const ps = String(r?.period_start || "");
  return ps ? ps.slice(0, 7) : "";
}

function isSameMonth(d: Date, yyyymm: string) {
  const m = toMonthISO(d);
  return m === yyyymm;
}

function safeDate(val?: string | null) {
  if (!val) return null;
  const d = new Date(val);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Détermine la date de "due" (payment_day + 2) pour un mois donné
 * ex: payment_day=4 => due=6 du mois
 */
function dueDateForMonth(yyyymm: string, paymentDay: number) {
  const [y, m] = yyyymm.split("-").map(Number);
  const base = new Date(y, m - 1, Math.max(1, Math.min(28, Number(paymentDay || 1)))); // clamp simple
  base.setDate(base.getDate() + 2);
  return base;
}

function pillTone(status: string) {
  const s = String(status || "").toLowerCase();
  if (s === "sent") return "bg-emerald-100 text-emerald-900 border-emerald-200";
  if (s === "generated") return "bg-amber-100 text-amber-900 border-amber-200";
  if (s === "error") return "bg-red-100 text-red-900 border-red-200";
  return "bg-slate-100 text-slate-800 border-slate-200";
}

function statusLabel(status?: string | null) {
  const s = String(status || "").toLowerCase();
  if (s === "sent") return "Envoyée";
  if (s === "generated") return "En attente de confirmation";
  if (s === "error") return "Erreur";
  if (!s) return "—";
  return status!;
}

function Card({
  title,
  children,
  right,
  tone = "white",
}: {
  title: React.ReactNode;
  children: React.ReactNode;
  right?: React.ReactNode;
  tone?: "white" | "muted";
}) {
  return (
    <div className={cx("rounded-3xl border border-slate-200 shadow-sm", tone === "muted" ? "bg-slate-50" : "bg-white")}>
      <div className="p-4 md:p-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">{title}</p>
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
      <div className="px-4 md:px-5 pb-4 md:pb-5">{children}</div>
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-slate-900">{value}</p>
      {sub ? <p className="mt-1 text-xs text-slate-600">{sub}</p> : null}
    </div>
  );
}

export function SectionQuittances({
  userId,
  userEmail,
  landlord,
  receipts,
  leases,
  propertyById,
  tenantById,
  onRefresh,
}: Props) {
  const safeReceipts = Array.isArray(receipts) ? receipts : [];
  const safeLeases = Array.isArray(leases) ? leases : [];
  const propsById = propertyById instanceof Map ? propertyById : new Map<string, Property>();
  const tenantsById = tenantById instanceof Map ? tenantById : new Map<string, Tenant>();

  const [month, setMonth] = useState<string>(toMonthISO(new Date()));
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null);

  const [emailDiag, setEmailDiag] = useState<EmailDiag>({
    active: false,
    provider: "resend",
    from: null,
    info: "RESEND_API_KEY / RESEND_FROM manquants.",
  });

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const selectedReceipt = useMemo(
    () => safeReceipts.find((r: any) => r.id === selectedReceiptId) || null,
    [safeReceipts, selectedReceiptId]
  );

  const leaseLabel = (lease: Lease) => {
    const p = propsById.get((lease as any).property_id);
    const t = tenantsById.get((lease as any).tenant_id);
    return `${p?.label || "Bien"} — ${t?.full_name || "Locataire"}`;
  };

  // ---------- EMAIL DIAG (fallback local, + essaye API diag si tu l'ajoutes)
  useEffect(() => {
    let cancelled = false;

    (async () => {
      // Optionnel: si tu crées /api/diagnostics/email, la page l'utilise.
      // Sinon: fallback sur message statique (utile sans domaine).
      try {
        const r = await fetch("/api/diagnostics/email");
        if (!r.ok) throw new Error("no_diag");
        const j = await r.json();
        if (cancelled) return;

        setEmailDiag({
          active: !!j?.active,
          provider: j?.provider || "resend",
          from: j?.from || null,
          info: j?.info || "",
        });
      } catch {
        if (cancelled) return;
        setEmailDiag((s) => s);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // ---------- Receipts du mois sélectionné
  const monthReceipts = useMemo(() => {
    return safeReceipts
      .filter((r: any) => yyyymmFromReceipt(r) === month)
      .sort((a: any, b: any) => String(b.period_start).localeCompare(String(a.period_start)));
  }, [safeReceipts, month]);

  // ---------- “Quittances à confirmer” = generated du mois sélectionné
  const pendingThisMonth = useMemo(() => {
    return monthReceipts.filter((r: any) => String(r.status || "").toLowerCase() === "generated");
  }, [monthReceipts]);

  // ---------- “Confirmées” = sent du mois sélectionné
  const sentThisMonth = useMemo(() => {
    return monthReceipts.filter((r: any) => String(r.status || "").toLowerCase() === "sent");
  }, [monthReceipts]);

  // ---------- Retards = quittances generated dont due_date (payment_day+2) est passée
  const lateThisMonth = useMemo(() => {
    const now = new Date();
    return pendingThisMonth.filter((r: any) => {
      const lease = safeLeases.find((l: any) => l.id === r.lease_id) as any;
      const payDay = Number(lease?.payment_day || 1);
      const due = dueDateForMonth(month, payDay);
      return now.getTime() > due.getTime();
    });
  }, [pendingThisMonth, safeLeases, month]);

  // ---------- Dashboard “où j’en suis”
  const dashboard = useMemo(() => {
    const total = monthReceipts.length;
    const pending = pendingThisMonth.length;
    const sent = sentThisMonth.length;
    const late = lateThisMonth.length;

    // last sent (global, sur baux actifs)
    const lastSent = safeReceipts
      .filter((r: any) => (r.sent_at ? true : false))
      .map((r: any) => safeDate(r.sent_at))
      .filter(Boolean) as Date[];

    const lastSentAt = lastSent.length ? new Date(Math.max(...lastSent.map((d) => d.getTime()))) : null;

    return { total, pending, sent, late, lastSentAt };
  }, [monthReceipts, pendingThisMonth.length, sentThisMonth.length, lateThisMonth.length, safeReceipts]);

  // ---------- Archives groupées (Biens -> Année -> Mois)
  const archives = useMemo(() => {
    const byProperty = new Map<
      string,
      {
        propertyId: string;
        label: string;
        years: Map<string, any[]>;
      }
    >();

    for (const r of safeReceipts as any[]) {
      const lease = safeLeases.find((l: any) => l.id === r.lease_id) as any;
      const propertyId = String(lease?.property_id || "—");
      const p = propertyId !== "—" ? propsById.get(propertyId) : null;
      const propLabel = p?.label || "Non affecté";

      const yyyymm = yyyymmFromReceipt(r);
      const year = yyyymm ? yyyymm.slice(0, 4) : "—";

      const bucket = byProperty.get(propertyId) || {
        propertyId,
        label: propLabel,
        years: new Map<string, any[]>(),
      };

      const arr = bucket.years.get(year) || [];
      arr.push(r);
      bucket.years.set(year, arr);
      byProperty.set(propertyId, bucket);
    }

    // tri interne
    const propsArr = Array.from(byProperty.values()).sort((a, b) => a.label.localeCompare(b.label));
    for (const p of propsArr) {
      for (const [y, arr] of p.years.entries()) {
        arr.sort((a: any, b: any) => String(b.period_start).localeCompare(String(a.period_start)));
        p.years.set(y, arr);
      }
    }
    return propsArr;
  }, [safeReceipts, safeLeases, propsById]);

  // ---------- Actions
  const openPdf = async (r: any) => {
    setErr(null);
    setOk(null);

    const parsed = parsePdfUrl(r?.pdf_url);
    if (!parsed) {
      setErr("PDF manquant ou pdf_url invalide. (Attendu rent-receipts-pdfs:<path>)");
      return;
    }

    try {
      setLoading(true);
      const resp = await fetch("/api/receipts/signed-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdf_url: r.pdf_url }),
      });
      const raw = await resp.text();
      let json: any = null;
      try {
        json = raw ? JSON.parse(raw) : null;
      } catch {}
      if (!resp.ok) throw new Error(json?.error || raw || `Erreur ${resp.status}`);
      if (json?.signedUrl) window.open(json.signedUrl, "_blank", "noopener,noreferrer");
      else setErr("SignedUrl manquant.");
    } catch (e: any) {
      setErr(e?.message || "Impossible d’ouvrir le PDF.");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Workaround “Confirm paiement” depuis l’app (utile même sans email configuré)
   * => doit déclencher la logique métier de confirmation
   * - crée/MAJ paiement
   * - crée l'entrée Finance (rent)
   * - tente email locataire + cc bailleur (si email configuré)
   */
  const confirmPaidFromApp = async (receipt: any) => {
    setErr(null);
    setOk(null);

    if (!receipt?.id) return;

    try {
      setLoading(true);
      const resp = await fetch("/api/receipts/confirm-manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, receiptId: receipt.id }),
      });
      const raw = await resp.text();
      let json: any = null;
      try {
        json = raw ? JSON.parse(raw) : null;
      } catch {}
      if (!resp.ok) throw new Error(json?.error || raw || `Erreur ${resp.status}`);

      setOk("Paiement confirmé ✅ (Finance mise à jour, et envoi tenté).");
      await onRefresh();
    } catch (e: any) {
      setErr(e?.message || "Erreur confirmation paiement.");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Renvoyer une quittance déjà archivée sans toucher la finance
   * -> utilise /api/receipts/send (ton endpoint actuel de resend)
   */
  const resendArchivedNoFinance = async (receipt: any) => {
    setErr(null);
    setOk(null);

    try {
      setLoading(true);
      const resp = await fetch("/api/receipts/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, receiptId: receipt.id, resendOnly: true }),
      });

      const raw = await resp.text();
      let json: any = null;
      try {
        json = raw ? JSON.parse(raw) : null;
      } catch {}
      if (!resp.ok) throw new Error(json?.error || raw || `Erreur ${resp.status}`);

      setOk("Quittance renvoyée ✅ (sans impact Finance).");
      await onRefresh();

      if (json?.signedUrl) window.open(json.signedUrl, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      setErr(e?.message || "Erreur renvoi quittance.");
    } finally {
      setLoading(false);
    }
  };

  const monthLabel = useMemo(() => {
    const { start } = monthStartEnd(month);
    return start.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  }, [month]);

  return (
    <div className="rounded-3xl border border-slate-200 bg-white shadow-sm p-5 space-y-5">
      <SectionTitle
        kicker="Quittances"
        title="Suivi clair : générées → confirmées → envoyées"
        desc="V1 : la quittance est générée automatiquement (J+2 après le jour de paiement). La Finance ne bouge qu’au moment où tu confirmes le paiement."
      />

      {/* Notice “comment ça marche” */}
      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-slate-900">Comment ça marche (simple)</p>
            <ol className="mt-2 space-y-1 text-sm text-slate-700 list-decimal pl-5">
              <li>
                <span className="font-semibold">J+2</span> après le <span className="font-semibold">jour de paiement</span> du bail : quittance PDF{" "}
                <span className="font-semibold">générée</span> et archivée.
              </li>
              <li>
                Tant que tu ne confirmes pas “payé”, la quittance reste{" "}
                <span className="font-semibold">en attente de confirmation</span> et la Finance ne change pas.
              </li>
              <li>
                Quand tu confirmes “payé” : <span className="font-semibold">Finance mise à jour</span> + envoi au locataire (si email dispo).
              </li>
            </ol>
          </div>

          {/* Email diagnostic */}
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 w-full md:w-[360px]">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Diagnostic email</p>
            <div className="mt-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-900">
                {emailDiag.active ? "Email configuré" : "Email non configuré — l’envoi échouera"}
              </p>
              <span
                className={cx(
                  "rounded-full border px-2 py-1 text-[0.7rem] font-semibold",
                  emailDiag.active ? "bg-emerald-100 text-emerald-900 border-emerald-200" : "bg-slate-100 text-slate-800 border-slate-200"
                )}
              >
                {emailDiag.active ? "ACTIF" : "INACTIF"}
              </span>
            </div>
            <div className="mt-2 text-sm text-slate-700 space-y-1">
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">Provider</span>
                <span className="font-semibold">{emailDiag.provider}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">From</span>
                <span className="font-semibold">{emailDiag.from || "—"}</span>
              </div>
              <p className="text-xs text-slate-500">Info : {emailDiag.info || "—"}</p>
              <p className="text-xs text-slate-500">
                Astuce : même sans email, tu peux utiliser <span className="font-semibold">“Confirmer paiement”</span> pour mettre à jour la Finance.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      {err ? <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div> : null}
      {ok ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{ok}</div> : null}

      {/* Month selector + KPI */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-end gap-3">
          <div className="space-y-1">
            <label className="text-[0.7rem] text-slate-700">Mois</label>
            <input
              type="month"
              value={month}
              onChange={(e) => {
                setSelectedReceiptId(null);
                setMonth(e.target.value);
              }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            />
          </div>

          <div className="text-[0.75rem] text-slate-500">
            Vue : <span className="font-semibold text-slate-900">{monthLabel}</span>
          </div>
        </div>

        <button
          type="button"
          disabled={loading}
          onClick={async () => {
            setErr(null);
            setOk(null);
            setLoading(true);
            try {
              await onRefresh();
              setOk("Données rafraîchies ✅");
            } catch (e: any) {
              setErr(e?.message || "Erreur rafraîchissement.");
            } finally {
              setLoading(false);
            }
          }}
          className={cx(
            "rounded-full px-4 py-2 text-sm font-semibold text-white",
            "bg-slate-900 hover:bg-slate-800",
            loading && "opacity-60"
          )}
        >
          {loading ? "…" : "Rafraîchir"}
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Kpi label="Quittances (mois)" value={dashboard.total} sub="générées + envoyées" />
        <Kpi label="À confirmer" value={dashboard.pending} sub="ne bouge pas la Finance" />
        <Kpi label="Confirmées" value={dashboard.sent} sub="Finance + locataire" />
        <Kpi
          label="Retards"
          value={<span className={dashboard.late > 0 ? "text-red-700" : ""}>{dashboard.late}</span>}
          sub="en attente après J+2"
        />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-semibold text-slate-900">Repère rapide</p>
        <p className="mt-1 text-sm text-slate-700">
          Dernière quittance envoyée :{" "}
          <span className="font-semibold">{dashboard.lastSentAt ? dashboard.lastSentAt.toLocaleString("fr-FR") : "—"}</span>
        </p>
        <p className="mt-1 text-xs text-slate-500">
          “Envoyée” = l’info la plus importante : c’est l’état final après confirmation de paiement.
        </p>
      </div>

      {/* Bloc principal : A confirmer + courant */}
      <div className="grid gap-5 lg:grid-cols-[1fr,420px]">
        <Card
          title={
            <span>
              À confirmer <span className="text-slate-500">({pendingThisMonth.length})</span>
            </span>
          }
          right={
            lateThisMonth.length ? (
              <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
                {lateThisMonth.length} en retard
              </span>
            ) : (
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                OK
              </span>
            )
          }
          tone="muted"
        >
          {pendingThisMonth.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white px-3 py-4 text-sm text-slate-700">
              Rien à confirmer pour ce mois 🎉
            </div>
          ) : (
            <div className="space-y-2">
              {pendingThisMonth.map((r: any) => {
                const lease = safeLeases.find((l: any) => l.id === r.lease_id) as any;
                const label = lease ? leaseLabel(lease) : `Bail ${r.lease_id}`;
                const yyyymm = yyyymmFromReceipt(r);
                const due = lease ? dueDateForMonth(yyyymm, Number(lease.payment_day || 1)) : null;
                const isLate = due ? Date.now() > due.getTime() : false;

                const lastSent = r.sent_at ? new Date(r.sent_at).toLocaleString("fr-FR") : "—";

                return (
                  <div
                    key={r.id}
                    className={cx(
                      "rounded-2xl border p-3 bg-white flex flex-col gap-2",
                      isLate ? "border-red-200" : "border-slate-200"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">{label}</p>
                        <p className="text-xs text-slate-600">
                          Période : {fmtDate(r.period_start)} → {fmtDate(r.period_end)}
                        </p>
                        <p className="text-xs text-slate-500">
                          Statut :{" "}
                          <span className={cx("inline-flex items-center rounded-full border px-2 py-0.5 text-[0.7rem] font-semibold", pillTone(r.status))}>
                            {statusLabel(r.status)}
                          </span>
                          <span className="ml-2">• Last sent : <span className="font-semibold">{lastSent}</span></span>
                        </p>
                      </div>

                      <div className="flex flex-col gap-2">
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => confirmPaidFromApp(r)}
                          className={cx(
                            "rounded-full px-4 py-2 text-xs font-semibold text-white",
                            "bg-slate-900 hover:bg-slate-800",
                            loading && "opacity-60"
                          )}
                          title="Confirme le paiement : met à jour Finance + tente l’envoi au locataire."
                        >
                          ✅ Confirmer paiement
                        </button>

                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => openPdf(r)}
                          className={cx(
                            "rounded-full px-4 py-2 text-xs font-semibold",
                            "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50",
                            loading && "opacity-60"
                          )}
                          title="Ouvrir la quittance PDF générée"
                        >
                          👁️ Voir PDF
                        </button>
                      </div>
                    </div>

                    {isLate ? (
                      <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                        En retard : dû le <span className="font-semibold">{due?.toLocaleDateString("fr-FR")}</span> (J+2 après paiement).
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card title="Quittances envoyées (ce mois)" right={<span className="text-sm text-slate-500">{sentThisMonth.length}</span>}>
          {sentThisMonth.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-700">
              Aucune quittance envoyée ce mois-ci.
            </div>
          ) : (
            <div className="space-y-2">
              {sentThisMonth.slice(0, 8).map((r: any) => {
                const lease = safeLeases.find((l: any) => l.id === r.lease_id) as any;
                const label = lease ? leaseLabel(lease) : `Bail ${r.lease_id}`;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setSelectedReceiptId(r.id)}
                    className={cx(
                      "w-full text-left rounded-2xl border px-3 py-2",
                      selectedReceiptId === r.id ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white hover:bg-slate-50"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900 truncate">{label}</p>
                      <span className={cx("rounded-full border px-2 py-0.5 text-[0.7rem] font-semibold", pillTone(r.status))}>
                        {statusLabel(r.status)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">
                      {fmtDate(r.period_start)} → {fmtDate(r.period_end)}
                    </p>
                    <p className="text-xs text-slate-500">
                      Last sent : <span className="font-semibold">{r.sent_at ? new Date(r.sent_at).toLocaleString("fr-FR") : "—"}</span>
                    </p>
                  </button>
                );
              })}
              {sentThisMonth.length > 8 ? (
                <p className="text-xs text-slate-500">+ {sentThisMonth.length - 8} autres (voir archives en bas)</p>
              ) : null}
            </div>
          )}

          {selectedReceipt ? (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 space-y-2">
              <p className="text-sm font-semibold text-slate-900">Actions rapides</p>
              <p className="text-xs text-slate-600">
                Sélection : <span className="font-semibold">{fmtDate((selectedReceipt as any).period_start)}</span> →{" "}
                <span className="font-semibold">{fmtDate((selectedReceipt as any).period_end)}</span>
              </p>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => openPdf(selectedReceipt)}
                  className={cx("rounded-full px-4 py-2 text-xs font-semibold border border-slate-300 bg-white hover:bg-slate-50", loading && "opacity-60")}
                >
                  👁️ Ouvrir PDF
                </button>

                <button
                  type="button"
                  disabled={loading}
                  onClick={() => resendArchivedNoFinance(selectedReceipt)}
                  className={cx("rounded-full px-4 py-2 text-xs font-semibold border border-slate-300 bg-white hover:bg-slate-50", loading && "opacity-60")}
                  title="Renvoyer sans toucher la Finance"
                >
                  🔁 Renvoyer (sans Finance)
                </button>
              </div>

              <p className="text-xs text-slate-500">
                “Renvoyer” ne crée pas de paiement, ne modifie pas la Finance. Ça ne fait que renvoyer le PDF.
              </p>
            </div>
          ) : null}
        </Card>
      </div>

      {/* ARCHIVES EN BAS */}
      <div className="pt-2">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">Archives</p>
            <p className="text-[0.8rem] text-slate-600">Toutes les quittances, regroupées par bien puis année.</p>
          </div>
        </div>

        <div className="mt-3 space-y-3">
          {archives.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-3 py-5 text-sm text-slate-700">
              Aucune archive pour le moment.
            </div>
          ) : (
            archives.map((p) => (
              <details key={p.propertyId} className="rounded-3xl border border-slate-200 bg-white shadow-sm">
                <summary className="cursor-pointer list-none px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-base">🏠</span>
                    <span className="text-sm font-semibold text-slate-900 truncate">{p.label}</span>
                  </div>
                  <span className="text-xs text-slate-500">
                    {Array.from(p.years.values()).reduce((acc, arr) => acc + arr.length, 0)} quittances
                  </span>
                </summary>

                <div className="px-4 pb-4 space-y-3">
                  {Array.from(p.years.entries())
                    .sort((a, b) => b[0].localeCompare(a[0]))
                    .map(([year, arr]) => (
                      <div key={year} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                        <p className="text-sm font-semibold text-slate-900">{year}</p>

                        <div className="mt-2 overflow-auto rounded-2xl border border-slate-200 bg-white">
                          <table className="min-w-[900px] w-full text-sm">
                            <thead className="bg-slate-50 border-b border-slate-200">
                              <tr className="text-left">
                                <th className="px-3 py-2 text-xs text-slate-600">Période</th>
                                <th className="px-3 py-2 text-xs text-slate-600">Locataire</th>
                                <th className="px-3 py-2 text-xs text-slate-600">Statut</th>
                                <th className="px-3 py-2 text-xs text-slate-600">Last sent</th>
                                <th className="px-3 py-2 text-xs text-slate-600 text-right">Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {arr.map((r: any) => {
                                const lease = safeLeases.find((l: any) => l.id === r.lease_id) as any;
                                const t = lease ? tenantsById.get(String(lease.tenant_id)) : null;
                                return (
                                  <tr key={r.id} className="border-b border-slate-100">
                                    <td className="px-3 py-2 text-slate-700">
                                      {fmtDate(r.period_start)} → {fmtDate(r.period_end)}
                                    </td>
                                    <td className="px-3 py-2 text-slate-700">{(t as any)?.full_name || "—"}</td>
                                    <td className="px-3 py-2">
                                      <span className={cx("inline-flex items-center rounded-full border px-2 py-0.5 text-[0.7rem] font-semibold", pillTone(r.status))}>
                                        {statusLabel(r.status)}
                                      </span>
                                    </td>
                                    <td className="px-3 py-2 text-slate-700">
                                      {r.sent_at ? new Date(r.sent_at).toLocaleString("fr-FR") : "—"}
                                    </td>
                                    <td className="px-3 py-2 text-right">
                                      <div className="inline-flex gap-2">
                                        <button
                                          type="button"
                                          onClick={() => openPdf(r)}
                                          disabled={loading}
                                          className={cx(
                                            "rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50",
                                            loading && "opacity-60"
                                          )}
                                        >
                                          👁️ PDF
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => resendArchivedNoFinance(r)}
                                          disabled={loading}
                                          className={cx(
                                            "rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50",
                                            loading && "opacity-60"
                                          )}
                                          title="Renvoyer sans toucher la Finance"
                                        >
                                          🔁 Renvoyer
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        <p className="mt-2 text-xs text-slate-500">
                          Astuce : “Last sent” te dit si ça a déjà été envoyé — c’est l’info la plus utile en pratique.
                        </p>
                      </div>
                    ))}
                </div>
              </details>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
