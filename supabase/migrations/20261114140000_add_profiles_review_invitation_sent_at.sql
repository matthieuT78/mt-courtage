-- Suivi de l'envoi (unique, jamais répété) de l'email de demande d'avis,
-- déclenché par pages/api/cron/review-invitations.ts dès qu'un bailleur a
-- envoyé sa toute première quittance (signal d'usage réel du produit,
-- choisi plutôt qu'une date fixe après inscription — décision du 2026-11-14,
-- remplace le popup ReviewPrompt jamais utilisé en 4 mois).
alter table public.profiles add column if not exists review_invitation_sent_at timestamptz;
