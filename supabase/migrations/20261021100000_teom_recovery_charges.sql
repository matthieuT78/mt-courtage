-- Garde-fou TEOM : mémorise la date d'occupation supposée au moment où une
-- écriture Finance "charges_recovered" a été calculée pour un locataire
-- encore en place. Si le bail se termine plus tôt que cette date supposée,
-- le montant facturé est trop élevé — le cron landlord-alerts compare les
-- deux et prévient le bailleur par email (pages/api/cron/landlord-alerts.ts).

create table if not exists public.teom_recovery_charges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  lease_id uuid not null references public.leases(id) on delete cascade,
  occupancy_start date not null,
  assumed_occupancy_end date not null,
  created_at timestamptz not null default now()
);

create index if not exists teom_recovery_charges_user_id_idx on public.teom_recovery_charges (user_id);
create index if not exists teom_recovery_charges_lease_id_idx on public.teom_recovery_charges (lease_id);

alter table public.teom_recovery_charges enable row level security;

drop policy if exists teom_recovery_charges_select_own on public.teom_recovery_charges;
create policy teom_recovery_charges_select_own
  on public.teom_recovery_charges
  for select
  using (user_id = auth.uid());

drop policy if exists teom_recovery_charges_manage_own on public.teom_recovery_charges;
create policy teom_recovery_charges_manage_own
  on public.teom_recovery_charges
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

notify pgrst, 'reload schema';
