-- Point 2 du chantier RGPD : un bailleur peut anonymiser la fiche d'un
-- locataire archivé qui a un historique de bail (jusqu'ici la suppression
-- était bloquée sans aucune alternative — voir SectionLocataires.tsx). On
-- efface les champs personnels tout en gardant la ligne (les quittances,
-- baux et écritures comptables restent liés à un tenant_id valide).
-- anonymized_at sert à la fois de trace et de garde-fou (empêcher de
-- ré-anonymiser, afficher un badge côté bailleur).
alter table public.tenants add column if not exists anonymized_at timestamptz;
