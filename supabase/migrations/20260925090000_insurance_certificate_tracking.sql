-- Suivi de l'attestation d'assurance habitation du locataire, par bail. Une
-- date (pas un simple booléen) : l'attestation doit être renouvelée chaque
-- année, un "reçu: oui" figé ne dirait plus rien 14 mois plus tard.
alter table public.leases add column if not exists insurance_certificate_received_at date;

alter table public.landlord_alert_preferences
  add column if not exists insurance_certificate_missing boolean not null default true;
