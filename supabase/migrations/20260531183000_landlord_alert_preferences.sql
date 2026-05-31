create table if not exists public.landlord_alert_preferences (
  user_id uuid primary key,
  digest_enabled boolean not null default true,
  late_payment boolean not null default true,
  due_soon boolean not null default true,
  receipt_to_finalize boolean not null default true,
  rent_revision_due boolean not null default true,
  lease_end boolean not null default true,
  expired_active_lease boolean not null default true,
  entry_inventory_missing boolean not null default true,
  exit_inventory_to_prepare boolean not null default true,
  tenant_email_missing boolean not null default true,
  owner_email_missing boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.landlord_alert_preferences enable row level security;

drop policy if exists landlord_alert_preferences_select_own on public.landlord_alert_preferences;
create policy landlord_alert_preferences_select_own
  on public.landlord_alert_preferences
  for select
  using (auth.uid() = user_id);

drop policy if exists landlord_alert_preferences_insert_own on public.landlord_alert_preferences;
create policy landlord_alert_preferences_insert_own
  on public.landlord_alert_preferences
  for insert
  with check (auth.uid() = user_id);

drop policy if exists landlord_alert_preferences_update_own on public.landlord_alert_preferences;
create policy landlord_alert_preferences_update_own
  on public.landlord_alert_preferences
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
