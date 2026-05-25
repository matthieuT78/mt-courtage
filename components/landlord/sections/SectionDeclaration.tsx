import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownTrayIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  LockClosedIcon,
  SparklesIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { supabase } from "../../../lib/supabaseClient";
import type { Property } from "../../../lib/landlord/types";
import { usePermissions } from "../../PermissionProvider";

type Regime = "lmnp_micro" | "lmnp_reel" | "nu_micro" | "nu_reel" | "pinel";
type LocationKind = "meuble_longue" | "meuble_saisonnier";
type DeclarationStep = "prepare" | "verify" | "export";

type Stored = {
  id: string;
  data: any;
};

type Transaction = {
  id: string;
  user_id: string;
  property_id: string | null;
  occurred_at: string;
  direction: "in" | "out";
  status: "expected" | "received" | "paid";
  category: string;
  label: string | null;
  amount: number;
  notes: string | null;
};

type Props = {
  userId: string;
  properties?: Property[];
};

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

function eur(n: number) {
  if (!Number.isFinite(n)) return "0 €";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

function toNumber(v: any) {
  const n = typeof v === "number" ? v : parseFloat(String(v || "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function currentYear() {
  return new Date().getFullYear();
}

function yearRange(year: number) {
  return { start: `${year}-01-01`, end: `${year}-12-31` };
}

function csvCell(value: string | number | null | undefined) {
  const raw = value == null ? "" : String(value);
  return `"${raw.replace(/"/g, '""')}"`;
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-slate-900">{value}</p>
      {sub ? <p className="mt-1 text-xs text-slate-600">{sub}</p> : null}
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-slate-700">{label}</label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(toNumber(e.target.value))}
        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
      />
    </div>
  );
}

export function SectionDeclaration({ userId, properties }: Props) {
  const { loading: permissionsLoading, plan, canUseLandlord } = usePermissions();
  const isPremium = canUseLandlord;

  const brandBg = "bg-gradient-to-r from-indigo-700 to-cyan-500";
  const brandText = "text-white";
  const brandHover = "hover:opacity-95";

  const safeProperties = Array.isArray(properties) ? properties : [];
  const propertyById = useMemo(() => new Map(safeProperties.map((p) => [p.id, p])), [safeProperties]);

  const years = useMemo(() => {
    const y = currentYear();
    return [y, y - 1, y - 2, y - 3];
  }, []);

  const [year, setYear] = useState<number>(years[1] ?? currentYear() - 1);
  const [regime, setRegime] = useState<Regime>("lmnp_micro");
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("all");
  const [locationKind, setLocationKind] = useState<LocationKind>("meuble_longue");

  const [grossRent, setGrossRent] = useState(0);
  const [chargesRecovered, setChargesRecovered] = useState(0);
  const [otherIncome, setOtherIncome] = useState(0);
  const [depositReceived, setDepositReceived] = useState(0);
  const [interest, setInterest] = useState(0);
  const [insurance, setInsurance] = useState(0);
  const [propertyTax, setPropertyTax] = useState(0);
  const [copro, setCopro] = useState(0);
  const [repairs, setRepairs] = useState(0);
  const [managementFees, setManagementFees] = useState(0);
  const [utilities, setUtilities] = useState(0);
  const [otherExpenses, setOtherExpenses] = useState(0);
  const [amortization, setAmortization] = useState(0);
  const [pinelAddress, setPinelAddress] = useState("");
  const [pinelAcqYear, setPinelAcqYear] = useState<number>(currentYear() - 1);
  const [pinelCommitmentYears, setPinelCommitmentYears] = useState<number>(6);

  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [rowId, setRowId] = useState<string | null>(null);
  const [financeRows, setFinanceRows] = useState<Transaction[]>([]);
  const [activeStep, setActiveStep] = useState<DeclarationStep>("prepare");

  const isLmnp = regime.startsWith("lmnp");
  const isNu = regime.startsWith("nu");
  const isPinel = regime === "pinel";
  const isReal = regime.endsWith("reel");
  const receiptsTotal = grossRent + chargesRecovered + otherIncome;
  const chargesBeforeAmortization = interest + insurance + propertyTax + copro + repairs + managementFees + utilities + otherExpenses;
  const realExpensesTotal = chargesBeforeAmortization + (isLmnp ? amortization : 0);
  const taxableApprox = regime.endsWith("micro") ? receiptsTotal : Math.max(0, receiptsTotal - realExpensesTotal);

  const microBicBase = Math.max(0, receiptsTotal * 0.5);
  const microFoncierBase = Math.max(0, receiptsTotal * 0.7);
  const realLmnpBase = Math.max(0, receiptsTotal - chargesBeforeAmortization - amortization);
  const realNuBase = Math.max(0, receiptsTotal - chargesBeforeAmortization);
  const recommendedMode = isLmnp
    ? realLmnpBase < microBicBase
      ? "Le réel LMNP semble plus favorable à vérifier."
      : "Le micro-BIC semble suffisant à ce stade."
    : realNuBase < microFoncierBase
    ? "Le réel foncier semble plus favorable à vérifier."
    : "Le micro-foncier semble suffisant à ce stade.";

  const selectedPropertyLabel =
    selectedPropertyId === "all" ? "Tous les biens" : propertyById.get(selectedPropertyId)?.label || "Bien sélectionné";

  const load = async () => {
    if (!supabase || !userId || !isPremium) return;
    setLoading(true);
    setErr(null);
    setInfo(null);

    try {
      const { data, error } = await supabase
        .from("tax_declarations")
        .select("*")
        .eq("user_id", userId)
        .eq("year", year)
        .eq("regime", regime)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        setRowId(null);
        setInfo("Aucune préparation sauvegardée pour cet exercice.");
        return;
      }

      const d = ((data as Stored).data || {}) as any;
      setRowId((data as Stored).id);
      setSelectedPropertyId(d.selectedPropertyId || "all");
      setLocationKind((d.locationKind as LocationKind) || "meuble_longue");
      setGrossRent(toNumber(d.grossRent));
      setChargesRecovered(toNumber(d.chargesRecovered));
      setOtherIncome(toNumber(d.otherIncome));
      setDepositReceived(toNumber(d.depositReceived));
      setInterest(toNumber(d.interest));
      setInsurance(toNumber(d.insurance));
      setPropertyTax(toNumber(d.propertyTax));
      setCopro(toNumber(d.copro));
      setRepairs(toNumber(d.repairs));
      setManagementFees(toNumber(d.managementFees));
      setUtilities(toNumber(d.utilities));
      setOtherExpenses(toNumber(d.otherExpenses));
      setAmortization(toNumber(d.amortization));
      setPinelAddress(String(d.pinelAddress || ""));
      setPinelAcqYear(Number.isFinite(d.pinelAcqYear) ? d.pinelAcqYear : currentYear() - 1);
      setPinelCommitmentYears(Number.isFinite(d.pinelCommitmentYears) ? d.pinelCommitmentYears : 6);
      setInfo("Préparation chargée ✅");
    } catch (e: any) {
      setErr(e?.message || "Impossible de charger la préparation.");
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    if (!supabase || !userId || !isPremium) return;
    setLoading(true);
    setErr(null);
    setInfo(null);

    try {
      const payload = {
        user_id: userId,
        year,
        regime,
        data: {
          selectedPropertyId,
          locationKind,
          grossRent,
          chargesRecovered,
          otherIncome,
          depositReceived,
          interest,
          insurance,
          propertyTax,
          copro,
          repairs,
          managementFees,
          utilities,
          otherExpenses,
          amortization,
          pinelAddress,
          pinelAcqYear,
          pinelCommitmentYears,
          importedFromFinanceAt: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("tax_declarations")
        .upsert(payload, { onConflict: "user_id,year,regime" })
        .select("id")
        .single();

      if (error) throw error;
      setRowId((data as any)?.id || null);
      setInfo("Dossier déclaration sauvegardé ✅");
    } catch (e: any) {
      setErr(e?.message || "Erreur de sauvegarde.");
    } finally {
      setLoading(false);
    }
  };

  const importFromFinance = async () => {
    if (!supabase || !userId || !isPremium) return;
    setLoading(true);
    setErr(null);
    setInfo(null);

    try {
      const { start, end } = yearRange(year);
      let query = supabase
        .from("transactions")
        .select("*")
        .eq("user_id", userId)
        .gte("occurred_at", start)
        .lte("occurred_at", end)
        .order("occurred_at", { ascending: true });

      if (selectedPropertyId !== "all") query = query.eq("property_id", selectedPropertyId);
      const { data, error } = await query;
      if (error) throw error;

      const rows = ((data || []) as Transaction[]) || [];
      setFinanceRows(rows);
      const receivedIncome = rows.filter((r) => r.direction === "in" && (r.status === "received" || r.category === "rent"));
      const paidExpenses = rows.filter((r) => r.direction === "out" && r.status === "paid");
      const sum = (list: Transaction[]) => list.reduce((acc, r) => acc + Number(r.amount || 0), 0);

      setGrossRent(sum(receivedIncome.filter((r) => r.category === "rent")));
      setOtherIncome(sum(receivedIncome.filter((r) => r.category !== "rent")));
      setPropertyTax(sum(paidExpenses.filter((r) => r.category === "tax")));
      setInsurance(sum(paidExpenses.filter((r) => r.category === "insurance")));
      setCopro(sum(paidExpenses.filter((r) => r.category === "copro")));
      setRepairs(sum(paidExpenses.filter((r) => r.category === "repairs")));
      setManagementFees(sum(paidExpenses.filter((r) => r.category === "management" || r.category === "fees")));
      setUtilities(sum(paidExpenses.filter((r) => r.category === "utilities")));
      setOtherExpenses(sum(paidExpenses.filter((r) => !["tax", "insurance", "copro", "repairs", "management", "fees", "utilities"].includes(r.category))));
      setInfo(`Import Finance terminé ✅ (${rows.length} écriture${rows.length > 1 ? "s" : ""})`);
    } catch (e: any) {
      setErr(e?.message || "Impossible d’importer depuis Finance.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!permissionsLoading && isPremium) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, year, regime, permissionsLoading, isPremium]);

  const alerts = useMemo(() => {
    const list: Array<{ tone: "amber" | "red" | "emerald"; text: string }> = [];
    if (depositReceived > 0) list.push({ tone: "amber", text: "Dépôt de garantie saisi : ne l’intégrez pas aux recettes sauf s’il est conservé." });
    if (isNu && receiptsTotal > 15000) list.push({ tone: "red", text: "Micro-foncier à vérifier : les recettes dépassent 15 000 €." });
    if (isLmnp && realLmnpBase + 1000 < microBicBase) list.push({ tone: "amber", text: "Le réel LMNP semble nettement plus favorable que le micro-BIC. À confirmer avec un comptable." });
    if (isNu && realNuBase + 1000 < microFoncierBase) list.push({ tone: "amber", text: "Le réel foncier semble plus favorable que le micro-foncier. Vérifiez les charges déductibles." });
    if (isLmnp && amortization === 0 && regime === "lmnp_reel") list.push({ tone: "amber", text: "LMNP réel sans amortissement : le résultat est probablement incomplet." });
    if (chargesBeforeAmortization === 0 && receiptsTotal > 0) list.push({ tone: "amber", text: "Aucune charge saisie : importez Finance ou vérifiez vos justificatifs." });
    if (list.length === 0) list.push({ tone: "emerald", text: "Aucune incohérence évidente détectée. Gardez les justificatifs avant déclaration." });
    return list;
  }, [depositReceived, isNu, receiptsTotal, isLmnp, realLmnpBase, microBicBase, realNuBase, microFoncierBase, amortization, regime, chargesBeforeAmortization]);

  const checklist = [
    { label: "Quittances / paiements encaissés", ok: grossRent > 0 },
    { label: "Taxe foncière", ok: propertyTax > 0 || regime.endsWith("micro") },
    { label: "Assurance PNO / GLI", ok: insurance > 0 || regime.endsWith("micro") },
    { label: "Copropriété / appels de fonds", ok: copro > 0 || regime.endsWith("micro") },
    { label: "Factures travaux / entretien", ok: repairs > 0 || regime.endsWith("micro") },
    { label: "Frais gestion / agence / conciergerie", ok: managementFees > 0 || regime.endsWith("micro") },
    { label: "Intérêts d’emprunt", ok: interest > 0 || regime.endsWith("micro") },
    { label: "Inventaire LMNP du logement meublé", ok: !isLmnp || true },
  ];

  const exportDossier = () => {
    const rows = [
      ["Année", year],
      ["Bien", selectedPropertyLabel],
      ["Régime choisi", regime],
      ["Recettes loyers", grossRent],
      ["Charges récupérées", chargesRecovered],
      ["Autres recettes", otherIncome],
      ["Dépôt garantie indicatif", depositReceived],
      ["Charges hors amortissement", chargesBeforeAmortization],
      ["Amortissements", amortization],
      ["Résultat estimatif", taxableApprox],
      ["Micro-BIC estimatif", microBicBase],
      ["Micro-foncier estimatif", microFoncierBase],
      ["Réel LMNP estimatif", realLmnpBase],
      ["Réel foncier estimatif", realNuBase],
      ["Lecture", recommendedMode],
    ];
    const csv = [["Champ", "Valeur"], ...rows].map((row) => row.map(csvCell).join(";")).join("\r\n");
    const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `dossier-declaration-${year}-${selectedPropertyId === "all" ? "tous-biens" : selectedPropertyId}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const steps: Array<{ key: DeclarationStep; label: string; title: string; desc: string }> = [
    { key: "prepare", label: "1", title: "Préparer", desc: "Année, bien, régime et import Finance." },
    { key: "verify", label: "2", title: "Vérifier", desc: "Contrôler les montants et le régime le plus cohérent." },
    { key: "export", label: "3", title: "Exporter", desc: "Alertes, justificatifs et dossier comptable." },
  ];

  const completionItems = [
    { label: "Périmètre choisi", ok: !!year && !!regime && !!selectedPropertyId },
    { label: "Recettes renseignées", ok: receiptsTotal > 0 },
    { label: "Charges contrôlées", ok: chargesBeforeAmortization > 0 || regime.endsWith("micro") },
    { label: "Dossier sauvegardé", ok: !!rowId },
  ];
  const completionPct = Math.round((completionItems.filter((item) => item.ok).length / completionItems.length) * 100);

  if (!permissionsLoading && !isPremium) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-800">
              <LockClosedIcon className="h-4 w-4" />
              Fonction premium
            </div>
            <h2 className="mt-4 text-xl font-semibold text-slate-900">Aide à la déclaration propriétaire</h2>
            <p className="mt-2 text-sm text-slate-600">
              Cette section prépare un dossier fiscal exploitable : import Finance, ventilation par bien, comparaison micro/réel,
              alertes d’incohérence, checklist justificatifs et export pour votre comptable.
            </p>
          </div>
          <Link href="/mon-compte/abonnement" className={cx("rounded-full px-5 py-2.5 text-sm font-semibold", brandBg, brandText, brandHover)}>
            Voir les abonnements
          </Link>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <Stat label="Import Finance" value="Premium" sub="Recettes et charges préremplies" />
          <Stat label="Comparaison" value="Micro / réel" sub="Lecture indicative par régime" />
          <Stat label="Dossier" value="Export" sub="Synthèse à transmettre" />
        </div>

        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Le plan gratuit reste centré sur la gestion de base d’un bien. La préparation déclarative est une fonctionnalité à forte valeur, réservée aux offres payantes.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-950 px-5 py-5 text-white">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-[0.7rem] uppercase tracking-[0.18em] text-cyan-200">Premium · aide à la déclaration</p>
              <h2 className="mt-2 text-2xl font-semibold">Préparer un dossier fiscal propre, sans se noyer dans les cases.</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                lokt.fr vous guide en trois temps : importer les données, vérifier les montants, puis exporter une synthèse claire pour vous ou votre comptable.
              </p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-300">Dossier prêt</p>
              <p className="mt-1 text-2xl font-semibold">{completionPct}%</p>
            </div>
          </div>
        </div>

        <div className="grid gap-0 xl:grid-cols-[320px,minmax(0,1fr)]">
          <aside className="border-b border-slate-200 bg-slate-50 p-4 xl:border-b-0 xl:border-r">
            <div className="space-y-2">
              {steps.map((step) => (
                <button
                  key={step.key}
                  type="button"
                  onClick={() => setActiveStep(step.key)}
                  className={cx(
                    "w-full rounded-2xl border px-4 py-3 text-left transition",
                    activeStep === step.key ? "border-cyan-300 bg-white shadow-sm" : "border-slate-200 bg-white/70 hover:bg-white"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span className={cx("flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold", activeStep === step.key ? brandBg + " " + brandText : "bg-slate-100 text-slate-700")}>
                      {step.label}
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-slate-950">{step.title}</span>
                      <span className="mt-1 block text-xs leading-5 text-slate-500">{step.desc}</span>
                    </span>
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Avancement</p>
              <div className="mt-3 space-y-2">
                {completionItems.map((item) => (
                  <div key={item.label} className="flex items-center gap-2 text-sm">
                    <CheckCircleIcon className={cx("h-4 w-4", item.ok ? "text-emerald-500" : "text-slate-300")} />
                    <span className={item.ok ? "text-slate-800" : "text-slate-500"}>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </aside>

          <div className="min-w-0 p-5">
            <div className="mb-4 grid gap-3 md:grid-cols-4">
              <Stat label="Recettes" value={eur(receiptsTotal)} sub="Hors dépôt" />
              <Stat label="Charges" value={eur(chargesBeforeAmortization)} sub="Hors amort." />
              <Stat label="Résultat" value={eur(taxableApprox)} sub="Indicatif" />
              <Stat label="Import" value={String(financeRows.length)} sub={`${selectedPropertyLabel} · ${year}`} />
            </div>

            {err ? <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div> : null}
            {info ? <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{info}</div> : null}

            {activeStep === "prepare" ? (
              <div className="space-y-4">
                <section className="rounded-3xl border border-slate-200 bg-white p-5">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">1. Choisir le périmètre</p>
                      <p className="mt-1 text-sm text-slate-600">Sélectionnez l’exercice, le bien et le régime que vous voulez préparer.</p>
                    </div>
                    <button type="button" onClick={importFromFinance} disabled={loading} className={cx("inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold", brandBg, brandText, brandHover, loading && "opacity-60")}>
                      <ArrowPathIcon className="h-4 w-4" />
                      Importer Finance
                    </button>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div>
                      <label className="text-xs font-semibold text-slate-700">Année déclarée</label>
                      <select value={year} onChange={(e) => setYear(parseInt(e.target.value, 10))} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm">
                        {years.map((y) => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-700">Bien</label>
                      <select value={selectedPropertyId} onChange={(e) => setSelectedPropertyId(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm">
                        <option value="all">Tous les biens</option>
                        {safeProperties.map((property) => (
                          <option key={property.id} value={property.id}>{property.label || property.address_line1 || "Bien"}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-700">Régime travaillé</label>
                      <select value={regime} onChange={(e) => setRegime(e.target.value as Regime)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm">
                        <option value="lmnp_micro">LMNP · Micro-BIC</option>
                        <option value="lmnp_reel">LMNP · Réel</option>
                        <option value="nu_micro">Location nue · Micro-foncier</option>
                        <option value="nu_reel">Location nue · Réel</option>
                        <option value="pinel">Pinel</option>
                      </select>
                    </div>
                    {isLmnp ? (
                      <div>
                        <label className="text-xs font-semibold text-slate-700">Type de meublé</label>
                        <select value={locationKind} onChange={(e) => setLocationKind(e.target.value as LocationKind)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm">
                          <option value="meuble_longue">Meublé longue durée</option>
                          <option value="meuble_saisonnier">Meublé saisonnier</option>
                        </select>
                      </div>
                    ) : null}
                  </div>

                  {isPinel ? (
                    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-semibold text-slate-900">Informations Pinel</p>
                      <div className="mt-3 grid gap-3">
                        <input value={pinelAddress} onChange={(e) => setPinelAddress(e.target.value)} className="rounded-xl border border-slate-300 px-3 py-2 text-sm" placeholder="Adresse du bien" />
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Field label="Année acquisition" value={pinelAcqYear} onChange={setPinelAcqYear} />
                          <Field label="Engagement années" value={pinelCommitmentYears} onChange={setPinelCommitmentYears} />
                        </div>
                      </div>
                    </div>
                  ) : null}
                </section>

                <div className="flex justify-end">
                  <button type="button" onClick={() => setActiveStep("verify")} className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800">
                    Vérifier les montants
                  </button>
                </div>
              </div>
            ) : null}

            {activeStep === "verify" ? (
              <div className="space-y-4">
                <section className="rounded-3xl border border-slate-200 bg-white p-5">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">2. Contrôler les montants</p>
                      <p className="mt-1 text-sm text-slate-600">Les montants peuvent venir de Finance ou être corrigés manuellement.</p>
                    </div>
                    <button type="button" onClick={save} disabled={loading} className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60">
                      {loading ? "Sauvegarde..." : rowId ? "Sauvegarder" : "Créer le dossier"}
                    </button>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <Field label="Loyers encaissés" value={grossRent} onChange={setGrossRent} />
                    <Field label="Charges récupérées" value={chargesRecovered} onChange={setChargesRecovered} />
                    <Field label="Autres recettes" value={otherIncome} onChange={setOtherIncome} />
                    <Field label="Dépôt garantie info" value={depositReceived} onChange={setDepositReceived} />
                    <Field label="Intérêts d’emprunt" value={interest} onChange={setInterest} />
                    <Field label="Assurances" value={insurance} onChange={setInsurance} />
                    <Field label="Taxe foncière" value={propertyTax} onChange={setPropertyTax} />
                    <Field label="Copro non récup." value={copro} onChange={setCopro} />
                    <Field label="Travaux / entretien" value={repairs} onChange={setRepairs} />
                    <Field label="Gestion / conciergerie" value={managementFees} onChange={setManagementFees} />
                    <Field label="Eau/élec/internet" value={utilities} onChange={setUtilities} />
                    <Field label="Autres charges" value={otherExpenses} onChange={setOtherExpenses} />
                    {isLmnp ? <Field label="Amortissements" value={amortization} onChange={setAmortization} /> : null}
                  </div>
                </section>

                <section className="rounded-3xl border border-slate-200 bg-white p-5">
                  <p className="text-sm font-semibold text-slate-950">Lecture automatique</p>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div className={cx("rounded-2xl border p-4", isLmnp ? "border-cyan-200 bg-cyan-50" : "border-slate-200 bg-slate-50")}>
                      <p className="text-sm font-semibold text-slate-900">Meublé LMNP</p>
                      <p className="mt-2 text-sm text-slate-700">Micro-BIC : <span className="font-semibold">{eur(microBicBase)}</span></p>
                      <p className="mt-1 text-sm text-slate-700">Réel : <span className="font-semibold">{eur(realLmnpBase)}</span></p>
                    </div>
                    <div className={cx("rounded-2xl border p-4", isNu ? "border-cyan-200 bg-cyan-50" : "border-slate-200 bg-slate-50")}>
                      <p className="text-sm font-semibold text-slate-900">Location nue</p>
                      <p className="mt-2 text-sm text-slate-700">Micro-foncier : <span className="font-semibold">{eur(microFoncierBase)}</span></p>
                      <p className="mt-1 text-sm text-slate-700">Réel : <span className="font-semibold">{eur(realNuBase)}</span></p>
                    </div>
                  </div>
                  <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-950">
                    <SparklesIcon className="mr-2 inline h-4 w-4" />
                    {recommendedMode}
                  </div>
                </section>

                <div className="flex justify-between gap-2">
                  <button type="button" onClick={() => setActiveStep("prepare")} className="rounded-full border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50">
                    Retour
                  </button>
                  <button type="button" onClick={() => setActiveStep("export")} className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800">
                    Voir les points à traiter
                  </button>
                </div>
              </div>
            ) : null}

            {activeStep === "export" ? (
              <div className="space-y-4">
                <div className="grid gap-4 lg:grid-cols-2">
                  <section className="rounded-3xl border border-slate-200 bg-white p-5">
                    <p className="text-sm font-semibold text-slate-900">Points à traiter</p>
                    <div className="mt-3 space-y-2">
                      {alerts.map((alert, idx) => (
                        <div key={idx} className={cx("rounded-2xl border px-3 py-3 text-sm", alert.tone === "red" ? "border-red-200 bg-red-50 text-red-800" : alert.tone === "amber" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-emerald-200 bg-emerald-50 text-emerald-900")}>
                          <ExclamationTriangleIcon className="mr-2 inline h-4 w-4" />
                          {alert.text}
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="rounded-3xl border border-slate-200 bg-white p-5">
                    <p className="text-sm font-semibold text-slate-900">Justificatifs à garder</p>
                    <div className="mt-3 space-y-2">
                      {checklist.map((item) => (
                        <div key={item.label} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                          <span className="text-slate-700">{item.label}</span>
                          <span className={cx("shrink-0 rounded-full px-2 py-0.5 text-[0.7rem] font-semibold", item.ok ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900")}>
                            {item.ok ? "OK" : "À vérifier"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>

                <section className="rounded-3xl border border-slate-200 bg-white p-5">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">Dossier à exporter</p>
                      <p className="mt-1 text-sm text-slate-600">
                        Synthèse {year} pour {selectedPropertyLabel} : recettes {eur(receiptsTotal)}, charges {eur(chargesBeforeAmortization)}, résultat indicatif {eur(taxableApprox)}.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={save} disabled={loading} className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-60">
                        {loading ? "Sauvegarde..." : "Sauvegarder"}
                      </button>
                      <button type="button" onClick={exportDossier} className={cx("inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold", brandBg, brandText, brandHover)}>
                        <ArrowDownTrayIcon className="h-4 w-4" />
                        Exporter le dossier
                      </button>
                    </div>
                  </div>
                </section>

                <section className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">
                  Cette aide prépare vos chiffres et vos justificatifs. Elle ne remplace pas la déclaration officielle sur impots.gouv ni l’avis d’un professionnel.
                </section>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
