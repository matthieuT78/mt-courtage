-- Un locataire professionnel (personne morale) ne peut pas être partie à un
-- bail loi du 6 juillet 1989 (art. 2 : le logement doit être la résidence
-- principale du locataire, ce qui exclut une société). Lokt ne génère donc
-- pas de bail pour ces locataires — seule l'importation d'un bail rédigé par
-- ailleurs (droit commun) reste possible. Ces champs permettent simplement
-- d'identifier le locataire comme tel et de renseigner ses informations.

alter table public.tenants
  add column if not exists is_company boolean not null default false,
  add column if not exists company_name text,
  add column if not exists siret text,
  add column if not exists legal_representative_name text;

notify pgrst, 'reload schema';
