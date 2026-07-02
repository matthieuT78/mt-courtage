// components/landlord/sections/SectionRevision.tsx
// Bloc IRL intégré dans la fiche bail de SectionBaux.
import { useEffect, useMemo, useState } from "react";
import { ClipboardDocumentIcon, CheckIcon, ChevronDownIcon, ArrowTrendingUpIcon } from "@heroicons/react/24/outline";
import { IRL_TABLE, LATEST_IRL, dateToIrlQuarter, irlByQuarter } from "../../../lib/irlData";
import type { Lease } from "./SectionBaux";

type PropertyLike = { label?: string | null; address_line1?: string | null; postal_code?: string | null; city?: string | null };
type TenantLike   = { full_name?: string | null };

type Props = {
  lease: Lease;
  property: PropertyLike | null;
  tenant: TenantLike | null;
  openTrigger?: number;
};

function euro(n: number) {
  return n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 2 });
}
function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR");
}
function signedPct(n: number) {
  return (n >= 0 ? "+" : "") + n.toFixed(2) + " %";
}

export function IrlRevisionPanel({ lease, property, tenant, openTrigger }: Props) {
  const currentRent = Number(lease.rent_amount || 0);

  // Trimestre de référence : champ irl_reference du bail, ou trimestre de start_date,
  // ou trimestre le plus proche disponible dans la table si pas de correspondance exacte
  const defaultRef = useMemo(() => {
    const irlField = (lease as any).irl_reference as string | null;
    if (irlField && irlByQuarter(irlField)) return irlField;
    if (!lease.start_date) return "";
    const exact = dateToIrlQuarter(lease.start_date);
    if (irlByQuarter(exact)) return exact;
    // Fallback : trimestre disponible le plus proche <= start_date
    const [sy, sq] = exact.split("-T").map(Number);
    const startNum = sy * 4 + sq;
    for (const entry of IRL_TABLE) {
      const [ey, eq] = entry.quarter.split("-T").map(Number);
      if (ey * 4 + eq <= startNum) return entry.quarter;
    }
    return IRL_TABLE[IRL_TABLE.length - 1].quarter;
  }, [lease]);

  const [open, setOpen]           = useState(false);

  useEffect(() => {
    if (openTrigger != null) setOpen(true);
  }, [openTrigger]);
  const [refQuarter, setRefQuarter] = useState<string>(defaultRef);
  const [newQuarter, setNewQuarter] = useState<string>(LATEST_IRL.quarter);
  const [showLetter, setShowLetter] = useState(false);
  const [copied, setCopied]         = useState(false);

  const refEntry = useMemo(() => irlByQuarter(refQuarter), [refQuarter]);
  const newEntry = useMemo(() => irlByQuarter(newQuarter), [newQuarter]);

  const result = useMemo(() => {
    if (!refEntry || !newEntry || currentRent <= 0 || refEntry.value <= 0) return null;
    const newRent = Math.round((currentRent * (newEntry.value / refEntry.value)) * 100) / 100;
    const delta   = newRent - currentRent;
    const change  = ((newEntry.value - refEntry.value) / refEntry.value) * 100;
    return { newRent, delta, change };
  }, [refEntry, newEntry, currentRent]);

  const letter = useMemo(() => {
    if (!result || !refEntry || !newEntry) return "";
    const tenantName = tenant?.full_name || (lease as any).tenant_name || "le locataire";
    const propAddr   = [
      property?.address_line1,
      [property?.postal_code, property?.city].filter(Boolean).join(" "),
    ].filter(Boolean).join(", ") || property?.label || "le logement";
    const today = new Date().toLocaleDateString("fr-FR");

    return `Objet : Révision annuelle du loyer – Article 17-1 de la loi n° 89-462 du 6 juillet 1989

Le ${today}

Madame/Monsieur ${tenantName},

Conformément à la clause de révision annuelle stipulée dans le contrat de location signé le ${fmtDate(lease.start_date)}, relatif au logement situé ${propAddr}, j'ai l'honneur de vous informer de la révision du montant de votre loyer mensuel hors charges.

Cette révision est calculée selon l'Indice de Référence des Loyers (IRL) publié par l'INSEE, conformément à l'article 17-1 de la loi n° 89-462 du 6 juillet 1989 :

  Loyer en vigueur hors charges  : ${euro(currentRent)} / mois
  IRL de référence  (${refEntry.label})    : ${refEntry.value}
  Nouvel IRL applicable (${newEntry.label}) : ${newEntry.value}
  Nouveau loyer hors charges     : ${euro(result.newRent)} / mois
  Variation                      : ${signedPct(result.change)}

Le nouveau loyer mensuel hors charges s'établit à ${euro(result.newRent)}, applicable à compter de la prochaine date anniversaire du bail.

Conformément à la réglementation en vigueur, cette révision ne peut avoir d'effet rétroactif que dans la limite des 12 mois précédant la présente notification.

Je reste à votre disposition pour tout renseignement complémentaire.

Veuillez agréer, Madame/Monsieur, l'expression de mes salutations distinguées.


___________________________
[Votre signature]`;
  }, [lease, result, refEntry, newEntry, currentRent, property, tenant]);

  function copyLetter() {
    navigator.clipboard.writeText(letter).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  if (currentRent <= 0) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      {/* Toggle header */}
      <button
        type="button"
        className="flex w-full items-center justify-between text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          <ArrowTrendingUpIcon className="h-4 w-4 text-indigo-500" />
          <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">Révision IRL</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[0.7rem] text-slate-400">
            {LATEST_IRL.label} · {LATEST_IRL.value}
          </span>
          <ChevronDownIcon className={`h-4 w-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
        </div>
      </button>

      {open && (
        <div className="mt-4 space-y-4">
          {/* Explication */}
          <p className="text-xs leading-5 text-slate-500">
            L&apos;IRL (Indice de Référence des Loyers) permet de réviser le loyer chaque année à la date anniversaire du bail.
            Sélectionnez le trimestre IRL inscrit dans votre contrat, puis le trimestre de révision souhaité.
          </p>

          {/* Indices */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-600">
                IRL de référence
              </label>
              <select
                value={refQuarter}
                onChange={(e) => setRefQuarter(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none"
              >
                <option value="">-- Choisir --</option>
                {IRL_TABLE.map((e) => (
                  <option key={e.quarter} value={e.quarter}>{e.label} — {e.value}</option>
                ))}
              </select>
              <p className="text-[0.65rem] text-slate-400">Trimestre indiqué dans la clause de révision de votre bail</p>
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-600">
                IRL de révision
              </label>
              <select
                value={newQuarter}
                onChange={(e) => setNewQuarter(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none"
              >
                {IRL_TABLE.map((e) => (
                  <option key={e.quarter} value={e.quarter}>{e.label} — {e.value}</option>
                ))}
              </select>
              <p className="text-[0.65rem] text-slate-400">Dernier trimestre publié par l&apos;INSEE</p>
            </div>
          </div>

          {/* Résultat */}
          {result && refEntry && newEntry ? (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
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

              <div className="rounded-xl bg-slate-50 px-3 py-2 text-[0.7rem] text-slate-500">
                {euro(currentRent)} × ({newEntry.value} ÷ {refEntry.value}) = <span className="font-semibold text-slate-700">{euro(result.newRent)}</span>
                <span className="ml-2 text-slate-400">· {euro(result.delta * 12)}/an</span>
              </div>

              {/* Courrier */}
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowLetter((v) => !v)}
                  className="text-xs font-semibold text-indigo-600 underline underline-offset-2 hover:text-indigo-800"
                >
                  {showLetter ? "Masquer le courrier" : "Voir le courrier officiel"}
                </button>
                <button
                  type="button"
                  onClick={copyLetter}
                  className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-700"
                >
                  {copied ? (
                    <><CheckIcon className="h-3.5 w-3.5" />Copié !</>
                  ) : (
                    <><ClipboardDocumentIcon className="h-3.5 w-3.5" />Copier le courrier</>
                  )}
                </button>
              </div>

              {showLetter && (
                <pre className="whitespace-pre-wrap rounded-xl border border-slate-100 bg-slate-50 p-3 font-mono text-[0.68rem] leading-5 text-slate-600">
                  {letter}
                </pre>
              )}

              {/* Rappels légaux */}
              <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2.5 text-[0.7rem] text-amber-800 leading-5">
                <span className="font-semibold">À savoir ·</span> Révision annuelle à la date anniversaire · notification écrite obligatoire · rétroactivité limitée à 12 mois · vérifier l'encadrement en zone tendue.
              </div>
            </>
          ) : (
            <p className="text-xs text-slate-400">Sélectionnez l&apos;IRL de référence (votre bail) pour calculer le nouveau loyer.</p>
          )}
        </div>
      )}
    </div>
  );
}
