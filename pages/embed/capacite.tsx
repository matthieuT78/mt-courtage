// pages/embed/capacite.tsx
//
// Version embarquable (iframe) du simulateur de capacité d'emprunt, pour
// intégration sur un site tiers (agence immobilière) — voir /widget pour
// la page vitrine et le code d'intégration. Pas de navigation lokt.fr,
// noindex (le contenu canonique est /capacite, celui-ci n'existe que pour
// être chargé dans une iframe).
//
// 3 tailles via ?size=small|medium|large (défaut large) : small/medium
// sont des composants dédiés et compacts, large réutilise CapaciteWizard
// tel quel. Les trois partagent le même moteur de calcul
// (lib/calculators/capaciteEngine.ts).
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import CapaciteWizard from "../../components/CapaciteWizard";
import CapaciteWidgetMedium from "../../components/calculators/CapaciteWidgetMedium";
import CapaciteWidgetSmall from "../../components/calculators/CapaciteWidgetSmall";
import { useWidgetAutoResize } from "../../components/calculators/useWidgetAutoResize";

export default function EmbedCapacitePage() {
  useWidgetAutoResize();
  const router = useRouter();
  const size = typeof router.query.size === "string" ? router.query.size : "large";

  return (
    <div className="bg-white px-3 py-4 sm:px-5 sm:py-6">
      <Head>
        <title>Simulateur de capacité d'emprunt — lokt.fr</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      {size === "small" ? (
        <CapaciteWidgetSmall />
      ) : size === "medium" ? (
        <CapaciteWidgetMedium />
      ) : (
        <>
          <div className="mx-auto max-w-3xl">
            <CapaciteWizard showSaveButton={false} />
          </div>
          <p className="mx-auto mt-5 max-w-3xl text-center text-xs text-slate-400">
            Simulateur propulsé par{" "}
            <Link href="https://lokt.fr" target="_blank" rel="noopener" className="font-semibold text-slate-500 hover:text-slate-700">
              lokt.fr
            </Link>{" "}
            — gestion locative et simulateurs immobiliers.
          </p>
        </>
      )}
    </div>
  );
}
