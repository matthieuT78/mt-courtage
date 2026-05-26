create table if not exists public.property_inventory_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  property_id uuid not null,
  snapshot_type text not null default 'control' check (snapshot_type in ('entry', 'exit', 'control')),
  snapshot_date date not null default current_date,
  tenant_name text,
  deposit_amount numeric(12,2),
  items jsonb not null default '[]'::jsonb,
  missing_count integer not null default 0,
  replace_count integer not null default 0,
  replacement_budget numeric(12,2) not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists property_inventory_snapshots_user_idx
  on public.property_inventory_snapshots(user_id, created_at desc);

create index if not exists property_inventory_snapshots_property_idx
  on public.property_inventory_snapshots(property_id, snapshot_date desc);

alter table public.property_inventory_snapshots enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'property_inventory_snapshots'
      and policyname = 'property_inventory_snapshots_select_own'
  ) then
    create policy property_inventory_snapshots_select_own
      on public.property_inventory_snapshots
      for select
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'property_inventory_snapshots'
      and policyname = 'property_inventory_snapshots_insert_own'
  ) then
    create policy property_inventory_snapshots_insert_own
      on public.property_inventory_snapshots
      for insert
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'property_inventory_snapshots'
      and policyname = 'property_inventory_snapshots_delete_own'
  ) then
    create policy property_inventory_snapshots_delete_own
      on public.property_inventory_snapshots
      for delete
      using (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if to_regclass('public.property_finance') is not null then
    alter table public.property_finance
      add column if not exists pno_insurance_monthly numeric(12,2),
      add column if not exists copro_charges_monthly numeric(12,2),
      add column if not exists cfe_yearly numeric(12,2),
      add column if not exists loan_interest_monthly numeric(12,2),
      add column if not exists bank_fees_monthly numeric(12,2),
      add column if not exists maintenance_monthly numeric(12,2);
  end if;
end $$;
