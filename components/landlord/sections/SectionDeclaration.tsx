import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

type Regime = "lmnp_micro" | "lmnp_reel" | "nu_micro" | "nu_reel" | "pinel";
type LocationKind = "meuble_longue" | "meuble_saisonnier";

type Stored = {
  id: string;
  user_id: string;
  year: number;
  regime: Regime;
  data: any;
  updated_at: string;
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

export function SectionDeclaration({ userId }: { userId: string }) {
  // 🎨 Brand lokt.fr
  const brandBg = "bg-gradient-to-r from-indigo-700 to-cyan-500";
  const brandText = "text-white";
  const brandHover = "hover:opacity-95";

  const years = useMemo(() => {
    const y = currentYear();
    return [y, y - 1, y - 2, y - 3];
  }, []);

  const [year, setYear] = useState<number>(years[1] ?? currentYear() - 1); // par défaut : N-1
  const [regime, setRegime] = useState<Regime>("lmnp_micro");

  // LMNP options
  const [locationKind, setLocationKind] = useState<LocationKind>("meuble_saisonnier");

  // Common inputs
  const [grossRent, setGrossRent] = useState(0); // loyers encaissés
  const [chargesRecovered, setChargesRecovered] = useState(0); // provisions/charges refacturées
  const [otherIncome, setOtherIncome] = useState(0); // ex: indemnités, etc.
  const [depositReceived, setDepositReceived] = useState(0); // dépôt de garantie (info)
  const [marketingOptInHint, setMarketingOptInHint] = useState(false);

  // Real expenses (LMNP réel / NU réel)
  const [interest, setInterest] = useState(0);
  const [insurance, setInsurance] = useState(0);
  const [propertyTax, setPropertyTax] = useState(0);
  const [copro, setCopro] = useState(0);
  const [repairs, setRepairs] = useState(0);
  const [managementFees, setManagementFees] = useState(0); // conciergerie / agence / frais plateforme
  const [utilities, setUtilities] = useState(0);
  const [otherExpenses, setOtherExpenses] = useState(0);

  // LMNP réel amortissements (option “manuel”)
  const [amortization, setAmortization] = useState(0);

  // Pinel (bloc ultra simple pour MVP)
  const [pinelAddress, setPinelAddress] = useState("");
  const [pinelAcqYear, setPinelAcqYear] = useState<number>(currentYear() - 1);
  const [pinelCommitmentYears, setPinelCommitmentYears] = useState<number>(6);

  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [rowId, setRowId] = useState<string | null>(null);

  const isLmnp = regime.startsWith("lmnp");
  const isNu = regime.startsWith("nu");
  const isPinel = regime === "pinel";
  const isMicro = regime.endsWith("micro");
  const isReal = regime.endsWith("reel");

  // ====== Load / Save ======
  const load = async () => {
    if (!supabase || !userId) return;
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
        // reset soft (on ne wipe pas tout : on laisse l’utilisateur)
        setInfo("Aucune déclaration sauvegardée pour cet exercice. Remplissez puis sauvegardez.");
        return;
      }

      const d = (data as Stored).data || {};
      setRowId((data as Stored).id);

      setLocationKind((d.locationKind as LocationKind) || "meuble_saisonnier");
      setGrossRent(toNumber(d.grossRent));
      setChargesRecovered(toNumber(d.chargesRecovered));
      setOtherIncome(toNumber(d.otherIncome));
      setDepositReceived(toNumber(d.depositReceived));
      setMarketingOptInHint(!!d.marketingOptInHint);

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

      setInfo("Déclaration chargée ✅");
    } catch (e: any) {
      setErr(e?.message || "Impossible de charger la déclaration.");
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    if (!supabase || !userId) return;
    setLoading(true);
    setErr(null);
    setInfo(null);

    try {
      const payload = {
        user_id: userId,
        year,
        regime,
        data: {
          locationKind,
          grossRent,
          chargesRecovered,
          otherIncome,
          depositReceived,
          marketingOptInHint,

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
      setInfo("Sauvegardé ✅");
    } catch (e: any) {
      setErr(e?.message || "Erreur de sauvegarde.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, year, regime]);

  // ====== Calculs ======
  const receiptsTotal = useMemo(() => {
    // Le dépôt de garantie n’est pas du revenu (indicatif uniquement)
    return grossRent + chargesRecovered + otherIncome;
  }, [grossRent, chargesRecovered, otherIncome]);

  const expensesTotal = useMemo(() => {
    if (!isReal) return 0;
    return (
      interest +
      insurance +
      propertyTax +
      copro +
      repairs +
      managementFees +
      utilities +
      otherExpenses +
      (isLmnp ? amortization : 0)
    );
  }, [isReal, interest, insurance, propertyTax, copro, repairs, managementFees, utilities, otherExpenses, amortization, isLmnp]);

  const taxableApprox = useMemo(() => {
    // ⚠️ approximatif (objectif: guidance + saisie).
    // - micro : pas de déduction ici (abattement géré par impôts)
    // - réel : recettes - charges (y compris amortissements en LMNP réel)
    if (isMicro) return receiptsTotal;
    return Math.max(0, receiptsTotal - expensesTotal);
  }, [isMicro, receiptsTotal, expensesTotal]);

  // ====== “Cases” guidance (MVP) ======
  const guidance = useMemo(() => {
    // ⚠️ Les libellés / numéros de cases peuvent évoluer. On fournit un guide pratique,
    // et tu peux ensuite ajuster les libellés en fonction de la capture impots.gouv.
    if (regime === "lmnp_micro") {
      return {
        title: "LMNP — Micro-BIC (meublé)",
        form: "Déclaration en ligne → Revenus → Revenus industriels et commerciaux (BIC) non professionnels (LMNP)",
        lines: [
          { label: "Recettes (loyers + charges + autres)", value: receiptsTotal, where: "BIC non pro (micro) → Recettes" },
          { label: "Dépôt de garantie (info)", value: depositReceived, where: "Ne pas inclure dans les recettes (sauf conservé)" },
        ],
        notes: [
          "Le dépôt de garantie n’est pas un revenu tant qu’il n’est pas conservé.",
          "L’abattement micro-BIC est appliqué automatiquement par l’administration.",
          locationKind === "meuble_saisonnier"
            ? "Saisonnier : pense à inclure les frais plateforme dans tes charges uniquement si tu es au réel (pas au micro)."
            : "Longue durée : au micro, l’abattement couvre les charges (tu ne les détailles pas).",
        ],
      };
    }

    if (regime === "lmnp_reel") {
      return {
        title: "LMNP — Réel simplifié (meublé)",
        form: "BIC non professionnels (LMNP) → Régime réel : liasse/annexes selon ton mode (expert-comptable ou téléprocédure).",
        lines: [
          { label: "Recettes totales", value: receiptsTotal, where: "BIC non pro (réel) → Recettes" },
          { label: "Charges (hors amortissements)", value: expensesTotal - amortization, where: "BIC réel → Charges déductibles" },
          { label: "Amortissements (si applicable)", value: amortization, where: "BIC réel → Amortissements" },
          { label: "Résultat estimatif", value: taxableApprox, where: "BIC réel → Résultat" },
        ],
        notes: [
          "En LMNP réel, l’amortissement est souvent le levier principal (mais nécessite une méthode).",
          "Saisonnier : conciergerie/frais plateforme/ménage se mettent typiquement en charges.",
        ],
      };
    }

    if (regime === "nu_micro") {
      return {
        title: "Location nue — Micro-foncier",
        form: "Revenus fonciers → Micro-foncier",
        lines: [
          { label: "Recettes (loyers + charges refacturées)", value: receiptsTotal, where: "Micro-foncier → Recettes" },
          { label: "Dépôt de garantie (info)", value: depositReceived, where: "Ne pas inclure dans les recettes (sauf conservé)" },
        ],
        notes: [
          "Micro-foncier : l’abattement est appliqué automatiquement, tu ne détailles pas les charges.",
          "Si tu as beaucoup de charges (travaux/intérêts), le réel est souvent plus intéressant.",
        ],
      };
    }

    if (regime === "nu_reel") {
      return {
        title: "Location nue — Réel (revenus fonciers)",
        form: "Revenus fonciers → Régime réel (annexe 2044 en général) + report sur 2042",
        lines: [
          { label: "Recettes totales", value: receiptsTotal, where: "2044 → Recettes" },
          { label: "Charges (intérêts/assurances/TF/copro/travaux/gestion...)", value: expensesTotal, where: "2044 → Charges déductibles" },
          { label: "Résultat estimatif", value: taxableApprox, where: "2044 → Résultat" },
        ],
        notes: [
          "En réel, certaines dépenses sont déductibles et d’autres non (ex : travaux d’agrandissement ≠ entretien).",
          "Si tu veux, on peut ajouter un assistant “déductible / non déductible” par catégorie.",
        ],
      };
    }

    // pinel
    return {
      title: "Pinel — Location nue + réduction d’impôt",
      form: "Revenus fonciers (nu) + module Réduction Pinel",
      lines: [
        { label: "Recettes totales (partie foncier)", value: receiptsTotal, where: "Foncier → Recettes" },
        { label: "Charges (si réel)", value: isReal ? expensesTotal : 0, where: "Foncier → Charges (si réel)" },
        { label: "Infos Pinel", value: 0, where: "Réduction → Pinel (année acquisition, engagement...)" },
      ],
      notes: [
        `Bien : ${pinelAddress || "—"}`,
        `Année acquisition : ${pinelAcqYear} • Engagement : ${pinelCommitmentYears} ans`,
        "Pinel = foncier + réduction : on sépare bien les deux blocs.",
      ],
    };
  }, [regime, receiptsTotal, depositReceived, locationKind, expensesTotal, amortization, taxableApprox, isReal, pinelAddress, pinelAcqYear, pinelCommitmentYears]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className={cx("h-1.5 w-full", brandBg)} />
        <div className="p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">Espace bailleur</p>
              <h2 className="mt-1 text-lg sm:text-xl font-semibold text-slate-900">Aide à la déclaration</h2>
              <p className="mt-1 text-sm text-slate-600 max-w-2xl">
                Mode <span className="font-semibold">manuel + assisté</span> : tu saisis tes montants, lokt.fr te dit
                <span className="font-semibold"> quoi reporter et où</span>. (Quand tu auras une table d’encaissements,
                on pourra proposer un mode “auto”.)
              </p>
              <p className="mt-2 text-[0.75rem] text-slate-500">
                Dépôt de garantie : informatif (en général non imposable tant qu’il n’est pas conservé).
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={save}
                disabled={loading}
                className={cx(
                  "inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold",
                  brandBg,
                  brandText,
                  brandHover,
                  loading && "opacity-60"
                )}
              >
                {loading ? "…" : rowId ? "Sauvegarder" : "Sauvegarder"}
              </button>
              <button
                type="button"
                onClick={load}
                disabled={loading}
                className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
              >
                Recharger
              </button>
            </div>
          </div>

          {err ? (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>
          ) : null}
          {info ? (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              {info}
            </div>
          ) : null}
        </div>
      </div>

      {/* Controls */}
      <div className="grid gap-4 lg:grid-cols-[1fr,1fr]">
        <div className="rounded-3xl border border-slate-200 bg-white shadow-sm p-5 space-y-3">
          <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">1) Exercice</p>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs text-slate-700">Année déclarée</label>
              <select
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value, 10))}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-700">Régime</label>
              <select
                value={regime}
                onChange={(e) => setRegime(e.target.value as Regime)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <optgroup label="LMNP (meublé)">
                  <option value="lmnp_micro">LMNP — Micro-BIC</option>
                  <option value="lmnp_reel">LMNP — Réel</option>
                </optgroup>
                <optgroup label="Location nue">
                  <option value="nu_micro">Nu — Micro-foncier</option>
                  <option value="nu_reel">Nu — Réel</option>
                </optgroup>
                <optgroup label="Pinel">
                  <option value="pinel">Pinel (nu + réduction)</option>
                </optgroup>
              </select>
            </div>
          </div>

          {isLmnp ? (
            <div className="grid gap-3 sm:grid-cols-2 pt-2">
              <div className="space-y-1">
                <label className="text-xs text-slate-700">Type de meublé</label>
                <select
                  value={locationKind}
                  onChange={(e) => setLocationKind(e.target.value as LocationKind)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="meuble_longue">Meublé longue durée</option>
                  <option value="meuble_saisonnier">Meublé saisonnier</option>
                </select>
              </div>

              <label className="mt-6 inline-flex items-start gap-2 text-sm text-slate-800">
                <input
                  type="checkbox"
                  checked={marketingOptInHint}
                  onChange={(e) => setMarketingOptInHint(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300"
                />
                <span>Rappel : j’ai des frais plateforme/conciergerie (utile si réel)</span>
              </label>
            </div>
          ) : null}

          {isPinel ? (
            <div className="pt-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
              <p className="text-xs font-semibold text-slate-900">Infos Pinel (MVP)</p>

              <div className="space-y-1">
                <label className="text-xs text-slate-700">Adresse du bien</label>
                <input
                  value={pinelAddress}
                  onChange={(e) => setPinelAddress(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs text-slate-700">Année d’acquisition</label>
                  <input
                    type="number"
                    value={pinelAcqYear}
                    onChange={(e) => setPinelAcqYear(parseInt(e.target.value || "0", 10))}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-700">Durée d’engagement</label>
                  <select
                    value={pinelCommitmentYears}
                    onChange={(e) => setPinelCommitmentYears(parseInt(e.target.value, 10))}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value={6}>6 ans</option>
                    <option value={9}>9 ans</option>
                    <option value={12}>12 ans</option>
                  </select>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Inputs */}
        <div className="rounded-3xl border border-slate-200 bg-white shadow-sm p-5 space-y-4">
          <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">2) Montants (manuel)</p>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs text-slate-700">Loyers encaissés</label>
              <input
                type="number"
                value={grossRent}
                onChange={(e) => setGrossRent(toNumber(e.target.value))}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-700">Charges récupérées</label>
              <input
                type="number"
                value={chargesRecovered}
                onChange={(e) => setChargesRecovered(toNumber(e.target.value))}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs text-slate-700">Autres recettes</label>
              <input
                type="number"
                value={otherIncome}
                onChange={(e) => setOtherIncome(toNumber(e.target.value))}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-700">Dépôt de garantie (info)</label>
              <input
                type="number"
                value={depositReceived}
                onChange={(e) => setDepositReceived(toNumber(e.target.value))}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              />
            </div>
          </div>

          {isReal ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
              <p className="text-xs font-semibold text-slate-900">Charges (si régime réel)</p>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Intérêts d’emprunt" value={interest} onChange={setInterest} />
                <Field label="Assurances (PNO, GLI...)" value={insurance} onChange={setInsurance} />
                <Field label="Taxe foncière" value={propertyTax} onChange={setPropertyTax} />
                <Field label="Copropriété / charges non récup." value={copro} onChange={setCopro} />
                <Field label="Entretien / réparations" value={repairs} onChange={setRepairs} />
                <Field label="Gestion / conciergerie / plateforme" value={managementFees} onChange={setManagementFees} />
                <Field label="Eau/élec/internet (si à ta charge)" value={utilities} onChange={setUtilities} />
                <Field label="Autres charges" value={otherExpenses} onChange={setOtherExpenses} />
              </div>

              {isLmnp ? (
                <div className="pt-2">
                  <Field label="Amortissements (si tu les connais)" value={amortization} onChange={setAmortization} />
                  <p className="mt-2 text-[0.75rem] text-slate-600">
                    En LMNP réel, l’amortissement est souvent calculé via un tableau (compta). Ici, tu peux le saisir
                    manuellement pour obtenir un résultat estimatif.
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs text-slate-500">Recettes totales (hors dépôt)</p>
                <p className="text-lg font-semibold text-slate-900">{eur(receiptsTotal)}</p>
              </div>

              {isReal ? (
                <div className="text-right">
                  <p className="text-xs text-slate-500">Charges totales</p>
                  <p className="text-lg font-semibold text-slate-900">{eur(expensesTotal)}</p>
                </div>
              ) : null}
            </div>

            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-xs text-slate-600">
                Résultat estimatif (indicatif) : <span className="font-semibold text-slate-900">{eur(taxableApprox)}</span>
              </p>
              <p className="mt-1 text-[0.75rem] text-slate-500">
                Micro : l’abattement est appliqué automatiquement sur impots.gouv.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Guidance */}
      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">3) lokt.fr → impots.gouv</p>
            <h3 className="mt-1 text-base font-semibold text-slate-900">{guidance.title}</h3>
            <p className="mt-1 text-sm text-slate-600">{guidance.form}</p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold text-slate-900">À reporter</p>
            <div className="mt-2 space-y-2">
              {guidance.lines.map((l: any) => (
                <div key={l.label} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <p className="text-xs text-slate-500">{l.where}</p>
                  <p className="text-sm font-semibold text-slate-900">
                    {l.label} : {eur(toNumber(l.value))}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold text-slate-900">Notes</p>
            <ul className="mt-2 space-y-2 text-sm text-slate-700">
              {guidance.notes.map((n: string, idx: number) => (
                <li key={idx} className="flex gap-2">
                  <span className="mt-0.5">•</span>
                  <span>{n}</span>
                </li>
              ))}
            </ul>

            <div className="mt-4 rounded-xl border border-slate-200 bg-white px-3 py-2">
              <p className="text-xs text-slate-600">
                Prochaine amélioration : “assistant ligne par ligne” (ex: travaux déductibles vs agrandissement, frais
                de notaire, mobilier, etc.).
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={save}
            disabled={loading}
            className={cx(
              "inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold",
              brandBg,
              brandText,
              brandHover,
              loading && "opacity-60"
            )}
          >
            {loading ? "…" : "Sauvegarder mes montants"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-slate-700">{label}</label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(toNumber(e.target.value))}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
      />
    </div>
  );
}
