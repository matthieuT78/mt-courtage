// components/investissement/ListingAnalysisSection.tsx
import React from "react";

type ResumeRendement = {
  cashflowMensuel: number;
  resultatNetAnnuel: number;
  rendementNetAvantCredit: number;
};

type GraphData = {
  loyersAnnuels: number;
  chargesTotales: number;
  annuiteCredit: number;
  resultatNetAnnuel: number;
  coutTotal: number;
  mensualiteCredit: number;
  rendementBrut: number;
  rendementNetAvantCredit: number;
  dureeCredLoc: number;
};

type Props = {
  hasSimulation: boolean;
  canShowAnalysis: boolean;
  listingUrl: string;
  selectedCityLabel: string;
  surfaceM2: number;
  prixBien: number;
  graphData: GraphData | null;
  resumeRendement: ResumeRendement | null;
  opportunityScore: number | null;
  opportunityComment: string;
  opportunityImprovements: string[];
  marketPriceM2: number | null;
  marketRentM2: number | null;
  marketSource: string | null;
};

function formatEuro(val: number) {
  if (Number.isNaN(val)) return "-";
  return val.toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}

function formatPct(val: number) {
  if (Number.isNaN(val)) return "-";
  return (
    val.toLocaleString("fr-FR", {
      maximumFractionDigits: 2,
    }) + " %"
  );
}

export default function ListingAnalysisSection({
  hasSimulation,
  canShowAnalysis,
  listingUrl,
  selectedCityLabel,
  surfaceM2,
  prixBien,
  graphData,
  resumeRendement,
  opportunityScore,
  opportunityComment,
  opportunityImprovements,
  marketPriceM2,
  marketRentM2,
  marketSource,
}: Props) {
  // Si pas de simulation → rien
  if (!hasSimulation) return null;

  // Si pas ville + surface → message d’info
  if (!canShowAnalysis) {
    return (
      <p className="mt-2 text-[0.7rem] text-slate-500">
        Pour afficher l’analyse détaillée du bien, merci de renseigner :
        <br />• la localité du bien
        <br />• la surface en m²
      </p>
    );
  }

  // À partir d’ici, on affiche vraiment le bloc d’analyse
  return (
    <div className="mt-5 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-4 space-y-3">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <p className="text-[0.7rem] uppercase tracking-[0.18em] text-indigo-700">
            Analyse de l&apos;annonce
          </p>
          <h3 className="text-sm sm:text-base font-semibold text-slate-900">
            Plan de financement & rentabilité du bien analysé
          </h3>
          {listingUrl && (
            <a
              href={listingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center text-[0.75rem] text-indigo-700 underline break-all"
            >
              Voir l&apos;annonce associée
            </a>
          )}
          {selectedCityLabel && (
            <p className="mt-1 text-[0.75rem] text-slate-700">
              Localité :{" "}
              <span className="font-medium">{selectedCityLabel}</span>
              {surfaceM2 > 0 && (
                <>
                  {" "}
                  – Surface :{" "}
                  <span className="font-medium">
                    {surfaceM2.toLocaleString("fr-FR", {
                      maximumFractionDigits: 0,
                    })}{" "}
                    m²
                  </span>
                </>
              )}
            </p>
          )}
        </div>
        {opportunityScore !== null && (
          <div className="shrink-0 text-right">
            <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
              Score de rentabilité
            </p>
            <p className="text-xl font-semibold text-slate-900">
              {opportunityScore} / 10
            </p>
            <p className="text-[0.7rem] text-slate-600">
              {opportunityComment}
            </p>
          </div>
        )}
      </div>

      {/* Comparaison marché : prix / m² & loyer / m² */}
      {surfaceM2 > 0 && graphData && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2 text-[0.75rem] text-slate-800">
          <div className="rounded-lg border border-slate-200 bg-white/60 px-3 py-2">
            <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
              Prix au m² (annonce vs marché)
            </p>
            <p className="mt-1">
              Prix au m² de l&apos;annonce :{" "}
              <span className="font-semibold">
                {formatEuro(prixBien / surfaceM2)}
              </span>
            </p>
            {marketPriceM2 ? (
              <p className="mt-1">
                Prix au m² estimé marché :{" "}
                <span className="font-semibold">
                  {formatEuro(marketPriceM2)}
                </span>
              </p>
            ) : (
              <p className="mt-1 text-[0.7rem] text-slate-500">
                Données marché non disponibles pour cette localité (vérifiez
                votre API interne).
              </p>
            )}
          </div>

          <div className="rounded-lg border border-slate-200 bg-white/60 px-3 py-2">
            <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
              Loyer mensuel au m² (annonce vs marché)
            </p>
            <p className="mt-1">
              Loyer au m² envisagé :{" "}
              <span className="font-semibold">
                {graphData.loyersAnnuels > 0 && surfaceM2 > 0
                  ? formatEuro((graphData.loyersAnnuels / 12) / surfaceM2)
                  : "-"}
                {" /m²"}
              </span>
            </p>
            {marketRentM2 ? (
              <p className="mt-1">
                Loyer mensuel au m² estimé marché :{" "}
                <span className="font-semibold">
                  {formatEuro(marketRentM2)}
                  {" /m²"}
                </span>
              </p>
            ) : (
              <p className="mt-1 text-[0.7rem] text-slate-500">
                Loyer médian non disponible pour cette localité (via votre API
                interne).
              </p>
            )}
          </div>
        </div>
      )}

      {marketSource && (
        <p className="mt-1 text-[0.65rem] text-slate-500">
          Sources indicatives : {marketSource}.
        </p>
      )}

      {graphData && resumeRendement && (
        <div className="grid gap-3 sm:grid-cols-3 text-[0.75rem] text-slate-800 mt-3">
          <div>
            <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
              Coût global (tout compris)
            </p>
            <p className="mt-1 font-semibold">
              {formatEuro(graphData.coutTotal)}
            </p>
          </div>
          <div>
            <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
              Cash-flow mensuel estimé
            </p>
            <p
              className={
                "mt-1 font-semibold " +
                (resumeRendement.cashflowMensuel >= 0
                  ? "text-emerald-700"
                  : "text-red-600")
              }
            >
              {formatEuro(resumeRendement.cashflowMensuel)}
            </p>
          </div>
          <div>
            <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
              Rendement net avant crédit
            </p>
            <p className="mt-1 font-semibold">
              {formatPct(resumeRendement.rendementNetAvantCredit)}
            </p>
          </div>
        </div>
      )}

      {opportunityImprovements.length > 0 && (
        <div className="mt-3">
          <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-600 mb-1">
            Axes d&apos;amélioration possibles
          </p>
          <ul className="list-disc pl-5 space-y-1 text-[0.75rem] text-slate-700">
            {opportunityImprovements.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
