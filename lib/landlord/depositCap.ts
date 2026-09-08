// lib/landlord/depositCap.ts
//
// Plafond légal du dépôt de garantie selon le type de bail (loi du 6 juillet
// 1989). Source unique — cette règle était dupliquée dans 3 fichiers
// (OnboardingWizard, LeaseContractWizard, LeaseContractOnboarding) et avait
// divergé : une des trois copies omettait "furnished_student" du plafond à
// 2 mois, laissant un bail meublé étudiant sans aucun contrôle.
// null = pas de plafond légal défini pour ce type (bail professionnel,
// "autre" : montant librement fixé).
export function depositCapForKind(kind: string, rent: number): number | null {
  if (kind === "mobility") return 0;
  if (kind === "furnished_primary" || kind === "furnished_student") return rent * 2;
  if (kind === "empty_primary") return rent;
  return null;
}
