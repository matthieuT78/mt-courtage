// pages/embed/multi.tsx
//
// Widget combiné : plusieurs simulateurs dans UN seul embed, sous forme
// d'onglets — pour une agence qui veut proposer 2 ou 3 simulateurs sans
// coller 2-3 blocs iframe séparés sur sa page (bien moins propre à
// intégrer). Voir /widget pour la page vitrine et le code d'intégration.
//
// ?sims=capacite,pret-relais,investissement (ordre = ordre des onglets,
// 2 ou 3 valeurs parmi ces 3 ids). Les paramètres ?size=, ?theme=/
// ?accent=, ?agency_token=/?agency_name= s'appliquent à l'ensemble du
// widget exactement comme sur les pages mono-simulateur — couleur et
// transmission de leads ne concernent que l'onglet capacité d'emprunt
// (seul simulateur qui les supporte, cf. /widget).
import type { CSSProperties } from "react";
import { useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import CapaciteWizard from "../../components/CapaciteWizard";
import PretRelaisWizard from "../../components/PretRelaisWizard";
import InvestissementWizard from "../../components/InvestissementWizard";
import { useWidgetAutoResize } from "../../components/calculators/useWidgetAutoResize";

const HEX_RE = /^#?[0-9a-fA-F]{6}$/;

type SimId = "capacite" | "pret-relais" | "investissement";
const SIM_LABELS: Record<SimId, string> = {
  capacite: "Capacité d'emprunt",
  "pret-relais": "Prêt relais",
  investissement: "Rentabilité locative",
};
const VALID_SIM_IDS: SimId[] = ["capacite", "pret-relais", "investissement"];

function accentStyle(accentParam: unknown, themeParam: unknown): CSSProperties {
  if (themeParam === "neutral") {
    return {
      ["--lokt-accent-1" as string]: "#475569",
      ["--lokt-accent-2" as string]: "#334155",
      ["--lokt-accent-3" as string]: "#1e293b",
      ["--lokt-accent-4" as string]: "#0f172a",
    } as CSSProperties;
  }
  const raw = typeof accentParam === "string" ? accentParam : "";
  if (!HEX_RE.test(raw)) return {};
  const hex = raw.startsWith("#") ? raw : `#${raw}`;
  return {
    ["--lokt-accent-1" as string]: hex,
    ["--lokt-accent-2" as string]: hex,
    ["--lokt-accent-3" as string]: hex,
    ["--lokt-accent-4" as string]: hex,
  } as CSSProperties;
}

function agencyLeadFromQuery(query: Record<string, any>) {
  const token = typeof query.agency_token === "string" ? query.agency_token.trim() : "";
  if (!token) return undefined;
  const siteLabel = typeof query.agency_name === "string" ? query.agency_name.trim().slice(0, 80) : undefined;
  return { token, siteLabel };
}

export default function EmbedMultiPage() {
  useWidgetAutoResize();
  const router = useRouter();

  const simsParam = typeof router.query.sims === "string" ? router.query.sims : "";
  const sims = simsParam
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is SimId => VALID_SIM_IDS.includes(s as SimId));
  // Liste vide ou invalide : on ne devine pas une sélection par défaut,
  // on affiche un état d'erreur explicite (cette URL n'est générée que
  // par /widget, qui garantit toujours au moins 2 ids valides).
  const validSims = sims.length >= 2 ? sims : [];

  const [activeTab, setActiveTab] = useState<SimId>(validSims[0] ?? "capacite");
  const active = validSims.includes(activeTab) ? activeTab : validSims[0];

  const style = accentStyle(router.query.accent, router.query.theme);
  const agencyLead = agencyLeadFromQuery(router.query);
  const size = router.query.size;
  const compactSteps = size === "small";
  const compactHeader = size === "small" || size === "medium";

  return (
    <div className="bg-white px-3 py-4 sm:px-5 sm:py-6" style={style}>
      <Head>
        <title>Simulateurs immobiliers — lokt.fr</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      {/* Même recette que les embeds mono-simulateur : réduction de la
          police racine en dessous des largeurs petite/moyenne, et grille
          forcée à 2 colonnes sous 640px. */}
      <style jsx global>{`
        @media (max-width: 420px) {
          html {
            font-size: 13.5px;
          }
        }
        @media (min-width: 421px) and (max-width: 560px) {
          html {
            font-size: 15px;
          }
        }
        @media (max-width: 639px) {
          [class~="sm:grid-cols-2"],
          [class~="sm:grid-cols-3"],
          [class~="sm:grid-cols-4"],
          [class~="sm:grid-cols-5"] {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }
      `}</style>

      {validSims.length === 0 ? (
        <p className="mx-auto max-w-3xl text-center text-sm text-slate-500">
          Code d'intégration incomplet — régénérez-le depuis{" "}
          <Link href="https://lokt.fr/widget" target="_blank" rel="noopener" className="underline">
            lokt.fr/widget
          </Link>
          .
        </p>
      ) : (
        <div className="mx-auto max-w-3xl">
          <div className="mb-4 flex flex-wrap gap-2">
            {validSims.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={
                  "rounded-full border px-3.5 py-1.5 text-xs font-semibold transition " +
                  (active === id
                    ? "border-slate-950 bg-slate-950 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300")
                }
              >
                {SIM_LABELS[id]}
              </button>
            ))}
          </div>

          {active === "capacite" && (
            <CapaciteWizard
              showSaveButton={false}
              agencyLead={agencyLead}
              compactSteps={compactSteps}
              compactHeader={compactHeader}
              resultPopup
            />
          )}
          {active === "pret-relais" && (
            <PretRelaisWizard showSaveButton={false} compactSteps={compactSteps} compactHeader={compactHeader} resultPopup agencyLead={agencyLead} />
          )}
          {active === "investissement" && <InvestissementWizard compactHeader={compactHeader} resultPopup agencyLead={agencyLead} />}
        </div>
      )}

      <p className="mx-auto mt-5 max-w-3xl text-center text-xs text-slate-400">
        Simulateur propulsé par{" "}
        <Link href="https://lokt.fr" target="_blank" rel="noopener" className="font-semibold text-slate-500 hover:text-slate-700">
          lokt.fr
        </Link>{" "}
        — gestion locative et simulateurs immobiliers.
      </p>
    </div>
  );
}
