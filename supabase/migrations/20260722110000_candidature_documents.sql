-- La section "pièces justificatives" du formulaire de candidature ne faisait que
-- cocher un booléen côté client quand un fichier était sélectionné — le fichier
-- lui-même n'était jamais envoyé au serveur ni stocké. Le bailleur voyait un badge
-- "CNI ✓" qui ne prouvait rien, et la politique de confidentialité décrivait une
-- collecte de documents qui n'avait jamais lieu.
--
-- Bucket privé, pas de policy authenticated/anon : le candidat n'a pas de session
-- (accès par token public), donc l'upload direct client + RLS classique ne
-- s'applique pas ici. L'écriture (candidat) et la lecture (bailleur) passent
-- toutes les deux par des routes API dédiées, avec le rôle service — c'est la
-- route API qui porte l'autorisation (token de candidature valide pour l'upload,
-- propriété de l'annonce pour la lecture), pas une policy de stockage.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('candidature-documents', 'candidature-documents', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

alter table public.candidatures
  add column if not exists docs_identity_path text,
  add column if not exists docs_tax_path text,
  add column if not exists docs_address_path text,
  add column if not exists docs_payslip_1_path text,
  add column if not exists docs_payslip_2_path text,
  add column if not exists docs_payslip_3_path text;

notify pgrst, 'reload schema';
