import React, { useMemo, useState } from "react";
import {
  ArrowDownTrayIcon,
  ArrowTopRightOnSquareIcon,
  CheckIcon,
  ChevronLeftIcon,
  ClipboardDocumentIcon,
  DocumentTextIcon,
  PlusIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { supabase } from "../../../lib/supabaseClient";
import { SectionTitle } from "../UiBits";
import type { CongeKind } from "../../../pages/api/lease-contracts/generate-conge";
import { IRL_TABLE, LATEST_IRL, irlByQuarter } from "../../../lib/irlData";

type Props = { userId: string };

type Template = {
  id: string;
  title: string;
  subtitle: string;
  category: "courrier" | "bail" | "gestion";
  status: "available" | "soon";
  seoPath?: string;
};

export const TEMPLATES: Template[] = [
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
    seoPath: "/modele-mise-en-demeure-loyer-impaye",
  },
  {
    id: "revision-loyer",
    title: "Notification de révision du loyer",
    subtitle: "Calcul IRL et notification conforme art. 17-1 loi 89-462",
    category: "courrier",
    status: "available",
    seoPath: "/modele-notification-revision-loyer",
  },
  {
    id: "restitution-depot",
    title: "Restitution du dépôt de garantie",
    subtitle: "Courrier de restitution avec ou sans retenues — art. 22 loi 89-462",
    category: "gestion",
    status: "available",
    seoPath: "/modele-restitution-depot-garantie",
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

  const inpBase = "rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-[#635bff] focus:outline-none focus:ring-1 focus:ring-[#635bff]/30";
  const inp = `w-full ${inpBase}`;
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
                  className={`${inpBase} min-w-0 flex-1`}
                  value={row.period}
                  onChange={(e) => setRow(row.id, "period", e.target.value)}
                  placeholder={idx === 0 ? "ex : Mai 2026" : "ex : Juin 2026"}
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className={`${inpBase} w-32 shrink-0`}
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

// ── Formulaire révision du loyer IRL ────────────────────────
function euro(n: number) {
  return n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 2 });
}
function fmtDate(iso: string) {
  if (!iso) return "—";
  return new Date(iso + "T00:00:00").toLocaleDateString("fr-FR");
}
function signedPct(n: number) {
  return (n >= 0 ? "+" : "") + n.toFixed(2) + " %";
}

function RevisionLoyerForm({ onBack }: { userId: string; onBack: () => void }) {
  const inp =
    "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-[#635bff] focus:outline-none focus:ring-1 focus:ring-[#635bff]/30";
  const lbl = "block space-y-1 text-xs font-semibold text-slate-700";

  const [form, setForm] = useState({
    landlordName: "",
    landlordAddress: "",
    tenantName: "",
    propertyAddress: "",
    leaseStartDate: "",
    currentRentRaw: "",
    refQuarter: "",
    newQuarter: LATEST_IRL.quarter,
    signaturePlace: "",
    signatureDate: new Date().toISOString().slice(0, 10),
  });
  const [showLetter, setShowLetter] = useState(false);
  const [copied, setCopied] = useState(false);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const currentRent = parseFloat(form.currentRentRaw.replace(",", ".")) || 0;
  const refEntry = useMemo(() => irlByQuarter(form.refQuarter), [form.refQuarter]);
  const newEntry = useMemo(() => irlByQuarter(form.newQuarter), [form.newQuarter]);

  const result = useMemo(() => {
    if (!refEntry || !newEntry || currentRent <= 0 || refEntry.value <= 0) return null;
    const newRent = Math.round((currentRent * (newEntry.value / refEntry.value)) * 100) / 100;
    const delta = newRent - currentRent;
    const change = ((newEntry.value - refEntry.value) / refEntry.value) * 100;
    return { newRent, delta, change };
  }, [refEntry, newEntry, currentRent]);

  const letter = useMemo(() => {
    if (!result || !refEntry || !newEntry) return "";
    const today = new Date(form.signatureDate + "T00:00:00").toLocaleDateString("fr-FR");
    const place = form.signaturePlace || "[Ville]";
    return `${place}, le ${today}

${form.landlordName || "[Nom du bailleur]"}
${form.landlordAddress || "[Adresse du bailleur]"}

À l'attention de ${form.tenantName || "[Nom du locataire]"}
${form.propertyAddress || "[Adresse du logement]"}

Objet : Révision annuelle du loyer – Article 17-1 de la loi n° 89-462 du 6 juillet 1989

Madame, Monsieur,

Conformément à la clause de révision annuelle stipulée dans notre contrat de location${form.leaseStartDate ? ` signé le ${fmtDate(form.leaseStartDate)}` : ""}, relatif au logement situé ${form.propertyAddress || "[adresse du logement]"}, j'ai l'honneur de vous informer de la révision annuelle du montant de votre loyer mensuel hors charges.

Cette révision est calculée selon l'Indice de Référence des Loyers (IRL) publié par l'INSEE, conformément à l'article 17-1 de la loi n° 89-462 du 6 juillet 1989 modifiée :

  Loyer en vigueur hors charges    : ${euro(currentRent)} / mois
  IRL de référence (${refEntry.label})   : ${refEntry.value}
  Nouvel IRL applicable (${newEntry.label}) : ${newEntry.value}
  Nouveau loyer hors charges        : ${euro(result.newRent)} / mois
  Variation                         : ${signedPct(result.change)}

Le nouveau loyer mensuel hors charges s'établit à ${euro(result.newRent)}, applicable à compter de la prochaine date anniversaire du bail.

Conformément à la réglementation en vigueur, cette révision ne peut avoir d'effet rétroactif que dans la limite des 12 mois précédant la présente notification.

Je reste à votre disposition pour tout renseignement complémentaire.

Veuillez agréer, Madame, Monsieur, l'expression de mes salutations distinguées.

${place}, le ${today}


___________________________
${form.landlordName || "[Signature]"}`;
  }, [form, result, refEntry, newEntry, currentRent]);

  function copyLetter() {
    navigator.clipboard.writeText(letter).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  const canGenerate = !!result && !!form.tenantName && !!form.propertyAddress && !!form.landlordName;

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
        <h2 className="mt-1 text-xl font-semibold text-slate-950">Notification de révision du loyer</h2>
        <p className="mt-1 text-sm text-slate-500">
          Remplissez les champs, le courrier officiel se génère instantanément. Copiez-le pour l'envoyer en recommandé AR.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">

        {/* Bailleur */}
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Bailleur</p>
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

        {/* Locataire & logement */}
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Locataire & logement</p>
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
              Date de début du bail
              <input type="date" className={inp} value={form.leaseStartDate} onChange={(e) => set("leaseStartDate", e.target.value)} />
            </label>
          </div>
        </div>

        {/* Calcul IRL */}
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Calcul de révision IRL</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className={lbl}>
              Loyer actuel HC (€)
              <input
                className={inp}
                inputMode="decimal"
                value={form.currentRentRaw}
                onChange={(e) => set("currentRentRaw", e.target.value)}
                placeholder="800"
              />
            </label>
            <label className={lbl}>
              Trimestre de référence
              <select className={inp} value={form.refQuarter} onChange={(e) => set("refQuarter", e.target.value)}>
                <option value="">— Sélectionner —</option>
                {IRL_TABLE.map((e) => (
                  <option key={e.quarter} value={e.quarter}>{e.label} — {e.value}</option>
                ))}
              </select>
            </label>
            <label className={lbl}>
              Trimestre de révision
              <select className={inp} value={form.newQuarter} onChange={(e) => set("newQuarter", e.target.value)}>
                {IRL_TABLE.map((e) => (
                  <option key={e.quarter} value={e.quarter}>{e.label} — {e.value}</option>
                ))}
              </select>
            </label>
          </div>

          {/* Résultat calcul */}
          {result && refEntry && newEntry ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-slate-50 px-3 py-2.5 text-center">
                <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-slate-400">Loyer actuel HC</p>
                <p className="mt-1 text-base font-bold text-slate-700">{euro(currentRent)}</p>
              </div>
              <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2.5 text-center">
                <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-indigo-500">Nouveau loyer HC</p>
                <p className="mt-1 text-base font-bold text-indigo-700">{euro(result.newRent)}</p>
              </div>
              <div className={`rounded-xl px-3 py-2.5 text-center ${result.delta >= 0 ? "border border-emerald-100 bg-emerald-50" : "border border-red-100 bg-red-50"}`}>
                <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-slate-400">Variation</p>
                <p className={`mt-1 text-base font-bold ${result.delta >= 0 ? "text-emerald-700" : "text-red-700"}`}>{signedPct(result.change)}</p>
                <p className="text-[0.65rem] text-slate-500">{euro(result.delta)}/mois</p>
              </div>
            </div>
          ) : currentRent > 0 && !refEntry ? (
            <p className="mt-3 text-xs text-slate-400">Sélectionnez le trimestre de référence pour calculer.</p>
          ) : null}
        </div>

        {/* Signature */}
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Signature</p>
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
          <strong>À savoir ·</strong> La révision est annuelle, à la date anniversaire du bail. La notification doit être écrite et adressée
          avant la date anniversaire — passé 12 mois, vous perdez le droit à la révision pour la période écoulée.
          Envoyez en <strong>lettre recommandée avec AR</strong>.
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            disabled={!canGenerate}
            onClick={() => setShowLetter((v) => !v)}
            className="text-sm font-semibold text-indigo-600 underline underline-offset-2 hover:text-indigo-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {showLetter ? "Masquer le courrier" : "Aperçu du courrier"}
          </button>
          <button
            type="button"
            disabled={!canGenerate}
            onClick={copyLetter}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {copied ? (
              <><CheckIcon className="h-4 w-4" />Copié !</>
            ) : (
              <><ClipboardDocumentIcon className="h-4 w-4" />Copier le courrier</>
            )}
          </button>
        </div>

        {showLetter && canGenerate && (
          <pre className="whitespace-pre-wrap rounded-xl border border-slate-100 bg-slate-50 p-4 font-mono text-[0.7rem] leading-[1.6] text-slate-700">
            {letter}
          </pre>
        )}
      </div>
    </div>
  );
}

// ── Formulaire restitution dépôt de garantie ────────────────
type RetenueLine = { id: number; motif: string; amount: string };

function RestitutionDepotForm({ onBack }: { userId: string; onBack: () => void }) {
  const inpBase = "rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-[#635bff] focus:outline-none focus:ring-1 focus:ring-[#635bff]/30";
  const inp = `w-full ${inpBase}`;
  const lbl = "block space-y-1 text-xs font-semibold text-slate-700";

  const [form, setForm] = useState({
    landlordName: "",
    landlordAddress: "",
    tenantName: "",
    propertyAddress: "",
    tenantNewAddress: "",
    leaseStartDate: "",
    leaseEndDate: "",
    depotRaw: "",
    hasIssues: false as boolean,
    restitutionMode: "virement" as "virement" | "cheque",
    signaturePlace: "",
    signatureDate: new Date().toISOString().slice(0, 10),
  });
  const [retenues, setRetenues] = useState<RetenueLine[]>([]);
  const [showLetter, setShowLetter] = useState(false);
  const [copied, setCopied] = useState(false);

  const set = (k: string, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const depot = parseFloat(form.depotRaw.replace(",", ".")) || 0;
  const totalRetenues = retenues.reduce((s, r) => s + (parseFloat(r.amount.replace(",", ".")) || 0), 0);
  const montantRestitue = Math.max(0, depot - totalRetenues);
  const delaiMois = form.hasIssues ? 2 : 1;

  const addRetenue = () =>
    setRetenues((rs) => [...rs, { id: Date.now(), motif: "", amount: "" }]);
  const removeRetenue = (id: number) => setRetenues((rs) => rs.filter((r) => r.id !== id));
  const setRetenue = (id: number, k: keyof RetenueLine, v: string) =>
    setRetenues((rs) => rs.map((r) => (r.id === id ? { ...r, [k]: v } : r)));

  const letter = useMemo(() => {
    const today = new Date(form.signatureDate + "T00:00:00").toLocaleDateString("fr-FR");
    const place = form.signaturePlace || "[Ville]";
    const depotStr = depot > 0 ? euro(depot) : "[montant du dépôt]";
    const restitueStr = depot > 0 ? euro(montantRestitue) : "[montant restitué]";

    const retenuesBlock =
      retenues.filter((r) => r.motif || r.amount).length > 0
        ? `\nDéductions effectuées sur justificatifs :\n${retenues
            .filter((r) => r.motif)
            .map((r) => `  - ${r.motif} : ${euro(parseFloat(r.amount.replace(",", ".")) || 0)}`)
            .join("\n")}\n\nTotal des retenues : ${euro(totalRetenues)}\n`
        : "\nAucune retenue n'est effectuée.\n";

    const modeEnvoi =
      form.restitutionMode === "virement"
        ? `par virement bancaire sur le compte dont vous m'aurez communiqué les coordonnées`
        : `par chèque adressé à votre nouvelle adresse`;

    return `${place}, le ${today}

${form.landlordName || "[Nom du bailleur]"}
${form.landlordAddress || "[Adresse du bailleur]"}

À l'attention de ${form.tenantName || "[Nom du locataire]"}${form.tenantNewAddress ? `\n${form.tenantNewAddress}` : ""}

Objet : Restitution du dépôt de garantie — ${form.propertyAddress || "[adresse du logement]"}

Madame, Monsieur,

Suite à la restitution des clés du logement situé ${form.propertyAddress || "[adresse]"}${form.leaseEndDate ? ` le ${fmtDate(form.leaseEndDate)}` : ""}, je procède à la régularisation du dépôt de garantie conformément à l'article 22 de la loi n° 89-462 du 6 juillet 1989.

Dépôt de garantie initial : ${depotStr}
${retenuesBlock}
Montant restitué : ${restitueStr}

Je vous adresse ce solde ${modeEnvoi} dans un délai de ${delaiMois} mois à compter de la remise des clés, conformément à la loi.${
      retenues.filter((r) => r.motif).length > 0
        ? "\n\nLes justificatifs correspondant aux retenues effectuées (devis, factures) vous sont joints au présent courrier."
        : ""
    }

Veuillez agréer, Madame, Monsieur, l'expression de mes salutations distinguées.

${place}, le ${today}


___________________________
${form.landlordName || "[Signature]"}`;
  }, [form, retenues, depot, totalRetenues, montantRestitue]);

  function copyLetter() {
    navigator.clipboard.writeText(letter).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  const canGenerate = !!form.landlordName && !!form.tenantName && !!form.propertyAddress && depot > 0;

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
        <p className="text-[0.7rem] font-semibold uppercase tracking-widest text-[#635bff]">Gestion</p>
        <h2 className="mt-1 text-xl font-semibold text-slate-950">Restitution du dépôt de garantie</h2>
        <p className="mt-1 text-sm text-slate-500">
          Courrier à envoyer après la remise des clés. Avec ou sans retenues — le calcul et le délai légal sont automatiques.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">

        {/* Bailleur */}
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Bailleur</p>
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
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Locataire & logement</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={lbl}>
              Nom du locataire
              <input className={inp} value={form.tenantName} onChange={(e) => set("tenantName", e.target.value)} placeholder="Prénom Nom" />
            </label>
            <label className={lbl}>
              Adresse du logement (quitté)
              <input className={inp} value={form.propertyAddress} onChange={(e) => set("propertyAddress", e.target.value)} placeholder="5 av. Victor Hugo, 69001 Lyon" />
            </label>
            <label className={`${lbl} sm:col-span-2`}>
              Nouvelle adresse du locataire <span className="font-normal text-slate-400">(optionnel)</span>
              <input className={inp} value={form.tenantNewAddress} onChange={(e) => set("tenantNewAddress", e.target.value)} placeholder="Pour l'envoi du courrier" />
            </label>
          </div>
        </div>

        {/* Informations bail */}
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Informations bail</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className={lbl}>
              Date d'entrée
              <input type="date" className={inp} value={form.leaseStartDate} onChange={(e) => set("leaseStartDate", e.target.value)} />
            </label>
            <label className={lbl}>
              Date de sortie (remise des clés)
              <input type="date" className={inp} value={form.leaseEndDate} onChange={(e) => set("leaseEndDate", e.target.value)} />
            </label>
            <label className={lbl}>
              Montant du dépôt (€)
              <input
                className={inp}
                inputMode="decimal"
                value={form.depotRaw}
                onChange={(e) => set("depotRaw", e.target.value)}
                placeholder="800"
              />
            </label>
          </div>

          {/* Etat des lieux */}
          <div className="mt-3 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <input
              id="hasIssues"
              type="checkbox"
              checked={form.hasIssues}
              onChange={(e) => set("hasIssues", e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="hasIssues" className="text-sm text-slate-700 cursor-pointer select-none">
              Des dégradations ont été constatées à l'état des lieux de sortie
              <span className="ml-2 text-slate-400 text-xs">(délai légal : {form.hasIssues ? "2 mois" : "1 mois"})</span>
            </label>
          </div>
        </div>

        {/* Retenues */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Retenues sur dépôt</p>
            <button
              type="button"
              onClick={addRetenue}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              <PlusIcon className="h-3.5 w-3.5" />
              Ajouter une retenue
            </button>
          </div>

          {retenues.length === 0 ? (
            <p className="text-xs text-slate-400">Aucune retenue — la totalité du dépôt est restituée.</p>
          ) : (
            <div className="space-y-2">
              {retenues.map((r) => (
                <div key={r.id} className="flex items-center gap-2">
                  <input
                    className={`${inpBase} min-w-0 flex-1`}
                    value={r.motif}
                    onChange={(e) => setRetenue(r.id, "motif", e.target.value)}
                    placeholder="ex : Réparation fuite, remplacement serrure…"
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className={`${inpBase} w-32 shrink-0`}
                    value={r.amount}
                    onChange={(e) => setRetenue(r.id, "amount", e.target.value)}
                    placeholder="Montant €"
                  />
                  <button
                    type="button"
                    onClick={() => removeRetenue(r.id)}
                    className="shrink-0 text-slate-400 hover:text-red-500"
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Récapitulatif */}
          {depot > 0 && (
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <div className="rounded-xl bg-slate-50 px-3 py-2.5 text-center">
                <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-slate-400">Dépôt initial</p>
                <p className="mt-1 text-base font-bold text-slate-700">{euro(depot)}</p>
              </div>
              <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-center">
                <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-red-400">Total retenues</p>
                <p className="mt-1 text-base font-bold text-red-700">{euro(totalRetenues)}</p>
              </div>
              <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2.5 text-center">
                <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-emerald-500">À restituer</p>
                <p className="mt-1 text-base font-bold text-emerald-700">{euro(montantRestitue)}</p>
              </div>
            </div>
          )}
        </div>

        {/* Mode de restitution */}
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Mode de restitution</p>
          <div className="flex gap-3">
            {(["virement", "cheque"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => set("restitutionMode", mode)}
                className={`rounded-xl border px-4 py-2.5 text-xs font-semibold transition ${
                  form.restitutionMode === mode
                    ? "border-[#635bff] bg-[#635bff]/10 text-[#635bff]"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {mode === "virement" ? "Virement bancaire" : "Chèque"}
              </button>
            ))}
          </div>
        </div>

        {/* Signature */}
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Signature</p>
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
          <strong>Art. 22 loi 89-462 ·</strong> Délai de {delaiMois} mois à compter de la remise des clés.
          En cas de dépassement, le dépôt non restitué produit des intérêts au taux légal augmenté de 10 %.
          Joignez les justificatifs (devis, factures) pour toute retenue.
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            disabled={!canGenerate}
            onClick={() => setShowLetter((v) => !v)}
            className="text-sm font-semibold text-indigo-600 underline underline-offset-2 hover:text-indigo-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {showLetter ? "Masquer le courrier" : "Aperçu du courrier"}
          </button>
          <button
            type="button"
            disabled={!canGenerate}
            onClick={copyLetter}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {copied ? (
              <><CheckIcon className="h-4 w-4" />Copié !</>
            ) : (
              <><ClipboardDocumentIcon className="h-4 w-4" />Copier le courrier</>
            )}
          </button>
        </div>

        {showLetter && canGenerate && (
          <pre className="whitespace-pre-wrap rounded-xl border border-slate-100 bg-slate-50 p-4 font-mono text-[0.7rem] leading-[1.6] text-slate-700">
            {letter}
          </pre>
        )}
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

  if (activeTemplate === "revision-loyer") {
    return <RevisionLoyerForm userId={userId} onBack={() => setActiveTemplate(null)} />;
  }

  if (activeTemplate === "restitution-depot") {
    return <RestitutionDepotForm userId={userId} onBack={() => setActiveTemplate(null)} />;
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
