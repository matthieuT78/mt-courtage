// pages/embed/investissement.tsx
//
// Version embarquable (iframe) du simulateur de rentabilité locative —
// voir /widget pour la page vitrine et le code d'intégration. Même
// principe que /embed/capacite : pas de navigation lokt.fr, noindex.
//
// ?size=small|medium affiche un bandeau de progression fin (sans titre ni
// icône décorative, cf. compactHeader dans CalculatorWizardShell) pour
// laisser plus de place au formulaire dans un format étroit — le contenu
// (4 étapes, mêmes champs) ne change pas, contrairement à /embed/capacite
// où "petit" répartit aussi les questions sur une étape de plus : ici
// aucune étape n'est assez dense pour justifier ce découpage (cf. audit
// du 2026-10-23).
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import InvestissementWizard from "../../components/InvestissementWizard";
import { useWidgetAutoResize } from "../../components/calculators/useWidgetAutoResize";

export default function EmbedInvestissementPage() {
  useWidgetAutoResize();
  const router = useRouter();
  const size = router.query.size;
  const compactHeader = size === "small" || size === "medium";

  return (
    <div className="bg-white px-3 py-4 sm:px-5 sm:py-6">
      <Head>
        <title>Simulateur de rentabilité locative — lokt.fr</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      {/* Même recette que /embed/capacite.tsx : réduction de la police
          racine (texte ET espacements, rem-relatifs) en dessous des
          largeurs recommandées pour petit/moyen, et grille forcée à 2
          colonnes au lieu d'1 sous 640px — la vraie page /investissement
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
        <InvestissementWizard compactHeader={compactHeader} resultPopup />
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
