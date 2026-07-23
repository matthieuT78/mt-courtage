-- Le garant est un attribut du locataire (une personne), pas du bail — la
-- fiche bail a déjà trop de champs, et le garant reste généralement le même
-- d'un renouvellement à l'autre. Rempli manuellement à la création du
-- locataire, ou automatiquement depuis la candidature à la conversion.

alter table public.tenants
  add column if not exists guarantor_type text,
  add column if not exists visale_number text,
  add column if not exists guarantor_first_name text,
  add column if not exists guarantor_last_name text,
  add column if not exists guarantor_email text,
  add column if not exists guarantor_phone text,
  add column if not exists guarantor_address_line1 text,
  add column if not exists guarantor_postal_code text,
  add column if not exists guarantor_city text;

notify pgrst, 'reload schema';
