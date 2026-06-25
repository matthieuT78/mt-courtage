// components/landlord/sections/SectionRevision.tsx
import { useMemo, useState, useEffect } from "react";
import { ClipboardDocumentIcon, CheckIcon, ArrowTrendingUpIcon } from "@heroicons/react/24/outline";
import { IRL_TABLE, LATEST_IRL, dateToIrlQuarter, irlByQuarter } from "../../../lib/irlData";
import type { Lease } from "./SectionBaux";

type Property = { id: string; label: string | null; address_line1?: string | null; postal_code?: string | null; city?: string | null };
type Tenant   = { id: string; full_name: string | null; email: string | null };

type Props = {
  userId: string;
  leases?: Lease[];
  properties?: Property[];
  tenants?: Tenant[];
};

function euro(n: number) {
  return n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 2 });
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR");
}

function signedPct(n: number) {
  return (n >= 0 ? "+" : "") + n.toFixed(2) + " %";
}

export function SectionRevision({ leases = [], properties = [], tenants = [] }: Props) {
  const [selectedLeaseId, setSelectedLeaseId] = useState<string>("");
  const [refQuarter, setRefQuarter]           = useState<string>("");
  const [newQuarter, setNewQuarter]           = useState<string>(LATEST_IRL.quarter);
  const [copied, setCopied]                   = useState(false);
  const [showLetter, setShowLetter]           = useState(false);

  const activeLeases = useMemo(
    () =>
      leases.filter(
        (l) =>
          !["archived", "ended"].includes(String(l.status || "")) &&
          Number(l.rent_amount || 0) > 0 &&
          l.start_date
      ),
    [leases]
  );

  const lease    = useMemo(() => activeLeases.find((l) => l.id === selectedLeaseId) || null, [activeLeases, selectedLeaseId]);
  const property = useMemo(() => (lease ? properties.find((p) => p.id === lease.property_id) || null : null), [lease, properties]);
  const tenant   = useMemo(() => (lease ? tenants.find((t) => t.id === lease.tenant_id) || null : null), [lease, tenants]);

  useEffect(() => {
    if (!lease) { setRefQuarter(""); return; }
    const irlField = (lease as any).irl_reference as string | null;
    if (irlField && irlByQuarter(irlField)) {
      setRefQuarter(irlField);
    } else if (lease.start_date) {
      setRefQuarter(dateToIrlQuarter(lease.start_date));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLeaseId]);

  const refEntry    = useMemo(() => irlByQuarter(refQuarter), [refQuarter]);
  const newEntry    = useMemo(() => irlByQuarter(newQuarter), [newQuarter]);
  const currentRent = Number(lease?.rent_amount || 0);

  const result = useMemo(() => {
    if (!refEntry || !newEntry || currentRent <= 0 || refEntry.value <= 0) return null;
    const newRent = Math.round((currentRent * (newEntry.value / refEntry.value)) * 100) / 100;
    const delta   = newRent - currentRent;
    const change  = ((newEntry.value - refEntry.value) / refEntry.value) * 100;
    return { newRent, delta, change };
  }, [refEntry, newEntry, currentRent]);

  const letter = useMemo(() => {
    if (!lease || !result || !refEntry || !newEntry) return "";
    const tenantName = tenant?.full_name || (lease as any).tenant_name || "le locataire";
    const propAddr   = [
      property?.address_line1,
      [property?.postal_code, property?.city].filter(Boolean).join(" "),
    ].filter(Boolean).join(", ") || property?.label || "le logement";
    const today      = new Date().toLocaleDateString("fr-FR");
    const leaseStart = fmtDate(lease.start_date);

    return `Objet : Révision annuelle du loyer – Article 17-1 de la loi n° 89-462 du 6 juillet 1989

Le ${today}

Madame/Monsieur ${tenantName},

Conformément à la clause de révision annuelle stipulée dans le contrat de location signé le ${leaseStart}, relatif au logement situé ${propAddr}, j'ai l'honneur de vous informer de la révision du montant de votre loyer mensuel hors charges.

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

  return (
    <div className="space-y-5">

      {/* En-tête */}
      <div>
        <p className="text-[0.7rem] font-semibold uppercase tracking-widest text-slate-400">Révision</p>
        <h2 className="text-xl font-bold tracking-tight text-slate-950">Révision annuelle du loyer (IRL)</h2>
        <p className="mt-1 text-sm text-slate-500">
          Calcul officiel selon l'Indice de Référence des Loyers publié par l'INSEE · Art. 17-1 loi du 6 juillet 1989
        </p>
      </div>

      {/* Bandeau IRL en vigueur */}
      <div className="flex items-center gap-3 rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-100">
          <ArrowTrendingUpIcon className="h-4 w-4 text-indigo-600" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-indigo-900">
            Dernier IRL publié : {LATEST_IRL.value} ({LATEST_IRL.label})
          </p>
          <p className="text-[0.65rem] text-indigo-600">
            Source INSEE · mis à jour chaque trimestre (environ 30 jours après la fin du trimestre)
          </p>
        </div>
      </div>

      {/* 1 – Sélection bail */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-3.5">
          <p className="text-sm font-semibold text-slate-900">1 · Bail à réviser</p>
        </div>
        <div className="px-5 py-4">
          {activeLeases.length === 0 ? (
            <p className="text-sm text-slate-500">Aucun bail actif avec un loyer renseigné.</p>
          ) : (
            <select
              value={selectedLeaseId}
              onChange={(e) => setSelectedLeaseId(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            >
              <option value="">-- Sélectionner un bail --</option>
              {activeLeases.map((l) => {
                const prop  = properties.find((p) => p.id === l.property_id);
                const ten   = tenants.find((t) => t.id === l.tenant_id);
                const label = [ten?.full_name || (l as any).tenant_name, prop?.label || prop?.city].filter(Boolean).join(" · ");
                return (
                  <option key={l.id} value={l.id}>
                    {label || l.id.slice(0, 8)} — {euro(Number(l.rent_amount || 0))}/mois
                  </option>
                );
              })}
            </select>
          )}

          {lease && (
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                { label: "Locataire",      value: tenant?.full_name || (lease as any).tenant_name || "—" },
                { label: "Loyer HC actuel", value: euro(currentRent) },
                { label: "Début du bail",  value: fmtDate(lease.start_date) },
              ].map((item) => (
                <div key={item.label} className="rounded-xl bg-slate-50 px-3 py-2.5">
                  <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-slate-400">{item.label}</p>
                  <p className="mt-0.5 text-xs font-semibold text-slate-800">{item.value}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 2 – Indices */}
      {lease && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-3.5">
            <p className="text-sm font-semibold text-slate-900">2 · Indices IRL</p>
          </div>
          <div className="grid gap-4 px-5 py-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                Trimestre de référence
                <span className="ml-1 font-normal text-slate-400">(mentionné dans le bail)</span>
              </label>
              <select
                value={refQuarter}
                onChange={(e) => setRefQuarter(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              >
                <option value="">-- Trimestre --</option>
                {IRL_TABLE.map((e) => (
                  <option key={e.quarter} value={e.quarter}>{e.label} — {e.value}</option>
                ))}
              </select>
              {refEntry && (
                <p className="text-[0.68rem] text-slate-500">
                  IRL {refEntry.label} : <span className="font-semibold text-slate-700">{refEntry.value}</span>
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                Trimestre de révision
                <span className="ml-1 font-normal text-slate-400">(dernier publié recommandé)</span>
              </label>
              <select
                value={newQuarter}
                onChange={(e) => setNewQuarter(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              >
                {IRL_TABLE.map((e) => (
                  <option key={e.quarter} value={e.quarter}>{e.label} — {e.value}</option>
                ))}
              </select>
              {newEntry && (
                <p className="text-[0.68rem] text-slate-500">
                  IRL {newEntry.label} : <span className="font-semibold text-slate-700">{newEntry.value}</span>
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 3 – Résultat */}
      {lease && result && refEntry && newEntry && (
        <>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-3.5">
              <p className="text-sm font-semibold text-slate-900">3 · Résultat</p>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-center">
                  <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-slate-400">Loyer actuel HC</p>
                  <p className="mt-1 text-xl font-bold text-slate-700">{euro(currentRent)}</p>
                  <p className="text-[0.65rem] text-slate-400">/ mois</p>
                </div>
                <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-center">
                  <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-indigo-500">Nouveau loyer HC</p>
                  <p className="mt-1 text-xl font-bold text-indigo-700">{euro(result.newRent)}</p>
                  <p className="text-[0.65rem] text-indigo-400">/ mois</p>
                </div>
                <div className={`rounded-xl border px-4 py-3 text-center ${result.delta >= 0 ? "border-emerald-100 bg-emerald-50" : "border-red-100 bg-red-50"}`}>
                  <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-slate-400">Variation</p>
                  <p className={`mt-1 text-xl font-bold ${result.delta >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                    {signedPct(result.change)}
                  </p>
                  <p className="text-[0.65rem] text-slate-500">{euro(result.delta)}/mois · {euro(result.delta * 12)}/an</p>
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 px-4 py-2.5 text-[0.72rem] text-slate-500">
                <span className="font-semibold text-slate-700">Formule légale :</span>{" "}
                {euro(currentRent)} × ({newEntry.value} ÷ {refEntry.value}) = <span className="font-semibold text-slate-800">{euro(result.newRent)}</span>
              </div>
            </div>
          </div>

          {/* 4 – Courrier */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
              <p className="text-sm font-semibold text-slate-900">4 · Courrier de révision officiel</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowLetter((v) => !v)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  {showLetter ? "Masquer" : "Afficher"}
                </button>
                <button
                  type="button"
                  onClick={copyLetter}
                  className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-700"
                >
                  {copied ? (
                    <><CheckIcon className="h-3.5 w-3.5" />Copié !</>
                  ) : (
                    <><ClipboardDocumentIcon className="h-3.5 w-3.5" />Copier</>
                  )}
                </button>
              </div>
            </div>
            {showLetter ? (
              <div className="px-5 py-4">
                <pre className="whitespace-pre-wrap rounded-xl border border-slate-100 bg-slate-50 p-4 font-mono text-[0.72rem] leading-6 text-slate-700">
                  {letter}
                </pre>
              </div>
            ) : (
              <div className="px-5 py-3 text-xs text-slate-400">
                Courrier prêt · réf. Art. 17-1 loi du 6 juillet 1989 · cliquez Afficher pour le relire, Copier pour l'envoyer.
              </div>
            )}
          </div>

          {/* Rappels légaux */}
          <div className="rounded-2xl border border-amber-100 bg-amber-50 px-5 py-4">
            <p className="mb-2.5 text-xs font-semibold text-amber-900">Points de vigilance légaux</p>
            <ul className="space-y-1 text-xs text-amber-800 leading-5">
              <li>· Révision possible une fois par an, à la date anniversaire du bail.</li>
              <li>· Doit être notifiée par écrit au locataire avant la date d'effet.</li>
              <li>· Effet rétroactif limité aux 12 mois précédant la notification.</li>
              <li>· En zone d'encadrement des loyers (Paris, Lyon…), vérifiez le plafond applicable.</li>
              <li>· Le trimestre de référence est celui mentionné dans le contrat de bail à la signature.</li>
            </ul>
          </div>
        </>
      )}

      {!lease && activeLeases.length > 0 && (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center text-sm text-slate-400">
          Sélectionnez un bail ci-dessus pour calculer la révision.
        </div>
      )}
    </div>
  );
}
