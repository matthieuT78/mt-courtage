-- Le garant ne pouvait être déclaré que par 4 champs texte déclaratifs (nom,
-- prénom, email, revenu) : aucun document ne lui était jamais demandé, contrairement
-- au candidat (identité, fiches de paie, avis d'imposition). Impossible pour le
-- bailleur de vérifier quoi que ce soit sur un garant.
--
-- Ajoute aussi un type de garant : personne physique (avec pièces, comme le
-- candidat) ou garantie Visale (numéro de visa uniquement, pas de revenu/pièces
-- à demander — c'est Action Logement qui garantit).

alter table public.candidatures
  add column if not exists guarantor_type text,
  add column if not exists visale_number text,
  add column if not exists guarantor_docs_identity boolean not null default false,
  add column if not exists guarantor_docs_payslip_1 boolean not null default false,
  add column if not exists guarantor_docs_payslip_2 boolean not null default false,
  add column if not exists guarantor_docs_payslip_3 boolean not null default false,
  add column if not exists guarantor_docs_payslips boolean not null default false,
  add column if not exists guarantor_docs_tax boolean not null default false,
  add column if not exists guarantor_docs_identity_path text,
  add column if not exists guarantor_docs_payslip_1_path text,
  add column if not exists guarantor_docs_payslip_2_path text,
  add column if not exists guarantor_docs_payslip_3_path text,
  add column if not exists guarantor_docs_tax_path text;

notify pgrst, 'reload schema';
