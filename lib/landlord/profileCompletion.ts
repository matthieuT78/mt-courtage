export type LandlordProfileForCompletion = {
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  address_line1?: string | null;
  postal_code?: string | null;
  city?: string | null;
};

// Nom + adresse minimale : ce qu'il faut réellement pour générer quittances,
// baux et états des lieux. Utilisé à la fois par la checklist de mise en
// route et par la page /mon-compte pour éviter que les deux affichent des
// verdicts différents sur un même profil.
export function isLandlordProfileComplete(profile?: LandlordProfileForCompletion | null): boolean {
  if (!profile) return false;
  return !!(
    (profile.first_name || profile.last_name || profile.full_name) &&
    profile.address_line1 &&
    profile.postal_code &&
    profile.city
  );
}
