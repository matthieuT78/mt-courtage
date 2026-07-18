alter table public.landlord_alert_preferences
  add column if not exists deposit_not_collected boolean not null default true,
  add column if not exists deposit_return_overdue boolean not null default true;

notify pgrst, 'reload schema';
