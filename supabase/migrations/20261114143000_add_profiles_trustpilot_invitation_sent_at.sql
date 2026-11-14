-- Suivi de l'envoi (unique, jamais répété) de la demande d'avis Trustpilot,
-- déclenchée par pages/api/cron/trustpilot-invitations.ts 60 jours après
-- l'email d'avis interne (profiles.review_invitation_sent_at), à tout le
-- monde à cette échéance sans condition de réponse ou de note — jamais de
-- "review gating". Décision du 2026-11-14.
alter table public.profiles add column if not exists trustpilot_invitation_sent_at timestamptz;
