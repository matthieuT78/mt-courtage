// pages/embed/capacite.tsx
//
// Version embarquable (iframe) du simulateur de capacité d'emprunt, pour
// intégration sur un site tiers (agence immobilière) — voir /widget pour
// la page vitrine et le code d'intégration. Pas de navigation lokt.fr,
// noindex (le contenu canonique est /capacite, celui-ci n'existe que pour
// être chargé dans une iframe).
//
// Un seul contenu (le wizard complet, 4 étapes, même questions et même
// analyse que la page publique) — les "tailles" proposées sur /widget ne
// retirent aucune information, elles changent uniquement la largeur
// d'intégration recommandée (voir le code généré sur /widget), ce qui
// fait naturellement basculer la mise en page sur un format compact/
// vertical en dessous de 640px, comme sur mobile.
import Head from "next/head";
import Link from "next/link";
import CapaciteWizard from "../../components/CapaciteWizard";
import { useWidgetAutoResize } from "../../components/calculators/useWidgetAutoResize";

export default function EmbedCapacitePage() {
  useWidgetAutoResize();
  return (
    <div className="bg-white px-3 py-4 sm:px-5 sm:py-6">
      <Head>
        <title>Simulateur de capacité d'emprunt — lokt.fr</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      {/* Les classes Tailwind (texte, marges, paddings) utilisent des rem,
          relatifs à la taille de police racine — la réduire en dessous
          réduit tout proportionnellement (texte ET espacements), plutôt
          que de juste empiler le même contenu en grand dans un espace
          étroit. Paliers calés sur les largeurs recommandées des tailles
          petite (~360px) et moyenne (~520px) proposées sur /widget. */}
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
      `}</style>

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
