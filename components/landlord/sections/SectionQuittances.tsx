// components/landlord/sections/SectionQuittances.tsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { SectionTitle, formatEuro, fmtDate } from "../UiBits";
import type {
  RentReceipt,
  Lease,
  Property,
  Tenant,
  LandlordSettings,
} from "../../../lib/landlord/types";

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
  return d.toLocaleDateString("fr-FR", {
    year: "numeric",
    month: "long",
    day: "2-digit",
  });
};

const buildPropertyAddress = (p: Property | null) => {
  if (!p) return "";
  const anyP: any = p;
  return [
    anyP.address_line1,
    anyP.address_line2,
    [anyP.postal_code, anyP.city].filter(Boolean).join(" "),
    anyP.country,
  ]
    .filter(Boolean)
    .join("\n");
};

const buildLandlordAddress = (l: LandlordSettings | null) => {
  if (!l) return "";
  const anyL: any = l;
  return [
    anyL.address_line1 ?? anyL.address,
    anyL.address_line2,
    [anyL.postal_code, anyL.city].filter(Boolean).join(" "),
    anyL.country,
  ]
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
    `Je soussigné(e) ${bailleurNom}, propriétaire du logement situé ${
      bienAdresse || "[Adresse]"
    }, certifie avoir reçu la somme de ${formatEuro(total)} (${formatEuro(
      loyerHC
    )} de loyer hors charges et ${formatEuro(
      charges
    )} de provisions sur charges) pour la période du ${formatDateFR(
      periodeDebut
    )} au ${formatDateFR(periodeFin)}, ${modeLabel}.`
  );

  lines.push("");

  if (mentionSolde) {
    lines.push(
      "La présente quittance vaut reçu pour solde de toute dette locative pour la période indiquée."
    );
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
    const t = tenantsById.get(l.tenant_id);
    return `${p?.label || "Bien"} — ${t?.full_name || "Locataire"}`;
  };

  // receipt du mois si déjà existant
  const existingReceiptForPeriod = useMemo(() => {
    if (!selectedLeaseId) return null;
    const { start, end } = getMonthPeriodFromYYYYMM(periodMonth);
    return (
      safeReceipts.find(
        (r) =>
          r.lease_id === selectedLeaseId &&
          r.period_start === toISODate(start) &&
          r.period_end === toISODate(end)
      ) || null
    );
  }, [safeReceipts, selectedLeaseId, periodMonth]);

  const previewText = useMemo(() => {
    if (!selectedLease) return "";

    const p = propsById.get(selectedLease.property_id) || null;
    const t = tenantsById.get(selectedLease.tenant_id) || null;

    const { start, end } = getMonthPeriodFromYYYYMM(periodMonth);

    return generateQuittanceText({
      bailleurNom: (landlord as any)?.display_name || userEmail || "Bailleur",
      bailleurAdresse: buildLandlordAddress(landlord ?? null),
      locataireNom: t?.full_name || "Locataire",
      bienAdresse: buildPropertyAddress(p),
      loyerHC: Number(selectedLease.rent_amount || 0),
      charges: Number(selectedLease.charges_amount || 0),
      periodeDebut: toISODate(start),
      periodeFin: toISODate(end),
      villeQuittance: (landlord as any)?.default_issue_place || p?.city || "",
      dateQuittance: toISODate(new Date()),
      modePaiement: (selectedLease.payment_method as PaymentMode) || "virement",
      mentionSolde,
    });
  }, [selectedLease, periodMonth, mentionSolde, landlord, userEmail, propsById, tenantsById]);

  /* Sync editable text */
  useEffect(() => {
    if (selectedReceipt?.content_text) {
      setEditableText(selectedReceipt.content_text);
    } else if (existingReceiptForPeriod?.content_text) {
      setEditableText(existingReceiptForPeriod.content_text);
    } else {
      setEditableText(previewText);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedReceiptId, previewText, existingReceiptForPeriod?.id]);

  /* ------------------------------------------------------------------ */
  /* Actions                                                            */
  /* ------------------------------------------------------------------ */

  const saveEdits = async () => {
    if (!selectedReceipt || !supabase) return;

    setSaving(true);
    setErr(null);
    setOk(null);

    try {
      const { error } = await supabase
        .from("rent_receipts")
        .update({ content_text: editableText })
        .eq("id", selectedReceipt.id);

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
    if (!selectedReceipt || !supabase) return;
    if (!confirm("Supprimer définitivement cette quittance ?")) return;

    setSaving(true);
    setErr(null);
    setOk(null);

    try {
      const { error } = await supabase
        .from("rent_receipts")
        .delete()
        .eq("id", selectedReceipt.id);

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

  // ✅ 1 bouton : crée si besoin + PDF + email + mark paid + ouvre PDF
  const sendReceipt = async () => {
    if (!selectedLease) return;

    setSaving(true);
    setErr(null);
    setOk(null);

    try {
      const t = tenantsById.get(selectedLease.tenant_id) as any;
      if (!t?.email) {
        throw new Error("Le locataire n’a pas d’email. Ajoute un email au locataire avant l’envoi.");
      }

      const { start, end } = getMonthPeriodFromYYYYMM(periodMonth);

      const body = {
        userId,
        // si on a déjà une quittance sélectionnée, on force l’envoi de celle-ci
        receiptId: selectedReceipt?.id || existingReceiptForPeriod?.id || null,
        // sinon on fournit les infos pour créer la quittance
        leaseId: selectedLease.id,
        periodStart: toISODate(start),
        periodEnd: toISODate(end),
        contentText: editableText || previewText,
      };

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

      if (!r.ok) throw new Error(json?.error || raw || `Erreur ${r.status}`);

      setOk("Quittance envoyée ✅ (et loyer marqué encaissé)");
      await onRefresh();

      // sélectionner la quittance concernée
      if (json?.receipt_id) setSelectedReceiptId(json.receipt_id);

      // ouvrir le PDF si signedUrl dispo
      if (json?.signedUrl) {
        window.open(json.signedUrl, "_blank", "noopener,noreferrer");
      }
    } catch (e: any) {
      setErr(e?.message || "Erreur lors de l’envoi.");
    } finally {
      setSaving(false);
    }
  };

  /* ------------------------------------------------------------------ */
  /* UI                                                                 */
  /* ------------------------------------------------------------------ */

  const periodLabel = useMemo(() => {
    const { start, end } = getMonthPeriodFromYYYYMM(periodMonth);
    return `${fmtDate(toISODate(start))} → ${fmtDate(toISODate(end))}`;
  }, [periodMonth]);

  const sentInfo = useMemo(() => {
    const r = selectedReceipt || existingReceiptForPeriod;
    if (!r) return null;
    const anyR: any = r;
    return {
      sent_at: anyR.sent_at || null,
      sent_to: anyR.sent_to_tenant_email || null,
      status: anyR.status || null,
      pdf: anyR.pdf_url || null,
    };
  }, [selectedReceipt, existingReceiptForPeriod]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-5">
      <SectionTitle
        kicker="Quittances"
        title="1 clic : envoyer + marquer encaissé"
        desc="Le bouton envoie la quittance (PDF) au locataire et marque le loyer comme perçu."
      />

      {err && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {err}
        </div>
      )}
      {ok && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {ok}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[320px,1fr]">
        {/* LEFT: Historique */}
        <aside className="space-y-2">
          {safeReceipts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-700">
              Aucune quittance enregistrée pour le moment.
            </div>
          ) : (
            safeReceipts.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelectedReceiptId(r.id)}
                className={
                  "w-full text-left rounded-lg border px-3 py-2 text-xs " +
                  (r.id === selectedReceiptId
                    ? "border-amber-400 bg-amber-50"
                    : "border-slate-200 bg-slate-50 hover:bg-slate-100")
                }
                type="button"
              >
                <p className="font-semibold">
                  {leaseLabel(safeLeases.find((l) => l.id === r.lease_id)!)}
                </p>
                <p className="text-slate-500">
                  {fmtDate(r.period_start)} → {fmtDate(r.period_end)}
                </p>
              </button>
            ))
          )}
        </aside>

        {/* RIGHT: Edition + envoi */}
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

          {sentInfo ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
              <p>
                Statut : <span className="font-semibold">{sentInfo.status || "—"}</span>
              </p>
              <p>
                Période : <span className="font-semibold">{periodLabel}</span>
              </p>
              {sentInfo.sent_at ? (
                <p>
                  Envoyée le : <span className="font-semibold">{new Date(sentInfo.sent_at).toLocaleString("fr-FR")}</span>
                  {sentInfo.sent_to ? <span className="text-slate-500"> • {sentInfo.sent_to}</span> : null}
                </p>
              ) : (
                <p className="text-slate-600">Non envoyée</p>
              )}
            </div>
          ) : null}

          <textarea
            value={editableText}
            onChange={(e) => setEditableText(e.target.value)}
            rows={18}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono"
          />

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={sendReceipt}
              disabled={saving || !selectedLeaseId}
              className="rounded-full bg-slate-900 px-5 py-2 text-xs font-semibold text-white disabled:opacity-50 hover:bg-slate-800"
              title="Génère le PDF, envoie au locataire et marque le loyer encaissé"
            >
              ✉️ Envoyer la quittance (PDF + encaissé)
            </button>

            {selectedReceipt ? (
              <>
                <button
                  type="button"
                  onClick={saveEdits}
                  disabled={saving}
                  className="rounded-full border border-slate-300 bg-white px-5 py-2 text-xs font-semibold text-slate-800 disabled:opacity-50 hover:bg-slate-50"
                >
                  💾 Enregistrer le texte
                </button>

                <button
                  type="button"
                  onClick={deleteReceipt}
                  disabled={saving}
                  className="rounded-full border border-red-200 bg-white px-5 py-2 text-xs font-semibold text-red-700 disabled:opacity-50 hover:bg-red-50"
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

          <p className="text-xs text-slate-500">
            Note : l’envoi email réel nécessite <span className="font-semibold">RESEND_API_KEY</span> +{" "}
            <span className="font-semibold">RESEND_FROM</span> côté serveur. Sans ça, l’API renverra une erreur claire.
          </p>
        </section>
      </div>
    </div>
  );
}
