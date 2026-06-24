import React, { useState } from "react";
import {
  ArrowDownTrayIcon,
  ArrowTopRightOnSquareIcon,
  ChevronLeftIcon,
  DocumentTextIcon,
  PlusIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { supabase } from "../../../lib/supabaseClient";
import { SectionTitle } from "../UiBits";
import type { CongeKind } from "../../../pages/api/lease-contracts/generate-conge";

type Props = { userId: string };

type Template = {
  id: string;
  title: string;
  subtitle: string;
  category: "courrier" | "bail" | "gestion";
  status: "available" | "soon";
  seoPath?: string;
};

const TEMPLATES: Template[] = [
  {
    id: "conge-bailleur",
    title: "Lettre de congé bailleur",
    subtitle: "Reprise, vente ou motif légitime — conforme à l'art. 15 loi 89-462",
    category: "courrier",
    status: "available",
    seoPath: "/modele-lettre-conge-bailleur",
  },
  {
    id: "mise-en-demeure",
    title: "Mise en demeure loyer impayé",
    subtitle: "Courrier formel avant procédure — art. 24 loi 89-462",
    category: "courrier",
    status: "available",
  },
  {
    id: "revision-loyer",
    title: "Notification de révision du loyer",
    subtitle: "Calcul IRL et notification au locataire",
    category: "courrier",
    status: "soon",
  },
  {
    id: "restitution-depot",
    title: "Restitution du dépôt de garantie",
    subtitle: "Courrier de restitution avec ou sans retenues",
    category: "gestion",
    status: "soon",
  },
];

const CATEGORY_LABEL: Record<Template["category"], string> = {
  courrier: "Courrier",
  bail: "Bail",
  gestion: "Gestion",
};

// ── Formulaire congé bailleur ────────────────────────────────
function CongeForm({ userId, onBack }: { userId: string; onBack: () => void }) {
  const [kind, setKind] = useState<CongeKind>("reprise");
  const [form, setForm] = useState({
    landlordName: "",
    landlordAddress: "",
    tenantName: "",
    propertyAddress: "",
    leaseStartDate: "",
    leaseEndDate: "",
    bailType: "empty_primary",
    signaturePlace: "",
    signatureDate: new Date().toISOString().slice(0, 10),
    beneficiaryName: "",
    beneficiaryRelationship: "",
    beneficiaryCurrentAddress: "",
    salePrice: "",
    saleConditions: "",
    motifDescription: "",
  });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const inp =
    "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-[#635bff] focus:outline-none focus:ring-1 focus:ring-[#635bff]/30";
  const lbl = "block space-y-1 text-xs font-semibold text-slate-700";

  const generate = async () => {
    setErr(null);
    setLoading(true);
    try {
      const { data: session } = await supabase!.auth.getSession();
      const token = session.session?.access_token;
      const res = await fetch("/api/lease-contracts/generate-conge", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          leaseId: "standalone",
          kind,
          landlordName: form.landlordName,
          landlordAddress: form.landlordAddress,
          tenantName: form.tenantName,
          propertyAddress: form.propertyAddress,
          leaseStartDate: form.leaseStartDate,
          leaseEndDate: form.leaseEndDate,
          bailType: form.bailType,
          signaturePlace: form.signaturePlace,
          signatureDate: form.signatureDate,
          beneficiaryName: form.beneficiaryName,
          beneficiaryRelationship: form.beneficiaryRelationship,
          beneficiaryCurrentAddress: form.beneficiaryCurrentAddress,
          salePrice: form.salePrice ? Number(form.salePrice) : undefined,
          saleConditions: form.saleConditions,
          motifDescription: form.motifDescription,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Génération impossible.");
      if (json.signedUrl) window.open(json.signedUrl, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      setErr(e?.message || "Erreur.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Back */}
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900"
      >
        <ChevronLeftIcon className="h-4 w-4" />
        Retour aux modèles
      </button>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-[0.7rem] font-semibold uppercase tracking-widest text-[#635bff]">Courrier</p>
        <h2 className="mt-1 text-xl font-semibold text-slate-950">Lettre de congé bailleur</h2>
        <p className="mt-1 text-sm text-slate-500">
          Remplissez les champs ci-dessous. Le PDF est généré et s'ouvre dans un nouvel onglet, prêt à imprimer et à envoyer en recommandé AR.
        </p>
      </div>

      {err && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
        {/* Motif */}
        <div>
          <p className="mb-2 text-xs font-semibold text-slate-700">Motif du congé</p>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ["reprise", "Reprise pour habiter"],
                ["vente", "Vente du logement"],
                ["motif", "Motif légitime"],
              ] as [CongeKind, string][]
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={`rounded-xl border px-3 py-2.5 text-xs font-semibold transition ${
                  kind === k
                    ? "border-[#635bff] bg-[#635bff]/10 text-[#635bff]"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Bailleur */}
        <div>
          <p className="mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Bailleur</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={lbl}>
              Nom complet
              <input className={inp} value={form.landlordName} onChange={(e) => set("landlordName", e.target.value)} placeholder="Prénom Nom" />
            </label>
            <label className={lbl}>
              Adresse
              <input className={inp} value={form.landlordAddress} onChange={(e) => set("landlordAddress", e.target.value)} placeholder="12 rue des Lilas, 75010 Paris" />
            </label>
          </div>
        </div>

        {/* Locataire + logement */}
        <div>
          <p className="mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Locataire & logement</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={lbl}>
              Nom du locataire
              <input className={inp} value={form.tenantName} onChange={(e) => set("tenantName", e.target.value)} placeholder="Prénom Nom" />
            </label>
            <label className={lbl}>
              Adresse du logement
              <input className={inp} value={form.propertyAddress} onChange={(e) => set("propertyAddress", e.target.value)} placeholder="5 av. Victor Hugo, 69001 Lyon" />
            </label>
            <label className={lbl}>
              Type de bail
              <select className={inp} value={form.bailType} onChange={(e) => set("bailType", e.target.value)}>
                <option value="empty_primary">Location vide (résidence principale)</option>
                <option value="furnished_primary">Location meublée (résidence principale)</option>
                <option value="furnished_student">Bail étudiant 9 mois</option>
                <option value="mobility">Bail mobilité</option>
              </select>
            </label>
            <label className={lbl}>
              Date de début du bail
              <input type="date" className={inp} value={form.leaseStartDate} onChange={(e) => set("leaseStartDate", e.target.value)} />
            </label>
            <label className={`${lbl} sm:col-span-2`}>
              Date de fin du bail (échéance)
              <input type="date" className={inp} value={form.leaseEndDate} onChange={(e) => set("leaseEndDate", e.target.value)} />
            </label>
          </div>
        </div>

        {/* Champs selon motif */}
        {kind === "reprise" && (
          <div>
            <p className="mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Bénéficiaire de la reprise</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={lbl}>
                Nom du bénéficiaire
                <input className={inp} value={form.beneficiaryName} onChange={(e) => set("beneficiaryName", e.target.value)} placeholder="Prénom Nom" />
              </label>
              <label className={lbl}>
                Lien avec le bailleur
                <input className={inp} value={form.beneficiaryRelationship} onChange={(e) => set("beneficiaryRelationship", e.target.value)} placeholder="ex : moi-même / mon fils / ma mère" />
              </label>
              <label className={`${lbl} sm:col-span-2`}>
                Adresse actuelle du bénéficiaire
                <input className={inp} value={form.beneficiaryCurrentAddress} onChange={(e) => set("beneficiaryCurrentAddress", e.target.value)} />
              </label>
            </div>
          </div>
        )}

        {kind === "vente" && (
          <div>
            <p className="mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Vente</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={lbl}>
                Prix de vente (€)
                <input type="number" className={inp} value={form.salePrice} onChange={(e) => set("salePrice", e.target.value)} placeholder="250000" />
              </label>
              <label className={lbl}>
                Conditions de vente
                <input className={inp} value={form.saleConditions} onChange={(e) => set("saleConditions", e.target.value)} placeholder="ex : comptant, financement possible" />
              </label>
            </div>
          </div>
        )}

        {kind === "motif" && (
          <div>
            <p className="mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Motif légitime et sérieux</p>
            <label className={lbl}>
              Description précise du motif
              <textarea
                className={`${inp} h-24 resize-none`}
                value={form.motifDescription}
                onChange={(e) => set("motifDescription", e.target.value)}
                placeholder="Loyers impayés depuis le… / Troubles constatés par jugement du tribunal de… le…"
              />
            </label>
          </div>
        )}

        {/* Signature */}
        <div>
          <p className="mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Signature</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={lbl}>
              Lieu
              <input className={inp} value={form.signaturePlace} onChange={(e) => set("signaturePlace", e.target.value)} placeholder="Paris" />
            </label>
            <label className={lbl}>
              Date
              <input type="date" className={inp} value={form.signatureDate} onChange={(e) => set("signatureDate", e.target.value)} />
            </label>
          </div>
        </div>

        {/* Rappel légal */}
        <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-800">
          <strong>Délai de préavis :</strong>{" "}
          {form.bailType === "empty_primary" ? "6 mois" : "3 mois"} avant la date de fin de bail.
          La date de réception par le locataire fait foi — pas la date d'envoi.
          Envoyez en <strong>lettre recommandée avec AR</strong>.
        </div>

        <button
          type="button"
          disabled={loading}
          onClick={generate}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
        >
          <ArrowDownTrayIcon className="h-4 w-4" />
          {loading ? "Génération en cours…" : "Générer le PDF"}
        </button>
      </div>
    </div>
  );
}

// ── Formulaire mise en demeure loyer impayé ─────────────────
type UnpaidRow = { id: number; period: string; amount: string };

function MiseEnDemeureForm({ userId, onBack }: { userId: string; onBack: () => void }) {
  const defaultDeadline = new Date();
  defaultDeadline.setDate(defaultDeadline.getDate() + 8);

  const [form, setForm] = useState({
    landlordName: "",
    landlordAddress: "",
    tenantName: "",
    propertyAddress: "",
    deadlineDate: defaultDeadline.toISOString().slice(0, 10),
    signaturePlace: "",
    signatureDate: new Date().toISOString().slice(0, 10),
  });
  const [rows, setRows] = useState<UnpaidRow[]>([{ id: 1, period: "", amount: "" }]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const totalAmount = rows.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
  const addRow = () => setRows((rs) => [...rs, { id: Date.now(), period: "", amount: "" }]);
  const removeRow = (id: number) => setRows((rs) => rs.filter((r) => r.id !== id));
  const setRow = (id: number, k: keyof UnpaidRow, v: string) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [k]: v } : r)));

  const inp =
    "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-[#635bff] focus:outline-none focus:ring-1 focus:ring-[#635bff]/30";
  const lbl = "block space-y-1 text-xs font-semibold text-slate-700";

  const generate = async () => {
    setErr(null);
    setLoading(true);
    try {
      const { data: session } = await supabase!.auth.getSession();
      const token = session.session?.access_token;
      const res = await fetch("/api/lease-contracts/generate-mise-en-demeure", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          landlordName: form.landlordName,
          landlordAddress: form.landlordAddress,
          tenantName: form.tenantName,
          propertyAddress: form.propertyAddress,
          unpaidRows: rows
            .filter((r) => r.period || r.amount)
            .map((r) => ({ period: r.period, amount: parseFloat(r.amount) || 0 })),
          totalAmount,
          deadlineDate: form.deadlineDate,
          signaturePlace: form.signaturePlace,
          signatureDate: form.signatureDate,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Génération impossible.");
      if (json.signedUrl) window.open(json.signedUrl, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      setErr(e?.message || "Erreur.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900"
      >
        <ChevronLeftIcon className="h-4 w-4" />
        Retour aux modèles
      </button>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-[0.7rem] font-semibold uppercase tracking-widest text-[#635bff]">Courrier</p>
        <h2 className="mt-1 text-xl font-semibold text-slate-950">Mise en demeure loyer impayé</h2>
        <p className="mt-1 text-sm text-slate-500">
          Courrier formel à envoyer en recommandé AR avant toute procédure judiciaire. Remplissez les champs — le PDF s'ouvre dans un nouvel onglet.
        </p>
      </div>

      {err && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</div>}

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
        {/* Bailleur */}
        <div>
          <p className="mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Bailleur</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={lbl}>
              Nom complet
              <input className={inp} value={form.landlordName} onChange={(e) => set("landlordName", e.target.value)} placeholder="Prénom Nom" />
            </label>
            <label className={lbl}>
              Adresse
              <input className={inp} value={form.landlordAddress} onChange={(e) => set("landlordAddress", e.target.value)} placeholder="12 rue des Lilas, 75010 Paris" />
            </label>
          </div>
        </div>

        {/* Locataire */}
        <div>
          <p className="mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Locataire & logement</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={lbl}>
              Nom du locataire
              <input className={inp} value={form.tenantName} onChange={(e) => set("tenantName", e.target.value)} placeholder="Prénom Nom" />
            </label>
            <label className={lbl}>
              Adresse du logement
              <input className={inp} value={form.propertyAddress} onChange={(e) => set("propertyAddress", e.target.value)} placeholder="5 av. Victor Hugo, 69001 Lyon" />
            </label>
          </div>
        </div>

        {/* Loyers impayés */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Loyers impayés</p>
            <button
              type="button"
              onClick={addRow}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              <PlusIcon className="h-3.5 w-3.5" />
              Ajouter un mois
            </button>
          </div>
          <div className="space-y-2">
            {rows.map((row, idx) => (
              <div key={row.id} className="flex items-center gap-2">
                <input
                  className={`${inp} flex-1`}
                  value={row.period}
                  onChange={(e) => setRow(row.id, "period", e.target.value)}
                  placeholder={idx === 0 ? "ex : Mai 2026" : "ex : Juin 2026"}
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className={`${inp} w-32 shrink-0`}
                  value={row.amount}
                  onChange={(e) => setRow(row.id, "amount", e.target.value)}
                  placeholder="Montant €"
                />
                {rows.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => removeRow(row.id)}
                    className="shrink-0 text-slate-400 hover:text-red-500"
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                ) : (
                  <span className="w-4 shrink-0" />
                )}
              </div>
            ))}
          </div>
          {totalAmount > 0 && (
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-900">
              Total réclamé :{" "}
              <span className="text-slate-950">
                {totalAmount.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
              </span>
            </div>
          )}
        </div>

        {/* Délai */}
        <div>
          <p className="mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Délai de règlement</p>
          <label className={`${lbl} max-w-xs`}>
            Date limite (8 jours après réception de la LRAR)
            <input
              type="date"
              className={inp}
              value={form.deadlineDate}
              onChange={(e) => set("deadlineDate", e.target.value)}
            />
          </label>
        </div>

        {/* Signature */}
        <div>
          <p className="mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Signature</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={lbl}>
              Lieu
              <input className={inp} value={form.signaturePlace} onChange={(e) => set("signaturePlace", e.target.value)} placeholder="Paris" />
            </label>
            <label className={lbl}>
              Date
              <input type="date" className={inp} value={form.signatureDate} onChange={(e) => set("signatureDate", e.target.value)} />
            </label>
          </div>
        </div>

        {/* Rappel légal */}
        <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-800">
          <strong>Rappel :</strong> Cette mise en demeure précède le commandement de payer (acte d'huissier obligatoire,
          art. 24 loi 89-462). Elle n'a pas de valeur exécutoire par elle-même mais constitue une preuve de votre
          démarche amiable. Envoyez en <strong>lettre recommandée avec AR</strong>.
        </div>

        <button
          type="button"
          disabled={loading || totalAmount <= 0}
          onClick={generate}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
        >
          <ArrowDownTrayIcon className="h-4 w-4" />
          {loading ? "Génération en cours…" : "Générer le PDF"}
        </button>
      </div>
    </div>
  );
}

// ── Composant principal ──────────────────────────────────────
export function SectionModeles({ userId }: Props) {
  const [activeTemplate, setActiveTemplate] = useState<string | null>(null);

  if (activeTemplate === "conge-bailleur") {
    return <CongeForm userId={userId} onBack={() => setActiveTemplate(null)} />;
  }

  if (activeTemplate === "mise-en-demeure") {
    return <MiseEnDemeureForm userId={userId} onBack={() => setActiveTemplate(null)} />;
  }

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Modèles de documents"
        desc="Générez des courriers et documents juridiques prêts à envoyer, sans dépendance à votre dossier de bail."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {TEMPLATES.map((tpl) => (
          <div
            key={tpl.id}
            className={`group relative overflow-hidden rounded-2xl border bg-white p-5 shadow-sm transition ${
              tpl.status === "available"
                ? "cursor-pointer border-slate-200 hover:border-[#635bff]/40 hover:shadow-md"
                : "border-slate-100 opacity-60"
            }`}
            onClick={() => tpl.status === "available" && setActiveTemplate(tpl.id)}
            role={tpl.status === "available" ? "button" : undefined}
            tabIndex={tpl.status === "available" ? 0 : undefined}
            onKeyDown={(e) => {
              if (tpl.status === "available" && (e.key === "Enter" || e.key === " ")) {
                e.preventDefault();
                setActiveTemplate(tpl.id);
              }
            }}
          >
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 group-hover:border-[#635bff]/30 group-hover:bg-[#635bff]/5 group-hover:text-[#635bff]">
                <DocumentTextIcon className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-slate-950">{tpl.title}</p>
                  {tpl.status === "soon" && (
                    <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[0.65rem] font-semibold text-slate-500">
                      Bientôt
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{tpl.subtitle}</p>
                <span className="mt-2 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[0.65rem] font-semibold text-slate-600">
                  {CATEGORY_LABEL[tpl.category]}
                </span>
              </div>
            </div>

            {tpl.status === "available" && tpl.seoPath && (
              <a
                href={tpl.seoPath}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                title="Voir le guide complet"
              >
                <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
