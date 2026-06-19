// components/AcheterOuLouerWizard.tsx
import { useEffect, useRef, useState, useMemo } from "react";
import {
  BriefcaseIcon,
  ClockIcon,
  MapPinIcon,
  ScaleIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
  XMarkIcon,
  MagnifyingGlassIcon,
  SparklesIcon,
  BanknotesIcon,
  HomeModernIcon,
  BuildingOffice2Icon,
} from "@heroicons/react/24/outline";
import CalculatorWizardShell from "./calculators/CalculatorWizardShell";
import Link from "next/link";

/* ─────────── helpers ─────────── */
function fmtEuro(n: number, decimals = 0) {
  return n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: decimals });
}
function fmtPct(n: number) {
  return n.toLocaleString("fr-FR", { maximumFractionDigits: 1 }) + " %";
}
function toNum(s: string) {
  const v = parseFloat((s ?? "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(v) ? v : 0;
}
function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}
function mensualite(principal: number, annualRatePct: number, years: number): number {
  if (principal <= 0 || years <= 0) return 0;
  const r = annualRatePct / 100 / 12;
  const n = years * 12;
  return r === 0 ? principal / n : (principal * r) / (1 - Math.pow(1 + r, -n));
}

/* ─────────── market zone ─────────── */
type MarketZone = "A_bis" | "A" | "B1" | "B2" | "C";
type ZoneMeta = { label: string; context: string; dot: string; text: string; border: string; bg: string; };

const ZONE_META: Record<MarketZone, ZoneMeta> = {
  A_bis: { label: "Marché hyper-tendu",         dot: "bg-red-500",     text: "text-red-700",     border: "border-red-200",     bg: "bg-red-50",     context: "Paris et petite couronne — ratio ×28 à ×40 en moyenne. La liquidité est excellente mais acheter pour y habiter est souvent moins rentable qu'investir ailleurs." },
  A:     { label: "Marché très tendu",            dot: "bg-orange-500",  text: "text-orange-700",  border: "border-orange-200",  bg: "bg-orange-50",  context: "Grande couronne IDF, Côte d'Azur, Genevois — marchés premium. Bonne liquidité à la revente, mais seuil de rentabilité long (10-15 ans)." },
  B1:    { label: "Grande métropole — dynamique", dot: "bg-amber-500",   text: "text-amber-700",   border: "border-amber-200",   bg: "bg-amber-50",   context: "Lyon, Bordeaux, Toulouse, Nantes, Strasbourg… Croissance démographique et emploi solides. Achat RP pertinent sur 7-10 ans. Locatif rendement 4-6 %." },
  B2:    { label: "Marché intermédiaire",         dot: "bg-sky-500",     text: "text-sky-700",     border: "border-sky-200",     bg: "bg-sky-50",     context: "Villes moyennes — prix plus accessibles, seuil de rentabilité réduit à 5-7 ans. Bon terrain pour un premier achat RP ou locatif." },
  C:     { label: "Marché détendu",               dot: "bg-emerald-500", text: "text-emerald-700", border: "border-emerald-200", bg: "bg-emerald-50", context: "Petites villes et zones rurales — ratio prix/loyer très favorable, rendements locatifs parfois > 7 %. Liquidité à la revente plus lente." },
};

const B1_DEPTS = new Set(["13","31","33","34","35","38","44","54","57","59","67","69","76","83","84"]);
const B2_DEPTS = new Set(["14","25","29","37","42","45","49","51","56","60","62","63","64","66","68","72","73","80","85","86","87"]);

function getZone(postalCode: string): MarketZone {
  const dept = postalCode.replace(/\D/g, "").slice(0, 2);
  if (["75","92","93","94"].includes(dept)) return "A_bis";
  if (["77","78","91","95","06","74"].includes(dept)) return "A";
  if (B1_DEPTS.has(dept)) return "B1";
  if (B2_DEPTS.has(dept)) return "B2";
  return "C";
}

/* ─────────── types ─────────── */
type CityOption = { name: string; postalCode: string; inseeCode: string };
type Objectif  = "rp" | "locatif" | "les_deux";
type Contrat   = "fonctionnaire" | "cdi_senior" | "cdi_junior" | "cdi_new" | "cdd" | "independant";
type Anciennete = "moins_1_an" | "1_3_ans" | "plus_3_ans";
type Horizon   = "moins_3_ans" | "3_5_ans" | "5_10_ans" | "plus_10_ans";
type Mobilite  = "tres_probable" | "possible" | "peu_probable";

type Form = {
  objectif:         Objectif | "";
  contrat:          Contrat | "";
  anciennete:       Anciennete | "";
  revenus:          string;
  apport:           string;
  loyer_actuel:     string;
  horizon:          Horizon | "";
  mobilite:         Mobilite | "";
  villeNom:         string;
  villePostal:      string;
  prix_rp:          string;
  loyer_marche_rp:  string;
  prix_locatif:     string;
  loyer_locatif:    string;
};

const INIT: Form = {
  objectif: "", contrat: "", anciennete: "",
  revenus: "", apport: "", loyer_actuel: "",
  horizon: "", mobilite: "",
  villeNom: "", villePostal: "",
  prix_rp: "", loyer_marche_rp: "",
  prix_locatif: "", loyer_locatif: "",
};

/* ─────────── scoring ─────────── */
type Detail = { label: string; pts: number };
type Scores = {
  rp:      { score: number; details: Detail[] };
  locatif: { score: number; details: Detail[] };
};

type Monthly = {
  mensualite_rp:       number;
  extra_rp:            number;   // mensualite+charges - loyer_actuel (>0 = coûte plus cher que louer)
  mensualite_locatif:  number;
  cashflow_brut:       number;
  cashflow_net:        number;
  cout_net_locatif:    number;   // loyer_actuel - cashflow_net (net à débourser)
  rendement_brut:      number;
  pr_rp:               number | null;
  apport_pct_rp:       number | null;
  apport_pct_locatif:  number | null;
};

function computeAll(f: Form): { scores: Scores; monthly: Monthly } {
  // ── helpers
  const apport     = toNum(f.apport);
  const revenus    = toNum(f.revenus);
  const loyer_act  = toNum(f.loyer_actuel);
  const prix_rp    = toNum(f.prix_rp);
  const loyer_rp   = toNum(f.loyer_marche_rp);
  const prix_loc   = toNum(f.prix_locatif);
  const loyer_loc  = toNum(f.loyer_locatif);
  const zone       = f.villePostal ? getZone(f.villePostal) : null;

  // ── monthly
  const capital_rp    = Math.max(0, prix_rp - apport);
  const men_rp        = mensualite(capital_rp, 3.7, 25);
  const charges_rp    = prix_rp > 0 ? prix_rp * 0.008 / 12 : 0;  // copro + entretien ~0.8%/an
  const tf_rp         = loyer_rp > 0 ? loyer_rp * 0.5 / 12 : 0;  // taxe foncière ~0.5 loyer mensuel/an
  const extra_rp      = men_rp + charges_rp + tf_rp - loyer_act;  // delta vs renting

  const capital_loc   = Math.max(0, prix_loc - apport);
  const men_loc       = mensualite(capital_loc, 3.9, 25);          // taux légèrement supérieur en locatif
  const charges_loc   = prix_loc > 0 ? prix_loc * 0.008 / 12 : 0;
  const tf_loc        = loyer_loc > 0 ? loyer_loc * 0.5 / 12 : 0;
  const gestion       = loyer_loc * 0.07;                           // gestion agence estimée 7%
  const cashflow_brut = loyer_loc - men_loc;
  const cashflow_net  = loyer_loc - men_loc - charges_loc - tf_loc - gestion;
  const cout_net_loc  = loyer_act - cashflow_net;                   // ce que vous débourser net/mois

  const rend_brut     = prix_loc > 0 && loyer_loc > 0 ? (loyer_loc * 12 / prix_loc) * 100 : 0;
  const pr_rp         = prix_rp > 0 && loyer_rp > 0 ? prix_rp / (loyer_rp * 12) : null;
  const apport_pct_rp  = prix_rp > 0 ? (apport / prix_rp) * 100 : null;
  const apport_pct_loc = prix_loc > 0 ? (apport / prix_loc) * 100 : null;

  const monthly: Monthly = {
    mensualite_rp: men_rp, extra_rp, mensualite_locatif: men_loc,
    cashflow_brut, cashflow_net, cout_net_locatif: cout_net_loc,
    rendement_brut: rend_brut, pr_rp, apport_pct_rp, apport_pct_locatif: apport_pct_loc,
  };

  // ── RP score (base 50)
  let rpS = 50;
  const rpD: Detail[] = [];
  const addRp = (label: string, pts: number) => { rpS += pts; rpD.push({ label, pts }); };

  if (f.contrat) {
    const map: Record<Contrat, [string, number]> = {
      fonctionnaire: ["Statut fonctionnaire", 15],
      cdi_senior:    ["CDI ancienneté > 3 ans", 12],
      cdi_junior:    ["CDI 1-3 ans", 6],
      cdi_new:       ["CDI récent (< 1 an)", 2],
      cdd:           ["Contrat CDD", -8],
      independant:   ["Indépendant / freelance", -5],
    };
    const [lbl, pts] = map[f.contrat as Contrat];
    addRp(lbl, pts);
  }
  if (f.anciennete && (f.contrat === "cdd" || f.contrat === "independant")) {
    const pts = f.anciennete === "plus_3_ans" ? 5 : f.anciennete === "1_3_ans" ? 2 : -3;
    addRp(`Ancienneté ${f.anciennete === "plus_3_ans" ? "> 3 ans" : f.anciennete === "1_3_ans" ? "1-3 ans" : "< 1 an"}`, pts);
  }
  if (f.horizon) {
    const map: Record<Horizon, [string, number]> = {
      moins_3_ans: ["Horizon < 3 ans", -22], "3_5_ans": ["Horizon 3-5 ans", -5],
      "5_10_ans": ["Horizon 5-10 ans", 12], plus_10_ans: ["Horizon > 10 ans", 22],
    };
    const [lbl, pts] = map[f.horizon as Horizon];
    addRp(lbl, pts);
  }
  if (f.mobilite) {
    const map: Record<Mobilite, [string, number]> = {
      tres_probable: ["Mobilité pro très probable", -15],
      possible: ["Mobilité envisageable", -5],
      peu_probable: ["Stabilité géographique", 8],
    };
    const [lbl, pts] = map[f.mobilite as Mobilite];
    addRp(lbl, pts);
  }
  if (apport_pct_rp !== null) {
    const pts = apport_pct_rp < 5 ? -10 : apport_pct_rp < 10 ? 0 : apport_pct_rp < 20 ? 8 : 15;
    const lbl = apport_pct_rp < 5 ? "Apport < 5 % du prix RP" : apport_pct_rp < 10 ? "Apport 5-10 % du prix RP" : apport_pct_rp < 20 ? "Apport 10-20 %" : "Apport > 20 %";
    addRp(lbl, pts);
  }
  if (zone) {
    const map: Record<MarketZone, [string, number]> = {
      A_bis: ["Marché hyper-tendu (RP très coûteuse)", -12],
      A:     ["Marché très tendu (RP chère)", -6],
      B1:    ["Grande métropole dynamique", 4],
      B2:    ["Marché intermédiaire", 3],
      C:     ["Marché détendu — prix accessibles", 8],
    };
    const [lbl, pts] = map[zone];
    addRp(lbl, pts);
  }
  if (pr_rp !== null) {
    const pts = pr_rp < 12 ? 20 : pr_rp < 17 ? 10 : pr_rp < 22 ? 0 : pr_rp < 28 ? -10 : -20;
    const lbl = pr_rp < 12 ? `Ratio prix/loyer très favorable (×${pr_rp.toFixed(0)})` :
                pr_rp < 17 ? `Ratio prix/loyer favorable (×${pr_rp.toFixed(0)})` :
                pr_rp < 22 ? `Ratio prix/loyer neutre (×${pr_rp.toFixed(0)})` :
                pr_rp < 28 ? `Marché cher — ratio ×${pr_rp.toFixed(0)}` : `Marché très cher — ratio ×${pr_rp.toFixed(0)}`;
    addRp(lbl, pts);
  }

  // ── Locatif score (base 50)
  let locS = 50;
  const locD: Detail[] = [];
  const addLoc = (label: string, pts: number) => { locS += pts; locD.push({ label, pts }); };

  if (f.contrat) {
    const map: Record<Contrat, [string, number]> = {
      fonctionnaire: ["Fonctionnaire — accès crédit facile", 15],
      cdi_senior:    ["CDI stable — bancable", 12],
      cdi_junior:    ["CDI confirmé", 8],
      cdi_new:       ["CDI récent — faisable", 3],
      cdd:           ["CDD — financement difficile", -10],
      independant:   ["Indépendant — 3 bilans requis", -8],
    };
    const [lbl, pts] = map[f.contrat as Contrat];
    addLoc(lbl, pts);
  }
  // Apport pour locatif : les banques exigent 15-25%
  if (apport_pct_loc !== null) {
    const pts = apport_pct_loc < 10 ? -18 : apport_pct_loc < 15 ? -5 : apport_pct_loc < 20 ? 10 : 18;
    const lbl = apport_pct_loc < 10 ? "Apport < 10 % — accès crédit difficile" :
                apport_pct_loc < 15 ? "Apport 10-15 % — limite basse" :
                apport_pct_loc < 20 ? "Apport 15-20 % — correct" : "Apport > 20 % — excellent";
    addLoc(lbl, pts);
  }
  // Capacité d'endettement
  if (revenus > 0 && men_loc > 0) {
    const endettement = men_loc / revenus;
    const pts = endettement < 0.2 ? 15 : endettement < 0.3 ? 8 : endettement < 0.35 ? 0 : -12;
    const lbl = endettement < 0.2 ? `Mensualité locatif = ${fmtPct(endettement*100)} des revenus — large marge` :
                endettement < 0.3 ? `Mensualité = ${fmtPct(endettement*100)} des revenus — bonne capacité` :
                endettement < 0.35 ? `Mensualité = ${fmtPct(endettement*100)} des revenus — limite raisonnable` :
                `Mensualité = ${fmtPct(endettement*100)} des revenus — dépasse le seuil bancaire`;
    addLoc(lbl, pts);
  }
  // Rendement locatif
  if (rend_brut > 0) {
    const pts = rend_brut >= 7 ? 22 : rend_brut >= 5 ? 14 : rend_brut >= 4 ? 5 : -10;
    addLoc(`Rendement brut ${fmtPct(rend_brut)} — ${rend_brut >= 6 ? "excellent" : rend_brut >= 5 ? "bon" : rend_brut >= 4 ? "modéré" : "faible"}`, pts);
  }
  // Incitation à ne pas acheter RP si marché cher
  if (zone) {
    const map: Record<MarketZone, [string, number]> = {
      A_bis: ["Marché résidence très cher → locatif pertinent", 14],
      A:     ["Marché résidence cher → locatif à considérer", 8],
      B1:    ["Marché dynamique — locatif ou RP valable", 2],
      B2:    ["Marché intermédiaire — RP souvent préférable", -2],
      C:     ["Marché détendu — RP plus directement accessible", -5],
    };
    const [lbl, pts] = map[zone];
    addLoc(lbl, pts);
  }
  if (f.horizon) {
    const map: Record<Horizon, [string, number]> = {
      moins_3_ans: ["Horizon court — locatif risqué", -8],
      "3_5_ans": ["Horizon 3-5 ans — suffisant pour locatif", 2],
      "5_10_ans": ["Horizon 5-10 ans — locatif pertinent", 12],
      plus_10_ans: ["Horizon > 10 ans — locatif très pertinent", 18],
    };
    const [lbl, pts] = map[f.horizon as Horizon];
    addLoc(lbl, pts);
  }

  return {
    scores: {
      rp:      { score: clamp(rpS, 0, 100),  details: rpD },
      locatif: { score: clamp(locS, 0, 100), details: locD },
    },
    monthly,
  };
}

type Verdict = "rp" | "locatif" | "attendre";
function getVerdict(scores: Scores, f: Form): Verdict {
  const { rp, locatif } = scores;
  if (rp.score < 40 && locatif.score < 40) return "attendre";
  if (f.objectif === "rp") return rp.score >= 45 ? "rp" : "attendre";
  if (f.objectif === "locatif") return locatif.score >= 45 ? "locatif" : "attendre";
  // les_deux: compare
  if (rp.score > locatif.score + 8) return "rp";
  if (locatif.score > rp.score + 8) return "locatif";
  // close → pick by financial logic
  const { monthly } = computeAll(f);
  if (monthly.cashflow_net > 0 && monthly.cout_net_locatif < monthly.extra_rp) return "locatif";
  return rp.score >= locatif.score ? "rp" : "locatif";
}

/* ─────────── city autocomplete ─────────── */
function CityAutocomplete({
  cityName, postalCode, onSelect, onClear, label = "Ville ou commune visée",
}: {
  cityName: string; postalCode: string;
  onSelect: (opt: CityOption) => void; onClear: () => void; label?: string;
}) {
  const [query, setQuery] = useState(cityName);
  const [suggestions, setSuggestions] = useState<CityOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const isSelected = !!postalCode;
  const zoneMeta = isSelected ? ZONE_META[getZone(postalCode)] : null;

  useEffect(() => { if (!cityName) { setQuery(""); setSuggestions([]); setOpen(false); } }, [cityName]);

  useEffect(() => {
    if (isSelected) return;
    const q = query.trim();
    if (q.length < 2) { setSuggestions([]); setOpen(false); setErrMsg(null); return; }
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const ac = abortRef.current;
    setLoading(true); setErrMsg(null);
    fetch(`/api/cities-search?q=${encodeURIComponent(q)}`, { signal: ac.signal })
      .then((r) => r.json())
      .then((data: CityOption[]) => {
        if (ac.signal.aborted) return;
        setSuggestions(Array.isArray(data) ? data.slice(0, 8) : []);
        setOpen(true);
        if (Array.isArray(data) && data.length === 0 && q.length >= 3) setErrMsg("Aucune commune trouvée.");
      })
      .catch((e) => { if (e?.name !== "AbortError") { setSuggestions([]); setErrMsg("Recherche indisponible."); } })
      .finally(() => { if (!ac.signal.aborted) setLoading(false); });
    return () => { ac.abort(); };
  }, [query, isSelected]);

  const select = (opt: CityOption) => { setQuery(opt.name); setSuggestions([]); setOpen(false); setErrMsg(null); onSelect(opt); };
  const clear  = () => { setQuery(""); setSuggestions([]); setOpen(false); setErrMsg(null); onClear(); };

  return (
    <div>
      <label className="block text-sm font-semibold text-slate-800">
        {label} <span className="text-xs font-normal text-red-500">*</span>
      </label>
      <p className="mt-0.5 text-xs text-slate-500">La tension du marché local est prise en compte dans l'analyse.</p>
      <div className="relative mt-2">
        {!isSelected ? (
          <>
            <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
              {loading
                ? <span className="block h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-[#635bff]" />
                : <MagnifyingGlassIcon className="h-4 w-4 text-slate-400" />}
            </div>
            <input
              type="text" value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => suggestions.length > 0 && setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 150)}
              placeholder="Ex : Lyon, Bordeaux, Rennes…"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-4 text-sm text-slate-900 outline-none focus:border-[#635bff] focus:ring-2 focus:ring-[#635bff]/20"
            />
            {open && suggestions.length > 0 && (
              <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                {suggestions.map((s) => {
                  const zm = ZONE_META[getZone(s.postalCode)];
                  return (
                    <button key={`${s.inseeCode}-${s.postalCode}`} type="button"
                      onMouseDown={(e) => e.preventDefault()} onClick={() => select(s)}
                      className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-slate-50"
                    >
                      <span>
                        <span className="block text-sm font-semibold text-slate-900">{s.name}</span>
                        <span className="text-xs text-slate-400">{s.postalCode}</span>
                      </span>
                      <span className={`shrink-0 flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold ${zm.border} ${zm.text} ${zm.bg}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${zm.dot}`} />{zm.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            {errMsg && <p className="mt-1 text-xs text-amber-600">{errMsg}</p>}
          </>
        ) : (
          <div className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 ${zoneMeta?.border} ${zoneMeta?.bg}`}>
            <div className="flex items-center gap-3">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${zoneMeta?.dot}`} />
              <div>
                <p className="text-sm font-semibold text-slate-900">{cityName} <span className="font-normal text-slate-500">({postalCode})</span></p>
                <p className={`text-xs font-semibold ${zoneMeta?.text}`}>{zoneMeta?.label}</p>
              </div>
            </div>
            <button type="button" onClick={clear} className="shrink-0 rounded-full border border-slate-200 bg-white p-1 text-slate-400 hover:text-slate-700">
              <XMarkIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
      {isSelected && zoneMeta && <p className="mt-2 text-xs leading-relaxed text-slate-500">{zoneMeta.context}</p>}
    </div>
  );
}

/* ─────────── ui primitives ─────────── */
function OptionCard<T extends string>({
  value, selected, onSelect, label, hint, icon: Icon,
}: { value: T; selected: T | ""; onSelect: (v: T) => void; label: string; hint?: string; icon?: React.ComponentType<{ className?: string }> }) {
  const active = selected === value;
  return (
    <button type="button" onClick={() => onSelect(value)}
      className={"w-full rounded-xl border px-4 py-3 text-left transition " +
        (active ? "border-[#635bff] bg-[#635bff]/5 ring-1 ring-[#635bff]/40" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50")}
    >
      <span className="flex items-center gap-3">
        {Icon ? (
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${active ? "bg-[#635bff] text-white" : "bg-slate-100 text-slate-500"}`}>
            <Icon className="h-4 w-4" />
          </span>
        ) : (
          <span className={"flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 " + (active ? "border-[#635bff] bg-[#635bff]" : "border-slate-300 bg-white")}>
            {active && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
          </span>
        )}
        <span>
          <span className="block text-sm font-semibold text-slate-900">{label}</span>
          {hint && <span className="mt-0.5 block text-xs text-slate-500">{hint}</span>}
        </span>
      </span>
    </button>
  );
}

function Field({
  label, hint, suffix, value, onChange, placeholder = "0", required = false,
}: { label: string; hint?: string; suffix?: string; value: string; onChange: (v: string) => void; placeholder?: string; required?: boolean }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-slate-800">
        {label}{required && <span className="ml-1 text-xs font-normal text-red-500">*</span>}
      </label>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
      <div className="relative mt-2">
        <input type="text" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-[#635bff] focus:ring-2 focus:ring-[#635bff]/20" />
        {suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-400">{suffix}</span>}
      </div>
    </div>
  );
}

function StepHeader({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-xl font-semibold text-slate-950">{title}</h2>
      <p className="mt-1 text-sm text-slate-500">{desc}</p>
    </div>
  );
}

function NavButtons({ onBack, onNext, nextLabel = "Continuer", nextDisabled = false }: {
  onBack?: () => void; onNext: () => void; nextLabel?: string; nextDisabled?: boolean;
}) {
  return (
    <div className="mt-8 flex items-center gap-3">
      {onBack && (
        <button type="button" onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          <ArrowLeftIcon className="h-4 w-4" /> Retour
        </button>
      )}
      <button type="button" onClick={onNext} disabled={nextDisabled}
        className="inline-flex items-center gap-1.5 rounded-full bg-slate-950 px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#635bff] disabled:opacity-40">
        {nextLabel} <ArrowRightIcon className="h-4 w-4" />
      </button>
    </div>
  );
}

/* ─────────── score bar ─────────── */
function ScoreBar({ score, label, sublabel, color }: { score: number; label: string; sublabel: string; color: "emerald" | "indigo" }) {
  const clr = color === "emerald"
    ? { bar: "from-emerald-400 to-emerald-600", badge: "bg-emerald-600 text-white", border: "border-emerald-200", bg: "bg-emerald-50/60" }
    : { bar: "from-indigo-400 to-[#635bff]",    badge: "bg-[#635bff] text-white",   border: "border-indigo-200", bg: "bg-indigo-50/60" };
  return (
    <div className={`rounded-2xl border p-4 ${clr.border} ${clr.bg}`}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-sm font-semibold text-slate-900">{label}</p>
        <span className={`rounded-full px-3 py-0.5 text-xs font-bold ${clr.badge}`}>{score}/100</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/70">
        <div className={`h-full rounded-full bg-gradient-to-r ${clr.bar} transition-all`} style={{ width: `${score}%` }} />
      </div>
      <p className="mt-2 text-xs text-slate-500">{sublabel}</p>
    </div>
  );
}

/* ─────────── monthly row ─────────── */
function MonthlyRow({ label, amount, sub, highlight = false, icon: Icon }: {
  label: string; amount: number; sub: string; highlight?: boolean; icon: React.ComponentType<{ className?: string }>;
}) {
  const isPositive = amount <= 0; // cheaper = better
  return (
    <div className={`flex items-center gap-4 rounded-xl border px-4 py-3 ${highlight ? "border-[#635bff]/30 bg-[#635bff]/5" : "border-slate-200 bg-white"}`}>
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${highlight ? "bg-[#635bff] text-white" : "bg-slate-100 text-slate-500"}`}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-900">{label}</p>
        <p className="text-xs text-slate-500">{sub}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className={`text-base font-bold tabular-nums ${isPositive ? "text-emerald-600" : "text-slate-900"}`}>
          {amount > 0 ? `+${fmtEuro(amount)}/mois` : amount === 0 ? "neutre" : `${fmtEuro(amount)}/mois`}
        </p>
        <p className="text-[0.65rem] text-slate-400">{isPositive ? "économie vs louer seul" : "surcoût vs louer seul"}</p>
      </div>
    </div>
  );
}

/* ─────────── main component ─────────── */
export default function AcheterOuLouerWizard() {
  const [step, setStep]           = useState(1);
  const [form, setForm]           = useState<Form>(INIT);
  const [maxReached, setMaxReached] = useState(1);

  const go  = (n: number) => { setStep(n); setMaxReached((p) => Math.max(p, n)); };
  const set = <K extends keyof Form>(key: K, val: Form[K]) => setForm((f) => ({ ...f, [key]: val }));

  const includesLocatif = form.objectif === "locatif" || form.objectif === "les_deux";

  const STEPS = [
    { label: "Votre objectif",  icon: SparklesIcon },
    { label: "Situation pro",   icon: BriefcaseIcon },
    { label: "Finances & projet", icon: BanknotesIcon },
    { label: "Le marché",       icon: MapPinIcon },
    { label: "Résultats",       icon: ScaleIcon },
  ];

  const { scores, monthly } = useMemo(() => computeAll(form), [form]);
  const verdict = useMemo(() => getVerdict(scores, form), [scores, form]);

  const verdictConfig = {
    rp:      { label: "Acheter votre résidence principale", color: "text-emerald-700", border: "border-emerald-200", bg: "bg-emerald-50",  badge: "bg-emerald-600 text-white" },
    locatif: { label: "Investir dans le locatif en restant locataire", color: "text-[#635bff]",   border: "border-indigo-200", bg: "bg-indigo-50",   badge: "bg-[#635bff] text-white" },
    attendre:{ label: "Attendre et renforcer votre épargne", color: "text-amber-700",   border: "border-amber-200",  bg: "bg-amber-50",    badge: "bg-amber-500 text-white"  },
  };
  const vc = verdictConfig[verdict];

  const prRp = useMemo(() => {
    const l = toNum(form.loyer_marche_rp); const p = toNum(form.prix_rp);
    return l > 0 && p > 0 ? p / (l * 12) : null;
  }, [form.loyer_marche_rp, form.prix_rp]);

  const rendBrut = monthly.rendement_brut;

  return (
    <CalculatorWizardShell
      steps={STEPS}
      currentIndex={step - 1}
      onStepClick={(i) => maxReached > i && go(i + 1)}
      canAccessStep={(i) => maxReached > i}
      title="Résidence principale, locatif ou attendre ?"
    >
      {/* ─── Step 1 : Objectif ─────────────────────────── */}
      {step === 1 && (
        <div>
          <StepHeader title="Quelle est votre priorité ?" desc="Votre objectif oriente toute l'analyse. Il n'y a pas de bonne ou mauvaise réponse." />
          <div className="grid gap-3">
            <OptionCard<Objectif> value="rp" selected={form.objectif as Objectif} onSelect={(v) => set("objectif", v)}
              icon={HomeModernIcon}
              label="Avoir mon chez-moi"
              hint="Arrêter de payer un loyer à fonds perdu, stabilité, projet de vie"
            />
            <OptionCard<Objectif> value="locatif" selected={form.objectif as Objectif} onSelect={(v) => set("objectif", v)}
              icon={BuildingOffice2Icon}
              label="Construire un patrimoine par le locatif"
              hint="Investir dans un bien à louer, préparer la retraite, cashflow"
            />
            <OptionCard<Objectif> value="les_deux" selected={form.objectif as Objectif} onSelect={(v) => set("objectif", v)}
              icon={ScaleIcon}
              label="Je veux devenir propriétaire — j'hésite entre les deux"
              hint="L'analyse comparera résidence principale vs investissement locatif"
            />
          </div>
          <NavButtons onNext={() => go(2)} nextDisabled={!form.objectif} />
        </div>
      )}

      {/* ─── Step 2 : Situation pro ─────────────────────── */}
      {step === 2 && (
        <div>
          <StepHeader title="Votre situation professionnelle" desc="Le statut et la stabilité de l'emploi conditionnent l'accès au crédit immobilier." />
          <div className="space-y-5">
            <div>
              <p className="mb-2 text-sm font-semibold text-slate-700">Type de contrat</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <OptionCard<Contrat> value="fonctionnaire" selected={form.contrat as Contrat} onSelect={(v) => set("contrat", v)} label="Fonctionnaire"        hint="Titulaire de la fonction publique" />
                <OptionCard<Contrat> value="cdi_senior"    selected={form.contrat as Contrat} onSelect={(v) => set("contrat", v)} label="CDI > 3 ans"          hint="Ancienneté dans le même poste" />
                <OptionCard<Contrat> value="cdi_junior"    selected={form.contrat as Contrat} onSelect={(v) => set("contrat", v)} label="CDI 1-3 ans"          hint="Période de consolidation" />
                <OptionCard<Contrat> value="cdi_new"       selected={form.contrat as Contrat} onSelect={(v) => set("contrat", v)} label="CDI récent (< 1 an)"  hint="Période d'essai passée" />
                <OptionCard<Contrat> value="cdd"           selected={form.contrat as Contrat} onSelect={(v) => set("contrat", v)} label="CDD"                  hint="Contrat à durée déterminée" />
                <OptionCard<Contrat> value="independant"   selected={form.contrat as Contrat} onSelect={(v) => set("contrat", v)} label="Indépendant / Freelance" hint="TNS, auto-entrepreneur, gérant" />
              </div>
            </div>
            {(form.contrat === "cdd" || form.contrat === "independant") && (
              <div>
                <p className="mb-2 text-sm font-semibold text-slate-700">Ancienneté dans l'activité actuelle</p>
                <div className="grid gap-2 sm:grid-cols-3">
                  <OptionCard<Anciennete> value="moins_1_an" selected={form.anciennete as Anciennete} onSelect={(v) => set("anciennete", v)} label="Moins d'1 an" />
                  <OptionCard<Anciennete> value="1_3_ans"    selected={form.anciennete as Anciennete} onSelect={(v) => set("anciennete", v)} label="1 à 3 ans" />
                  <OptionCard<Anciennete> value="plus_3_ans" selected={form.anciennete as Anciennete} onSelect={(v) => set("anciennete", v)} label="Plus de 3 ans" />
                </div>
              </div>
            )}
          </div>
          <NavButtons onBack={() => go(1)} onNext={() => go(3)} nextDisabled={!form.contrat} />
        </div>
      )}

      {/* ─── Step 3 : Finances & projet ─────────────────── */}
      {step === 3 && (
        <div>
          <StepHeader title="Votre profil financier et votre projet" desc="Ces données permettent de calculer les mensualités réelles et comparer les scénarios." />
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Revenus nets mensuels" hint="Foyer total (vous + co-emprunteur éventuel)" suffix="€" value={form.revenus} onChange={(v) => set("revenus", v)} placeholder="4 000" required />
              <Field label="Apport disponible" hint="Épargne mobilisable pour l'achat (€)" suffix="€" value={form.apport} onChange={(v) => set("apport", v)} placeholder="40 000" required />
            </div>
            <Field label="Loyer actuel" hint="Ce que vous payez chaque mois en tant que locataire" suffix="€ / mois" value={form.loyer_actuel} onChange={(v) => set("loyer_actuel", v)} placeholder="1 100" required />
            <div>
              <p className="mb-2 text-sm font-semibold text-slate-700">Horizon de temps dans ce logement / projet</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <OptionCard<Horizon> value="moins_3_ans" selected={form.horizon as Horizon} onSelect={(v) => set("horizon", v)} label="Moins de 3 ans"  hint="Court terme" />
                <OptionCard<Horizon> value="3_5_ans"     selected={form.horizon as Horizon} onSelect={(v) => set("horizon", v)} label="3 à 5 ans"       hint="Moyen terme" />
                <OptionCard<Horizon> value="5_10_ans"    selected={form.horizon as Horizon} onSelect={(v) => set("horizon", v)} label="5 à 10 ans"      hint="Long terme" />
                <OptionCard<Horizon> value="plus_10_ans" selected={form.horizon as Horizon} onSelect={(v) => set("horizon", v)} label="Plus de 10 ans"  hint="Ancrage durable" />
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold text-slate-700">Probabilité de déménager (raisons pro ou perso)</p>
              <div className="grid gap-2 sm:grid-cols-3">
                <OptionCard<Mobilite> value="tres_probable" selected={form.mobilite as Mobilite} onSelect={(v) => set("mobilite", v)} label="Très probable" hint="Mutation, mobilité prévue" />
                <OptionCard<Mobilite> value="possible"      selected={form.mobilite as Mobilite} onSelect={(v) => set("mobilite", v)} label="Possible"      hint="Incertain à 5 ans" />
                <OptionCard<Mobilite> value="peu_probable"  selected={form.mobilite as Mobilite} onSelect={(v) => set("mobilite", v)} label="Peu probable"  hint="Ancré dans la région" />
              </div>
            </div>
          </div>
          <NavButtons onBack={() => go(2)} onNext={() => go(4)} nextDisabled={!form.revenus || !form.apport || !form.loyer_actuel || !form.horizon || !form.mobilite} />
        </div>
      )}

      {/* ─── Step 4 : Marché ────────────────────────────── */}
      {step === 4 && (
        <div>
          <StepHeader
            title="Le marché immobilier"
            desc={includesLocatif
              ? "Renseignez le marché où vous souhaitez vivre et, si différent, celui où vous investiriez."
              : "Le rapport prix/loyer et la tension du marché déterminent le seuil de rentabilité."}
          />
          <div className="space-y-6">
            {/* Marché RP */}
            <div className="space-y-4">
              <p className="text-sm font-semibold text-slate-800">
                {includesLocatif ? "Votre logement actuel / où vous souhaitez habiter" : "Le marché visé"}
              </p>
              <CityAutocomplete
                cityName={form.villeNom} postalCode={form.villePostal}
                onSelect={(opt) => setForm((f) => ({ ...f, villeNom: opt.name, villePostal: opt.postalCode }))}
                onClear={() => setForm((f) => ({ ...f, villeNom: "", villePostal: "" }))}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Prix d'achat RP estimé" hint="Prix FAI pour le type de bien que vous viseriez" suffix="€" value={form.prix_rp} onChange={(v) => set("prix_rp", v)} placeholder="280 000" required />
                <Field label="Loyer de marché équivalent" hint="Ce que vous paieriez pour louer le même bien" suffix="€ / mois" value={form.loyer_marche_rp} onChange={(v) => set("loyer_marche_rp", v)} placeholder="1 200" required />
              </div>
              {prRp !== null && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Ratio prix / loyer annuel (RP)</p>
                  <p className="mt-1 text-xl font-semibold text-slate-950">
                    × {prRp.toFixed(1)}
                    <span className="ml-2 text-sm font-normal text-slate-500">
                      — {prRp < 15 ? "Achat RP très rentable" : prRp < 20 ? "Achat RP rentable" : prRp < 25 ? "Neutre — horizon primordial" : prRp < 30 ? "RP chère — locatif à considérer" : "RP très chère — locatif souvent plus pertinent"}
                    </span>
                  </p>
                </div>
              )}
            </div>

            {/* Marché locatif (si applicable) */}
            {includesLocatif && (
              <div className="space-y-4 rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4">
                <p className="text-sm font-semibold text-slate-800">Le bien que vous achèteriez pour le louer</p>
                <p className="text-xs text-slate-500">Peut être dans la même ville ou ailleurs — indiquez les valeurs du marché ciblé.</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Prix d'acquisition" hint="Prix FAI du bien à acheter pour louer" suffix="€" value={form.prix_locatif} onChange={(v) => set("prix_locatif", v)} placeholder="160 000" />
                  <Field label="Loyer mensuel estimé" hint="Loyer charges comprises attendu" suffix="€ / mois" value={form.loyer_locatif} onChange={(v) => set("loyer_locatif", v)} placeholder="750" />
                </div>
                {rendBrut > 0 && (
                  <div className="rounded-xl border border-indigo-200 bg-white px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-indigo-400">Rendement brut estimé</p>
                    <p className={`mt-1 text-xl font-semibold ${rendBrut >= 6 ? "text-emerald-700" : rendBrut >= 4.5 ? "text-amber-700" : "text-red-700"}`}>
                      {fmtPct(rendBrut)}
                      <span className="ml-2 text-sm font-normal text-slate-500">
                        — {rendBrut >= 7 ? "Excellent" : rendBrut >= 5.5 ? "Bon" : rendBrut >= 4.5 ? "Modéré" : "Faible — à négocier"}
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">Rendement net estimé après charges : ~{fmtPct(rendBrut * 0.65)}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <NavButtons
            onBack={() => go(3)} onNext={() => go(5)}
            nextLabel="Voir le résultat"
            nextDisabled={!form.villePostal || !form.prix_rp || !form.loyer_marche_rp || (includesLocatif && (!form.prix_locatif || !form.loyer_locatif))}
          />
          {(!form.villePostal && (form.prix_rp || form.loyer_marche_rp)) && (
            <p className="mt-2 text-xs text-amber-600">Sélectionnez une commune dans la liste pour affiner l'analyse.</p>
          )}
        </div>
      )}

      {/* ─── Step 5 : Résultats ─────────────────────────── */}
      {step === 5 && (() => {
        const showLocatif = includesLocatif && monthly.mensualite_locatif > 0;
        return (
          <div>
            <StepHeader
              title={form.villeNom ? `Votre analyse — ${form.villeNom}` : "Votre analyse"}
              desc="Comparaison chiffrée des trois scénarios selon votre profil."
            />
            <div className="space-y-4">

              {/* Verdict principal */}
              <div className={`rounded-2xl border p-5 ${vc.border} ${vc.bg}`}>
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-slate-500">Notre recommandation</p>
                <p className={`mt-1 text-xl font-semibold ${vc.color}`}>{vc.label}</p>
                <p className="mt-1 text-sm text-slate-600">
                  {verdict === "rp"
                    ? `Votre profil, votre horizon et le marché de ${form.villeNom || "votre ville"} sont favorables à l'achat de votre résidence principale. La mensualité remplace progressivement votre loyer et constitue votre patrimoine.`
                    : verdict === "locatif"
                    ? `Rester locataire de votre logement actuel et acheter un bien pour le louer est la stratégie la plus efficace dans votre situation. Le cashflow locatif vient partiellement compenser votre loyer, et vous construisez un patrimoine.`
                    : `Les conditions ne sont pas encore optimales pour un achat. Renforcez votre apport et attendez une situation professionnelle plus stable avant de vous engager.`}
                </p>
              </div>

              {/* Comparaison mensuelle */}
              {toNum(form.loyer_actuel) > 0 && monthly.mensualite_rp > 0 && (
                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-slate-400 mb-3">Comparaison mensuelle (vs louer seul)</p>
                  <div className="space-y-2">
                    <MonthlyRow
                      label="Résidence principale"
                      amount={monthly.extra_rp}
                      sub={`Mensualité ${fmtEuro(monthly.mensualite_rp)}/mois — capital + charges vs loyer actuel ${fmtEuro(toNum(form.loyer_actuel))}/mois`}
                      highlight={verdict === "rp"}
                      icon={HomeModernIcon}
                    />
                    {showLocatif && (
                      <MonthlyRow
                        label="Locatif + rester locataire"
                        amount={monthly.cout_net_locatif - toNum(form.loyer_actuel)}
                        sub={`Loyer actuel ${fmtEuro(toNum(form.loyer_actuel))}/mois − cashflow net ${fmtEuro(Math.max(0, monthly.cashflow_net))}/mois`}
                        highlight={verdict === "locatif"}
                        icon={BuildingOffice2Icon}
                      />
                    )}
                    <div className="flex items-center gap-4 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-200 text-slate-500">
                        <ClockIcon className="h-5 w-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-900">Rester locataire</p>
                        <p className="text-xs text-slate-500">Aucun patrimoine immobilier constitué — référence</p>
                      </div>
                      <p className="shrink-0 text-base font-bold text-slate-400 tabular-nums">0 €/mois</p>
                    </div>
                  </div>
                  {showLocatif && monthly.cashflow_net > 0 && (
                    <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
                      <p className="text-xs font-semibold text-emerald-800">
                        Cashflow net locatif estimé : +{fmtEuro(monthly.cashflow_net)}/mois après mensualité, charges, taxe foncière et frais de gestion (~7 %).
                        Votre "loyer réel" tombe à {fmtEuro(Math.max(0, monthly.cout_net_locatif))}/mois.
                      </p>
                    </div>
                  )}
                  {showLocatif && monthly.cashflow_net <= 0 && (
                    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
                      <p className="text-xs font-semibold text-amber-800">
                        Le cashflow locatif est légèrement négatif ({fmtEuro(monthly.cashflow_net)}/mois net).
                        Vous payez plus que votre loyer seul à court terme, mais vous constituez un patrimoine.
                        Un rendement brut &gt; 5,5 % est recommandé pour que l'opération soit immédiatement positive.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Scores détaillés */}
              <div className={`grid gap-3 ${showLocatif ? "sm:grid-cols-2" : ""}`}>
                <div>
                  <ScoreBar
                    score={scores.rp.score}
                    label="Score — Résidence principale"
                    sublabel={scores.rp.score >= 65 ? "Conditions favorables" : scores.rp.score >= 50 ? "Conditions moyennes" : "Conditions défavorables"}
                    color="emerald"
                  />
                  <div className="mt-2 space-y-1.5 px-1">
                    {scores.rp.details.map((d) => (
                      <div key={d.label} className="flex items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {d.pts >= 0
                            ? <CheckCircleIcon className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                            : <ExclamationTriangleIcon className="h-3.5 w-3.5 shrink-0 text-amber-500" />}
                          <span className="truncate text-slate-600">{d.label}</span>
                        </div>
                        <span className={`shrink-0 font-semibold ${d.pts > 0 ? "text-emerald-600" : d.pts < 0 ? "text-red-500" : "text-slate-400"}`}>
                          {d.pts > 0 ? `+${d.pts}` : d.pts === 0 ? "±0" : d.pts}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {showLocatif && (
                  <div>
                    <ScoreBar
                      score={scores.locatif.score}
                      label="Score — Investissement locatif"
                      sublabel={scores.locatif.score >= 65 ? "Profil adapté à l'investissement" : scores.locatif.score >= 50 ? "Faisable avec vigilance" : "Conditions difficiles"}
                      color="indigo"
                    />
                    <div className="mt-2 space-y-1.5 px-1">
                      {scores.locatif.details.map((d) => (
                        <div key={d.label} className="flex items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {d.pts >= 0
                              ? <CheckCircleIcon className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                              : <ExclamationTriangleIcon className="h-3.5 w-3.5 shrink-0 text-amber-500" />}
                            <span className="truncate text-slate-600">{d.label}</span>
                          </div>
                          <span className={`shrink-0 font-semibold ${d.pts > 0 ? "text-emerald-600" : d.pts < 0 ? "text-red-500" : "text-slate-400"}`}>
                            {d.pts > 0 ? `+${d.pts}` : d.pts === 0 ? "±0" : d.pts}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* CTA */}
              <div className="grid gap-3 sm:grid-cols-2">
                <Link href="/capacite" className="inline-flex min-h-11 items-center justify-center rounded-full bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#635bff] transition">
                  Simuler ma capacité d'emprunt →
                </Link>
                {verdict === "locatif" && (
                  <Link href="/investissement" className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#635bff]/30 bg-[#635bff]/5 px-5 py-2.5 text-sm font-semibold text-[#635bff] hover:bg-[#635bff]/10 transition">
                    Calculer la rentabilité →
                  </Link>
                )}
                {verdict !== "locatif" && (
                  <button type="button" onClick={() => { setForm(INIT); go(1); }}
                    className="inline-flex min-h-11 items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition">
                    Refaire la simulation
                  </button>
                )}
              </div>

              <NavButtons
                onBack={() => go(4)}
                onNext={() => { setForm(INIT); go(1); }}
                nextLabel="Recommencer"
              />
            </div>
          </div>
        );
      })()}
    </CalculatorWizardShell>
  );
}
