alter table public.landlord_alert_preferences
  add column if not exists rent_revision_due boolean not null default true;
