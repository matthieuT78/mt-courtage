-- Corrige deux problèmes trouvés à l'audit de account_deletion_notices :
--
-- 1. La colonne user_id référençait auth.users(id) on delete cascade : dès
--    qu'un compte était supprimé, Postgres supprimait automatiquement la
--    ligne d'avis AVANT que le code applicatif ait pu y enregistrer
--    deleted_at — vérifié empiriquement. La preuve qu'un avertissement a bien
--    été envoyé puis suivi d'un délai avant suppression disparaissait donc au
--    moment précis où elle devient utile. On retire la contrainte : cette
--    table est un historique qui doit survivre à la suppression du compte
--    qu'elle documente (comme signup_confirmation_reminder_sends, qui n'a
--    volontairement aucune FK vers auth.users).
--
-- 2. RLS n'était pas activé, contrairement à signup_confirmation_reminder_sends.
--    Cette table n'est lue/écrite que par les crons via la clé de service —
--    aucune policy n'est nécessaire, RLS seul suffit à bloquer tout accès
--    anon/authenticated par défaut.

alter table public.account_deletion_notices
  drop constraint if exists account_deletion_notices_user_id_fkey;

alter table public.account_deletion_notices enable row level security;

-- Distingue "avis programmé" de "email effectivement délivré", pour ne jamais
-- supprimer un compte dont l'avertissement a échoué à l'envoi.
alter table public.account_deletion_notices
  add column if not exists email_sent_at timestamptz;

notify pgrst, 'reload schema';
