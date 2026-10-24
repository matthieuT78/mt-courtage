// pages/embed/pret-relais.tsx
//
// Version embarquable (iframe) du simulateur de prêt relais — voir /widget
// pour la page vitrine et le code d'intégration. Même principe que
// /embed/capacite : pas de navigation lokt.fr, noindex.
//
// ?size=small répartit les mêmes questions sur une étape de plus (Profil
// et Revenus séparés, cf. compactSteps dans PretRelaisWizard.tsx) pour
// rester léger dans un format étroit ; medium et large gardent le
// découpage à 4 étapes. ?size=small et ?size=medium affichent aussi un
// bandeau de progression fin (cf. compactHeader dans
// CalculatorWizardShell.tsx).
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import PretRelaisWizard from "../../components/PretRelaisWizard";
import { useWidgetAutoResize } from "../../components/calculators/useWidgetAutoResize";

export default function EmbedPretRelaisPage() {
  useWidgetAutoResize();
  const router = useRouter();
  const size = router.query.size;
  const compactSteps = size === "small";
  const compactHeader = size === "small" || size === "medium";

  return (
    <div className="bg-white px-3 py-4 sm:px-5 sm:py-6">
      <Head>
        <title>Simulateur de prêt relais — lokt.fr</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      {/* Même recette que /embed/capacite.tsx : réduction de la police
          racine (texte ET espacements, rem-relatifs) en dessous des
          largeurs recommandées pour petit/moyen, et grille forcée à 2
          colonnes au lieu d'1 sous 640px — la vraie page /pret-relais
          n'est pas concernée, ces règles ne vivent que sur cette page. */}
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

      <div className="mx-auto max-w-3xl">
        <PretRelaisWizard showSaveButton={false} compactSteps={compactSteps} compactHeader={compactHeader} resultPopup />
      </div>

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
