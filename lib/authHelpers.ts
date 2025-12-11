// lib/authHelpers.ts

// Option 1 : emails admins définis dans une variable d'environnement
// Exemple de valeur dans .env.local :
// NEXT_PUBLIC_ADMIN_EMAILS="ton.email@gmail.com,autre.admin@domaine.com"

const ADMIN_EMAILS: string[] =
  process.env.NEXT_PUBLIC_ADMIN_EMAILS
    ?.split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean) || [];

// Fonction utilitaire pour savoir si un email est admin
export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}
