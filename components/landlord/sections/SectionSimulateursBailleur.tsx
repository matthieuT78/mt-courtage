import React, { useMemo, useState } from "react";
import type { Plan } from "../../../lib/permissions";

type SimulatorKey = "lmnp" | "furnished" | "irl" | "sell";

type Props = {
  plan: Plan;
};

const euro = (n: number) =>
  Math.round(Number.isFinite(n) ? n : 0).toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });

const pct = (n: number) => `${(Number.isFinite(n) ? n : 0).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} %`;

function NumberField({
  label,
  value,
  onChange,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  suffix?: string;
}) {
  return (
    <label className="block min-w-0 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <span className="block text-xs font-semibold leading-4 text-slate-600">{label}</span>
      <div className="relative mt-2">
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(event) => onChange(Number(event.target.value.replace(",", ".") || 0))}
          className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 pr-16 text-lg font-semibold tabular-nums text-slate-950 outline-none focus:border-cyan-400 focus:bg-white"
        />
        {suffix ? (
          <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm font-semibold text-slate-500">
            {suffix}
          </span>
        ) : null}
      </div>
    </label>
  );
}

function ResultCard({ label, value, tone = "slate" }: { label: string; value: string; tone?: "slate" | "emerald" | "amber" | "red" }) {
  const tones = {
    slate: "border-slate-200 bg-slate-50 text-slate-900",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-950",
    amber: "border-amber-200 bg-amber-50 text-amber-950",
    red: "border-red-200 bg-red-50 text-red-950",
  };
  return (
    <div className={`min-w-0 rounded-2xl border p-4 ${tones[tone]}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.1em] opacity-70">{label}</p>
      <p className="mt-2 break-words text-2xl font-semibold leading-tight tabular-nums">{value}</p>
    </div>
  );
}

function LmnpSimulator() {
  const [monthlyRent, setMonthlyRent] = useState(850);
  const [deductibleCosts, setDeductibleCosts] = useState(2600);
  const [loanInterest, setLoanInterest] = useState(2200);
  const [propertyValue, setPropertyValue] = useState(160000);
  const [furnitureValue, setFurnitureValue] = useState(6500);
  const [taxRate, setTaxRate] = useState(30);

  const r = useMemo(() => {
    const annualRent = monthlyRent * 12;
    const microTaxable = annualRent * 0.5;
    const propertyAmort = propertyValue / 30;
    const furnitureAmort = furnitureValue / 7;
    const realTaxable = Math.max(0, annualRent - deductibleCosts - loanInterest - propertyAmort - furnitureAmort);
    const taxSaving = Math.max(0, (microTaxable - realTaxable) * (taxRate / 100));
    return { annualRent, microTaxable, realTaxable, taxSaving };
  }, [deductibleCosts, furnitureValue, loanInterest, monthlyRent, propertyValue, taxRate]);

  return (
    <div className="grid gap-5 2xl:grid-cols-[minmax(460px,1fr),minmax(420px,520px)]">
      <div className="grid min-w-0 gap-3 lg:grid-cols-2 2xl:grid-cols-1">
        <NumberField label="Loyer mensuel charges comprises" value={monthlyRent} onChange={setMonthlyRent} suffix="€" />
        <NumberField label="Charges déductibles annuelles" value={deductibleCosts} onChange={setDeductibleCosts} suffix="€" />
        <NumberField label="Intérêts d’emprunt annuels" value={loanInterest} onChange={setLoanInterest} suffix="€" />
        <NumberField label="Valeur logement amortissable" value={propertyValue} onChange={setPropertyValue} suffix="€" />
        <NumberField label="Mobilier amortissable" value={furnitureValue} onChange={setFurnitureValue} suffix="€" />
        <NumberField label="Taux marginal indicatif" value={taxRate} onChange={setTaxRate} suffix="%" />
      </div>
      <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-1">
        <ResultCard label="Revenus annuels" value={euro(r.annualRent)} />
        <ResultCard label="Base imposable micro-BIC" value={euro(r.microTaxable)} tone="amber" />
        <ResultCard label="Base imposable au réel estimée" value={euro(r.realTaxable)} tone={r.realTaxable < r.microTaxable ? "emerald" : "red"} />
        <ResultCard label="Gain fiscal indicatif" value={euro(r.taxSaving)} tone="emerald" />
      </div>
    </div>
  );
}

function FurnishedVsBareSimulator() {
  const [bareRent, setBareRent] = useState(760);
  const [furnishedRent, setFurnishedRent] = useState(850);
  const [bareVacancy, setBareVacancy] = useState(15);
  const [furnishedVacancy, setFurnishedVacancy] = useState(28);
  const [furnishingCost, setFurnishingCost] = useState(6500);
  const [taxRate, setTaxRate] = useState(30);

  const r = useMemo(() => {
    const bareGross = bareRent * 12 * (1 - bareVacancy / 365);
    const furnishedGross = furnishedRent * 12 * (1 - furnishedVacancy / 365);
    const bareTaxable = bareGross * 0.7;
    const furnishedTaxable = furnishedGross * 0.5;
    const furnishedAnnualCost = furnishingCost / 7;
    const bareNet = bareGross - bareTaxable * (taxRate / 100);
    const furnishedNet = furnishedGross - furnishedTaxable * (taxRate / 100) - furnishedAnnualCost;
    return { bareGross, furnishedGross, bareNet, furnishedNet, delta: furnishedNet - bareNet };
  }, [bareRent, bareVacancy, furnishedRent, furnishedVacancy, furnishingCost, taxRate]);

  return (
    <div className="grid gap-5 2xl:grid-cols-[minmax(460px,1fr),minmax(420px,520px)]">
      <div className="grid min-w-0 gap-3 lg:grid-cols-2 2xl:grid-cols-1">
        <NumberField label="Loyer nu mensuel" value={bareRent} onChange={setBareRent} suffix="€" />
        <NumberField label="Loyer meublé mensuel" value={furnishedRent} onChange={setFurnishedRent} suffix="€" />
        <NumberField label="Vacance annuelle nu" value={bareVacancy} onChange={setBareVacancy} suffix="jours" />
        <NumberField label="Vacance annuelle meublé" value={furnishedVacancy} onChange={setFurnishedVacancy} suffix="jours" />
        <NumberField label="Budget mobilier initial" value={furnishingCost} onChange={setFurnishingCost} suffix="€" />
        <NumberField label="Taux marginal indicatif" value={taxRate} onChange={setTaxRate} suffix="%" />
      </div>
      <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-1">
        <ResultCard label="Net annuel nu estimé" value={euro(r.bareNet)} />
        <ResultCard label="Net annuel meublé estimé" value={euro(r.furnishedNet)} />
        <ResultCard label="Écart meublé vs nu" value={euro(r.delta)} tone={r.delta >= 0 ? "emerald" : "red"} />
        <ResultCard label="Lecture rapide" value={r.delta >= 0 ? "Meublé plus favorable" : "Nu plus favorable"} tone={r.delta >= 0 ? "emerald" : "amber"} />
      </div>
    </div>
  );
}

function IrlSimulator() {
  const [rent, setRent] = useState(850);
  const [oldIndex, setOldIndex] = useState(142.06);
  const [newIndex, setNewIndex] = useState(145.47);

  const r = useMemo(() => {
    const newRent = oldIndex > 0 ? rent * (newIndex / oldIndex) : rent;
    return { newRent, delta: newRent - rent, change: rent > 0 ? ((newRent - rent) / rent) * 100 : 0 };
  }, [newIndex, oldIndex, rent]);

  return (
    <div className="grid gap-5 2xl:grid-cols-[minmax(460px,1fr),minmax(420px,520px)]">
      <div className="grid min-w-0 gap-3 lg:grid-cols-3 2xl:grid-cols-1">
        <NumberField label="Loyer actuel" value={rent} onChange={setRent} suffix="€" />
        <NumberField label="Ancien indice IRL" value={oldIndex} onChange={setOldIndex} />
        <NumberField label="Nouvel indice IRL" value={newIndex} onChange={setNewIndex} />
      </div>
      <div className="grid min-w-0 gap-3 sm:grid-cols-3 xl:grid-cols-1">
        <ResultCard label="Nouveau loyer indicatif" value={euro(r.newRent)} tone="emerald" />
        <ResultCard label="Hausse mensuelle" value={euro(r.delta)} />
        <ResultCard label="Variation" value={pct(r.change)} />
      </div>
    </div>
  );
}

function SellOrRentSimulator() {
  const [salePrice, setSalePrice] = useState(210000);
  const [netRent, setNetRent] = useState(620);
  const [loanPayment, setLoanPayment] = useState(580);
  const [annualCosts, setAnnualCosts] = useState(1600);
  const [expectedGrowth, setExpectedGrowth] = useState(1.5);
  const [alternativeYield, setAlternativeYield] = useState(3);

  const r = useMemo(() => {
    const annualCashflow = (netRent - loanPayment) * 12 - annualCosts;
    const patrimonialGain = salePrice * (expectedGrowth / 100);
    const keepScore = annualCashflow + patrimonialGain;
    const sellScore = salePrice * (alternativeYield / 100);
    return { annualCashflow, patrimonialGain, keepScore, sellScore, delta: keepScore - sellScore };
  }, [alternativeYield, annualCosts, expectedGrowth, loanPayment, netRent, salePrice]);

  return (
    <div className="grid gap-5 2xl:grid-cols-[minmax(460px,1fr),minmax(420px,520px)]">
      <div className="grid min-w-0 gap-3 lg:grid-cols-2 2xl:grid-cols-1">
        <NumberField label="Prix net vendeur estimé" value={salePrice} onChange={setSalePrice} suffix="€" />
        <NumberField label="Loyer net mensuel" value={netRent} onChange={setNetRent} suffix="€" />
        <NumberField label="Mensualité crédit" value={loanPayment} onChange={setLoanPayment} suffix="€" />
        <NumberField label="Charges annuelles non récupérées" value={annualCosts} onChange={setAnnualCosts} suffix="€" />
        <NumberField label="Valorisation annuelle estimée" value={expectedGrowth} onChange={setExpectedGrowth} suffix="%" />
        <NumberField label="Rendement alternatif vente" value={alternativeYield} onChange={setAlternativeYield} suffix="%" />
      </div>
      <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-1">
        <ResultCard label="Cash-flow annuel" value={euro(r.annualCashflow)} tone={r.annualCashflow >= -600 ? "emerald" : "amber"} />
        <ResultCard label="Gain patrimonial estimé" value={euro(r.patrimonialGain)} />
        <ResultCard label="Avantage garder vs vendre" value={euro(r.delta)} tone={r.delta >= 0 ? "emerald" : "red"} />
        <ResultCard label="Lecture rapide" value={r.delta >= 0 ? "Garder semble cohérent" : "Vendre mérite étude"} tone={r.delta >= 0 ? "emerald" : "amber"} />
      </div>
    </div>
  );
}

const simulators: Array<{ key: SimulatorKey; label: string; desc: string; outcome: string; badge: string }> = [
  {
    key: "lmnp",
    label: "LMNP réel ou micro-BIC",
    desc: "Comparer le régime simple et le réel avec charges, intérêts et amortissements.",
    outcome: "Décider si le réel mérite d’être étudié avec un comptable.",
    badge: "Fiscalité",
  },
  {
    key: "furnished",
    label: "Meublé ou nu",
    desc: "Mesurer le vrai gain après vacance, mobilier et fiscalité indicative.",
    outcome: "Voir si le meublé compense vraiment le turn-over et l’équipement.",
    badge: "Arbitrage",
  },
  {
    key: "irl",
    label: "Révision IRL",
    desc: "Calculer un nouveau loyer avec les indices de référence renseignés.",
    outcome: "Préparer une révision propre, lisible et justifiable.",
    badge: "Loyer",
  },
  {
    key: "sell",
    label: "Louer ou vendre",
    desc: "Comparer cash-flow, valorisation et rendement alternatif.",
    outcome: "Savoir si le bien doit être conservé, optimisé ou arbitré.",
    badge: "Décision",
  },
];

const premiumUseCases = [
  {
    title: "Choisir le bon régime",
    text: "Micro-BIC, réel, meublé ou nu : l’objectif est de repérer rapidement le scénario qui mérite une vraie analyse.",
  },
  {
    title: "Justifier une décision",
    text: "Chaque calcul donne une lecture métier : gain potentiel, risque de vacance, impact fiscal ou effort mensuel.",
  },
  {
    title: "Relier à vos données",
    text: "Les paramètres financiers renseignés dans Finance alimentent ensuite Performance pour prioriser les actions.",
  },
];

export function SectionSimulateursBailleur({ plan: _plan }: Props) {
  const [active, setActive] = useState<SimulatorKey>("lmnp");
  const current = simulators.find((s) => s.key === active) || simulators[0];

  const renderSimulator = () => {
    if (active === "lmnp") return <LmnpSimulator />;
    if (active === "furnished") return <FurnishedVsBareSimulator />;
    if (active === "irl") return <IrlSimulator />;
    return <SellOrRentSimulator />;
  };

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="relative overflow-hidden border-b border-slate-200 bg-[#f6f9fc] px-5 py-6 sm:px-6">
          <div>
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[#635bff]">Simulateurs bailleur</p>
            <h2 className="mt-3 max-w-3xl text-3xl font-semibold leading-tight text-slate-950">
              Des simulateurs pour décider, pas juste calculer.
            </h2>
            <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-600">
              Cette section aide un propriétaire à arbitrer les décisions qui ont un vrai impact : fiscalité LMNP,
              passage en meublé, révision de loyer, conservation ou vente d’un bien.
            </p>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-3">
            {premiumUseCases.map((item, index) => (
              <div key={item.title} className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <span className="absolute -right-2 -top-6 text-6xl font-semibold text-slate-100">0{index + 1}</span>
                <p className="relative text-sm font-semibold text-slate-950">{item.title}</p>
                <p className="relative mt-2 text-sm leading-6 text-slate-600">{item.text}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-0 xl:grid-cols-[300px,minmax(0,1fr)]">
          <aside className="border-b border-slate-200 bg-white p-4 lg:border-b-0 lg:border-r">
            <div className="space-y-2">
              {simulators.map((simulator) => (
                <button
                  key={simulator.key}
                  type="button"
                  onClick={() => setActive(simulator.key)}
                  className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                    active === simulator.key
                      ? "border-[#635bff]/30 bg-[#f6f9fc] shadow-sm"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-950">{simulator.label}</p>
                    <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[0.65rem] font-semibold text-[#635bff] shadow-sm">
                      {simulator.badge}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{simulator.desc}</p>
                </button>
              ))}
            </div>
          </aside>

          <div className="p-5">
            <div className="mb-5 grid gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-[minmax(0,1fr),280px]">
              <div>
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-slate-500">Simulation active</p>
                <p className="mt-1 text-xl font-semibold text-slate-950">{current.label}</p>
                <p className="mt-1 text-sm text-slate-600">{current.desc}</p>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">Ce que ça apporte</p>
                <p className="mt-2 text-sm font-semibold leading-5 text-emerald-950">{current.outcome}</p>
              </div>
            </div>
            {renderSimulator()}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">
        Ces simulateurs donnent une aide à la décision indicative. Ils ne remplacent pas l’avis d’un expert-comptable, d’un notaire ou d’un conseil
        fiscal, surtout en cas de régime particulier, SCI, déficit, amortissements complexes ou revente.
      </section>
    </div>
  );
}
