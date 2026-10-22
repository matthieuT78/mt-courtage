// pages/embed/capacite.tsx
//
// Version embarquable (iframe) du simulateur de capacité d'emprunt, pour
// intégration sur un site tiers (agence immobilière) — voir /widget pour
// la page vitrine et le code d'intégration. Pas de navigation lokt.fr,
// noindex (le contenu canonique est /capacite, celui-ci n'existe que pour
// être chargé dans une iframe).
import Head from "next/head";
import Link from "next/link";
import CapaciteWizard from "../../components/CapaciteWizard";

export default function EmbedCapacitePage() {
  return (
    <div className="min-h-screen bg-white px-3 py-4 sm:px-5 sm:py-6">
      <Head>
        <title>Simulateur de capacité d'emprunt — lokt.fr</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

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
    </div>
  );
}
