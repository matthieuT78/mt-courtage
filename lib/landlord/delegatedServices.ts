// Source unique des services qu'un bailleur peut déléguer à une agence sur un bien
// (properties.delegated_services). Utilisé par le formulaire du bien (SectionBiens.tsx),
// l'onboarding (OnboardingWizard.tsx) et le cron d'alertes (landlord-alerts.ts) pour
// éviter que ces trois clés dérivent indépendamment les unes des autres.
export const DELEGATED_SERVICES = [
  { key: "mise_en_location", label: "Mise en location & candidatures", desc: "Recherche locataire, dossiers de candidature" },
  { key: "bail_edl", label: "Bail & états des lieux", desc: "Rédaction du bail, état des lieux, dépôt de garantie" },
  { key: "gestion_courante", label: "Gestion courante", desc: "Encaissement loyers, quittances, révision IRL" },
] as const;

export type DelegatedServiceKey = (typeof DELEGATED_SERVICES)[number]["key"];
