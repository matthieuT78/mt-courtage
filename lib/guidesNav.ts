// Métadonnées légères pour le menu "Guides" du header (affiché sur TOUTES les
// pages). Volontairement séparé de lib/guides.ts : ce dernier embarque le
// contenu complet des 17 guides (intro, sections, FAQ...) soit ~210 Ko, qui
// se retrouvait dans le bundle JS de chaque page du site simplement parce que
// AppHeader importait GUIDE_CATEGORIES/getGuidesByCategory depuis ce module.
//
// À maintenir en synchro avec lib/guides.ts à chaque ajout/suppression de
// guide (slug, category, shortTitle uniquement — rien d'autre n'est utilisé
// par le menu).
import type { GuideCategory } from "./guides";

export const GUIDE_CATEGORIES: Array<{ key: GuideCategory; label: string; description: string }> = [
  { key: "preparer", label: "Préparer la mise en location", description: "Sécuriser le logement, le bail et la fiscalité avant l'annonce." },
  { key: "arrivee", label: "Accueillir le locataire", description: "Constituer un dossier propre et réussir la remise des clés." },
  { key: "gestion", label: "Pendant la location", description: "Gérer les loyers, les charges, les travaux et les échéances." },
  { key: "depart", label: "Organiser le départ", description: "Traiter le congé, l'état des lieux et le dépôt de garantie." },
  { key: "fiscal", label: "Fiscalité et déclaration", description: "Choisir son régime, déclarer ses revenus locatifs et éviter les pénalités." },
];

type GuideNavEntry = { slug: string; category: GuideCategory; shortTitle: string };

const GUIDES_NAV: GuideNavEntry[] = [
  { slug: "checklist-mise-en-location", category: "preparer", shortTitle: "Checklist de mise en location" },
  { slug: "dpe-diagnostics-location", category: "preparer", shortTitle: "DPE et diagnostics" },
  { slug: "lmnp-checklist-location-meublee", category: "preparer", shortTitle: "Checklist LMNP" },
  { slug: "choisir-bail-vide-meuble-mobilite", category: "preparer", shortTitle: "Choisir le bon bail" },
  { slug: "choisir-son-locataire", category: "arrivee", shortTitle: "Choisir son locataire" },
  { slug: "arrivee-locataire-remise-cles", category: "arrivee", shortTitle: "Arrivée du locataire" },
  { slug: "travaux-reparations-bailleur-locataire", category: "gestion", shortTitle: "Travaux et réparations" },
  { slug: "depart-locataire-etat-des-lieux-sortie", category: "depart", shortTitle: "Départ du locataire" },
  { slug: "depot-garantie-restitution-retenues", category: "depart", shortTitle: "Dépôt de garantie" },
  { slug: "quittances-revision-irl", category: "gestion", shortTitle: "Quittances et révision IRL" },
  { slug: "charges-regularisation-annuelle", category: "gestion", shortTitle: "Charges et régularisation" },
  { slug: "loyers-impayes-procedure", category: "gestion", shortTitle: "Loyers impayés" },
  { slug: "fixer-son-loyer", category: "preparer", shortTitle: "Fixer le loyer" },
  { slug: "declarer-revenus-locatifs", category: "fiscal", shortTitle: "Déclaration revenus locatifs" },
  { slug: "passer-lmnp-lmp-demarches", category: "fiscal", shortTitle: "Passer en LMP" },
  { slug: "deficit-foncier-calcul-declaration", category: "fiscal", shortTitle: "Déficit foncier" },
  { slug: "checklist-declaration-annuelle-bailleur", category: "fiscal", shortTitle: "Checklist déclaration annuelle" },
];

export function getGuidesByCategory(category: GuideCategory): GuideNavEntry[] {
  return GUIDES_NAV.filter((guide) => guide.category === category);
}
