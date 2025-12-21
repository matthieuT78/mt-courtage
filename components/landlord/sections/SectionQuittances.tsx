// components/landlord/sections/SectionQuittances.tsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { SectionTitle, formatEuro, fmtDate } from "../UiBits";
import type { RentReceipt, Lease, Property, Tenant, LandlordSettings } from "../../../lib/landlord/types";

type PaymentMode = "virement" | "prelevement" | "cheque" | "especes";

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

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

const toISODate = (d: Date) => d.toISOString().slice(0, 10);
const toMonthISO = (d: Date) => d.toISOString().slice(0, 7);

const getMonthPeriodFromYYYYMM = (yyyymm: string) => {
  const [y, m] = yyyymm.split("-").map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0);
  return { start, end };
};

const formatDateFR = (val?: string | null) => {
  if (!val) return "";
  const d = new Date(val + "T00:00:00");
  if (Number.isNaN(d.getTime())) return val;
  return d.toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "2-digit" });
};

const buildPropertyAddress = (p: Property | null) => {
  if (!p) return "";
  const anyP: any = p;
  return [anyP.address_line1, anyP.address_line2, [anyP.postal_code, anyP.city].filter(Boolean).join(" "), anyP.country]
    .filter(Boolean)
    .join("\n");
};

const buildLandlordAddress = (l: LandlordSettings | null) => {
  if (!l) return "";
  const anyL: any = l;
  return [anyL.address_line1 ?? anyL.address, anyL.address_line2, [anyL.postal_code, anyL.city].filter(Boolean).join(" "), anyL.country]
    .filter(Boolean)
    .join("\n");
};

function generateQuittanceText(params: {
  bailleurNom: string;
  bailleurAdresse?: string | null;
  locataireNom: string;
  bienAdresse?: string | null;
  loyerHC: number;
  charges: number;
  periodeDebut: string;
  periodeFin: string;
  villeQuittance?: string | null;
  dateQuittance?: string | null;
  modePaiement: PaymentMode;
  mentionSolde: boolean;
}) {
  const {
    bailleurNom,
    bailleurAdresse,
    locataireNom,
    bienAdresse,
    loyerHC,
    charges,
    periodeDebut,
    periodeFin,
    villeQuittance,
    dateQuittance,
    modePaiement,
    mentionSolde,
  } = params;

  const total = loyerHC + charges;

  const modeLabel =
    modePaiement === "virement"
      ? "par virement bancaire"
      : modePaiement === "cheque"
      ? "par chèque"
      : modePaiement === "especes"
      ? "en espèces"
      : "par prélèvement";

  const lines: string[] = [];

  lines.push(bailleurNom);
  if (bailleurAdresse) lines.push(bailleurAdresse);
  lines.push("");
  lines.push(`À l'attention de : ${locataireNom}`);
  lines.push("");
  lines.push("QUITTANCE DE LOYER");
  lines.push("======================");
  lines.push("");

  lines.push(
    `Je soussigné(e) ${bailleurNom}, propriétaire du logement situé ${bienAdresse || "[Adresse]"}, certifie avoir reçu la somme de ${formatEuro(
      total
    )} (${formatEuro(loyerHC)} de loyer hors charges et ${formatEuro(
      charges
    )} de provisions sur charges) pour la période du ${formatDateFR(periodeDebut)} au ${formatDateFR(
      periodeFin
    )}, ${modeLabel}.`
  );

  lines.push("");

  if (mentionSolde) {
    lines.push("La présente quittance vaut reçu pour solde de toute dette locative pour la période indiquée.");
    lines.push("");
  }

  if (villeQuittance && dateQuittance) {
    lines.push(`${villeQuittance}, le ${formatDateFR(dateQuittance)}`);
    lines.push("");
  }

  lines.push("Signature du bailleur :");
  lines.push("");
  lines.push("______________________________");

  return lines.join("\n");
}

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */

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
  const propsById = propertyById instanceof Map ? propertyById : new Map();
  const tenantsById = tenantById instanceof Map ? tenantById : new Map();

  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null);
  const [selectedLeaseId, setSelectedLeaseId] = useState("");
  const [periodMonth, setPeriodMonth] = useState(toMonthISO(new Date()));
  const [mentionSolde, setMentionSolde] = useState(true);

  const [editableText, setEditableText] = useState("");

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const selectedReceipt = useMemo(
    () => safeReceipts.find((r) => r.id === selectedReceiptId) || null,
    [safeReceipts, selectedReceiptId]
  );

  const selectedLease = useMemo(
    () => safeLeases.find((l) => l.id === selectedLeaseId) || null,
    [safeLeases, selectedLeaseId]
  );

  const leaseLabel = (l: Lease) => {
    const p = propsById.get(l.property_id);
    const t = tenantsById.get((l as any).tenant_id);
    return `${p?.label || "Bien"} — ${t?.full_name || "Locataire"}`;
  };

  // quittance du mois (si déjà existante)
  const existingReceiptForPeriod = useMemo(() => {
    if (!selectedLeaseId) return null;
    const { start, end } = getMonthPeriodFromYYYYMM(periodMonth);
    const ps = toISODate(start);
    const pe = toISODate(end);
    return safeReceipts.find((r) => r.lease_id === selectedLeaseId && r.period_start === ps && r.period_end === pe) || null;
  }, [safeReceipts, selectedLeaseId, periodMonth]);

  const previewText = useMemo(() => {
    if (!selectedLease) return "";

    const p = propsById.get(selectedLease.property_id) || null;
    const t = tenantsById.get((selectedLease as any).tenant_id) || null;

    const { start, end } = getMonthPeriodFromYYYYMM(periodMonth);

    return generateQuittanceText({
      bailleurNom: (landlord as any)?.display_name || userEmail || "Bailleur",
      bailleurAdresse: buildLandlordAddress(landlord ?? null),
      locataireNom: t?.full_name || "Locataire",
      bienAdresse: buildPropertyAddress(p),
      loyerHC: Number((selectedLease as any).rent_amount || 0),
      charges: Number((selectedLease as any).charges_amount || 0),
      periodeDebut: toISODate(start),
      periodeFin: toISODate(end),
      villeQuittance: (landlord as any)?.default_issue_place || (p as any)?.city || "",
      dateQuittance: toISODate(new Date()),
      modePaiement: ((selectedLease as any).payment_method as PaymentMode) || "virement",
      mentionSolde,
    });
  }, [selectedLease, periodMonth, mentionSolde, landlord, userEmail, propsById, tenantsById]);

  // Sync editable text
  useEffect(() => {
    if (selectedReceipt?.content_text) setEditableText(selectedReceipt.content_text);
    else if (existingReceiptForPeriod?.content_text) setEditableText(existingReceiptForPeriod.content_text);
    else setEditableText(previewText);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedReceiptId, previewText, existingReceiptForPeriod?.id]);

  const periodLabel = useMemo(() => {
    const { start, end } = getMonthPeriodFromYYYYMM(periodMonth);
    return `${fmtDate(toISODate(start))} → ${fmtDate(toISODate(end))}`;
  }, [periodMonth]);

  const currentReceipt = selectedReceipt || existingReceiptForPeriod;

  const sentInfo = useMemo(() => {
    const r: any = currentReceipt;
    if (!r) return null;
    return {
      sent_at: r.sent_at || null,
      sent_to: r.sent_to_tenant_email || null,
      status: r.status || null,
      pdf: r.pdf_url || null,
      error: r.send_error || null,
      archived_at: r.archived_at || null,
    };
  }, [currentReceipt]);

  /* ------------------------------------------------------------------ */
  /* Actions                                                            */
  /* ------------------------------------------------------------------ */

  const saveEdits = async () => {
    if (!currentReceipt || !supabase) return;

    setSaving(true);
    setErr(null);
    setOk(null);

    try {
      const { error } = await supabase
        .from("rent_receipts")
        .update({ content_text: editableText, edited_at: new Date().toISOString() })
        .eq("id", currentReceipt.id);

      if (error) throw error;

      setOk("Quittance mise à jour ✏️");
      await onRefresh();
    } catch (e: any) {
      setErr(e.message || "Erreur lors de l’enregistrement.");
    } finally {
      setSaving(false);
    }
  };

  const deleteReceipt = async () => {
    if (!currentReceipt || !supabase) return;
    if (!confirm("Supprimer définitivement cette quittance ?")) return;

    setSaving(true);
    setErr(null);
    setOk(null);

    try {
      const { error } = await supabase.from("rent_receipts").delete().eq("id", currentReceipt.id);
      if (error) throw error;

      setSelectedReceiptId(null);
      setOk("Quittance supprimée 🗑️");
      await onRefresh();
    } catch (e: any) {
      setErr(e.message || "Erreur lors de la suppression.");
    } finally {
      setSaving(false);
    }
  };

  // (A) Générer + envoyer + (option) impacter finance
  const sendOrGenerate = async (opts: { affectFinance: boolean; forceReceiptId?: string | null }) => {
    if (!selectedLease && !opts.forceReceiptId) return;

    setSaving(true);
    setErr(null);
    setOk(null);

    try {
      const { start, end } = getMonthPeriodFromYYYYMM(periodMonth);

      const body: any = {
        userId,
        affectFinance: opts.affectFinance,
        contentText: editableText || previewText,
      };

      // si on force un receiptId (renvoi)
      if (opts.forceReceiptId) {
        body.receiptId = opts.forceReceiptId;
      } else {
        body.leaseId = selectedLease!.id;
        body.periodStart = toISODate(start);
        body.periodEnd = toISODate(end);
        // si quittance existante du mois → on la réutilise
        if (existingReceiptForPeriod?.id) body.receiptId = existingReceiptForPeriod.id;
        if (selectedReceipt?.id) body.receiptId = selectedReceipt.id;
      }

      const r = await fetch("/api/receipts/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const raw = await r.text();
      let json: any = null;
      try {
        json = raw ? JSON.parse(raw) : null;
      } catch {
        // raw non-json
      }

      if (!r.ok) {
        // l’API peut renvoyer une erreur “Email non configuré…”
        throw new Error(json?.error || raw || `Erreur ${r.status}`);
      }

      const financeMsg = opts.affectFinance ? "Finance mise à jour ✅" : "Sans impact Finance ✅";
      setOk(`Quittance traitée ✅ (${financeMsg})`);

      await onRefresh();

      if (json?.receipt_id) setSelectedReceiptId(json.receipt_id);

      if (json?.signedUrl) {
        window.open(json.signedUrl, "_blank", "noopener,noreferrer");
      }
    } catch (e: any) {
      setErr(e?.message || "Erreur lors de l’action.");
    } finally {
      setSaving(false);
    }
  };

  // (1) Générer & envoyer (impact finance)
  const generateAndSend = async () => sendOrGenerate({ affectFinance: true });

  // (2) Renvoyer archivée (sans finance)
  const resendArchivedNoFinance = async () => {
    if (!currentReceipt?.id) {
      setErr("Sélectionne une quittance existante (historique) ou choisis un bail + mois déjà généré.");
      return;
    }
    await sendOrGenerate({ affectFinance: false, forceReceiptId: currentReceipt.id });
  };

  // (3) Générer manuellement (c’est le même que (1), mais on le garde explicite UX)
  const generateManual = async () => sendOrGenerate({ affectFinance: true });

  /* ------------------------------------------------------------------ */
  /* UI                                                                 */
  /* ------------------------------------------------------------------ */

  const filteredHistory = useMemo(() => {
    // petit filtre UX: si un bail est sélectionné, on montre d’abord ses quittances
    if (!selectedLeaseId) return safeReceipts;
    const a = safeReceipts.filter((r) => r.lease_id === selectedLeaseId);
    const b = safeReceipts.filter((r) => r.lease_id !== selectedLeaseId);
    return [...a, ...b];
  }, [safeReceipts, selectedLeaseId]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-5">
      <SectionTitle
        kicker="Quittances"
        title="Génération, envoi et renvoi"
        desc="Génère (PDF), envoie au locataire, et peux renvoyer une quittance archivée sans toucher la Finance."
      />

      {err && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}
      {ok && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{ok}</div>}

      <div className="grid gap-5 lg:grid-cols-[340px,1fr]">
        {/* LEFT: Historique */}
        <aside className="space-y-2">
          {filteredHistory.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-700">
              Aucune quittance enregistrée pour le moment.
            </div>
          ) : (
            filteredHistory.map((r) => {
              const lease = safeLeases.find((l) => l.id === r.lease_id) as any;
              return (
                <button
                  key={r.id}
                  onClick={() => {
                    setSelectedReceiptId(r.id);
                    setSelectedLeaseId(r.lease_id);
                    setPeriodMonth(String(r.period_start || "").slice(0, 7) || toMonthISO(new Date()));
                  }}
                  className={
                    "w-full text-left rounded-lg border px-3 py-2 text-xs " +
                    (r.id === selectedReceiptId
                      ? "border-amber-400 bg-amber-50"
                      : "border-slate-200 bg-slate-50 hover:bg-slate-100")
                  }
                  type="button"
                >
                  <p className="font-semibold">{lease ? leaseLabel(lease) : `Bail ${r.lease_id}`}</p>
                  <p className="text-slate-500">
                    {fmtDate(r.period_start)} → {fmtDate(r.period_end)}
                  </p>
                  <p className="mt-1 text-[0.7rem] text-slate-600">
                    Statut: <span className="font-semibold">{(r as any).status || "—"}</span>
                    {(r as any).sent_at ? (
                      <span className="text-slate-500"> • envoyée</span>
                    ) : (
                      <span className="text-slate-500"> • non envoyée</span>
                    )}
                  </p>
                </button>
              );
            })
          )}
        </aside>

        {/* RIGHT: Edition + actions */}
        <section className="space-y-4">
          <div className="grid gap-2 md:grid-cols-2">
            <select
              value={selectedLeaseId}
              onChange={(e) => {
                setSelectedReceiptId(null);
                setSelectedLeaseId(e.target.value);
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">— Sélectionner un bail —</option>
              {safeLeases.map((l) => (
                <option key={l.id} value={l.id}>
                  {leaseLabel(l)}
                </option>
              ))}
            </select>

            <input
              type="month"
              value={periodMonth}
              onChange={(e) => {
                setSelectedReceiptId(null);
                setPeriodMonth(e.target.value);
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={mentionSolde}
              onChange={(e) => setMentionSolde(e.target.checked)}
              className="h-4 w-4"
            />
            Mention “reçu pour solde”
          </label>

          {/* Info */}
          {sentInfo ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700 space-y-1">
              <p>
                Statut : <span className="font-semibold">{sentInfo.status || "—"}</span>
              </p>
              <p>
                Période : <span className="font-semibold">{periodLabel}</span>
              </p>
              {sentInfo.sent_at ? (
                <p>
                  Envoyée le :{" "}
                  <span className="font-semibold">{new Date(sentInfo.sent_at).toLocaleString("fr-FR")}</span>
                  {sentInfo.sent_to ? <span className="text-slate-500"> • {sentInfo.sent_to}</span> : null}
                </p>
              ) : (
                <p className="text-slate-600">Non envoyée</p>
              )}
              {sentInfo.error ? (
                <p className="text-red-700">
                  Erreur d’envoi : <span className="font-semibold">{sentInfo.error}</span>
                </p>
              ) : null}
            </div>
          ) : null}

          <textarea
            value={editableText}
            onChange={(e) => setEditableText(e.target.value)}
            rows={18}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono"
          />

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={generateAndSend}
              disabled={saving || !selectedLeaseId}
              className={cx(
                "rounded-full px-5 py-2 text-xs font-semibold text-white",
                "bg-slate-900 hover:bg-slate-800",
                (saving || !selectedLeaseId) && "opacity-50"
              )}
              title="Crée/MAJ la quittance, génère le PDF, envoie au locataire, et met à jour la Finance."
            >
              ✅ Générer & envoyer (impact Finance)
            </button>

            <button
              type="button"
              onClick={resendArchivedNoFinance}
              disabled={saving || !currentReceipt?.id}
              className={cx(
                "rounded-full px-5 py-2 text-xs font-semibold",
                "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50",
                (saving || !currentReceipt?.id) && "opacity-50"
              )}
              title="Renvoyer une quittance déjà archivée sans créer/mettre à jour de paiement."
            >
              🔁 Renvoyer l’archivée (sans Finance)
            </button>

            <button
              type="button"
              onClick={generateManual}
              disabled={saving || !selectedLeaseId}
              className={cx(
                "rounded-full px-5 py-2 text-xs font-semibold",
                "border border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100",
                (saving || !selectedLeaseId) && "opacity-50"
              )}
              title="Même logique que l’envoi, mais bouton dédié “manuel”."
            >
              🧾 Générer manuellement
            </button>

            {currentReceipt ? (
              <>
                <button
                  type="button"
                  onClick={saveEdits}
                  disabled={saving}
                  className={cx(
                    "rounded-full px-5 py-2 text-xs font-semibold",
                    "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50",
                    saving && "opacity-50"
                  )}
                >
                  💾 Enregistrer le texte
                </button>

                <button
                  type="button"
                  onClick={deleteReceipt}
                  disabled={saving}
                  className={cx(
                    "rounded-full px-5 py-2 text-xs font-semibold",
                    "border border-red-200 bg-white text-red-700 hover:bg-red-50",
                    saving && "opacity-50"
                  )}
                >
                  🗑️ Supprimer
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedReceiptId(null)}
                  className="rounded-full border border-slate-300 bg-white px-5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                >
                  ↩️ Revenir au modèle
                </button>
              </>
            ) : null}
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-600 space-y-1">
            <p>
              • Si l’email n’est pas configuré (Resend), l’API renverra une erreur explicite.
            </p>
            <p>
              • “Sans Finance” n’écrit pas dans <span className="font-semibold">rent_payments</span> → ça ne bouge pas tes stats Finance.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
