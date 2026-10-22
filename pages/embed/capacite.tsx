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
//
// Personnalisation de couleur : ?theme=neutral (palette grise, pour un
// site au style sobre) ou ?accent=RRGGBB (une couleur d'accent au choix
// de l'agence). CapaciteWizard lit ces teintes via des variables CSS
// (--lokt-accent-1..4, cf. composants/CapaciteWizard.tsx) avec les
// couleurs de marque lokt.fr comme valeur par défaut — la page publique
// /capacite n'est pas concernée, ces variables ne sont définies qu'ici.
//
// Lead agence : ?agency_email=contact@agence.fr (et optionnellement
// ?agency_name=...) active le mode "lead vers l'agence" dans
// CapaciteWizard — le lead n'est alors JAMAIS écrit dans la base lokt.fr,
// uniquement transmis par email à cette adresse si le visiteur coche le
// consentement contact (cf. agencyLead dans CapaciteWizard.tsx et
// /api/tools/capacite/notify-agency).
import type { CSSProperties } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import CapaciteWizard from "../../components/CapaciteWizard";
import { useWidgetAutoResize } from "../../components/calculators/useWidgetAutoResize";

const HEX_RE = /^#?[0-9a-fA-F]{6}$/;

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
  const raw = typeof query.agency_email === "string" ? query.agency_email.trim() : "";
  if (!raw || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) return undefined;
  const siteLabel = typeof query.agency_name === "string" ? query.agency_name.trim().slice(0, 80) : undefined;
  return { notifyEmail: raw, siteLabel };
}

export default function EmbedCapacitePage() {
  useWidgetAutoResize();
  const router = useRouter();
  const style = accentStyle(router.query.accent, router.query.theme);
  const agencyLead = agencyLeadFromQuery(router.query);

  return (
    <div className="bg-white px-3 py-4 sm:px-5 sm:py-6" style={style}>
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

        /*
         * CapaciteWizard bascule ses grilles de champs sur 1 seule colonne
         * en dessous de 640px (breakpoint sm: de Tailwind) — pensé pour un
         * vrai mobile. Les tailles "petite" et "moyenne" du widget sont
         * toutes les deux sous ce seuil : sans correctif, elles s'empilent
         * quasiment pareil, en beaucoup de lignes, d'où une hauteur bien
         * plus grande que la taille "grande" alors que l'intention est
         * l'inverse (plus compact). On force 2 colonnes au lieu de 1 pour
         * ces largeurs, uniquement sur cette page embarquée — la vraie
         * page /capacite et son rendu mobile normal ne sont pas concernés.
         */
        @media (max-width: 639px) {
          .sm\\:grid-cols-2,
          .sm\\:grid-cols-3,
          .sm\\:grid-cols-4,
          .sm\\:grid-cols-5 {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }
      `}</style>

      <div className="mx-auto max-w-3xl">
        <CapaciteWizard showSaveButton={false} agencyLead={agencyLead} />
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
