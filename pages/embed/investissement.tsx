// pages/embed/investissement.tsx
//
// Version embarquable (iframe) du simulateur de rentabilité locative —
// voir /widget pour la page vitrine et le code d'intégration. Même
// principe que /embed/capacite : pas de navigation lokt.fr, noindex.
import Head from "next/head";
import Link from "next/link";
import InvestissementWizard from "../../components/InvestissementWizard";
import { useWidgetAutoResize } from "../../components/calculators/useWidgetAutoResize";

export default function EmbedInvestissementPage() {
  useWidgetAutoResize();
  return (
    <div className="bg-white px-3 py-4 sm:px-5 sm:py-6">
      <Head>
        <title>Simulateur de rentabilité locative — lokt.fr</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <div className="mx-auto max-w-3xl">
        <InvestissementWizard />
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
