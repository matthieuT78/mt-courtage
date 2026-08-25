-- Lots au sein d'un bien de type "immeuble" (monopropriété) : un seul bien/crédit,
-- plusieurs unités louées séparément. Nullable partout où c'est rattaché : les biens
-- simples (appartement, maison...) ne créent jamais de lot et ne sont pas impactés.

create table if not exists public.property_lots (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  user_id uuid not null,
  label text not null,
  surface_m2 numeric,
  status text not null default 'active' check (status in ('active', 'archived')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists property_lots_property_id_idx on public.property_lots (property_id, sort_order);
create index if not exists property_lots_user_id_idx on public.property_lots (user_id);

alter table public.property_lots enable row level security;

drop policy if exists property_lots_select_own on public.property_lots;
create policy property_lots_select_own
  on public.property_lots
  for select
  using (user_id = auth.uid());

drop policy if exists property_lots_manage_own on public.property_lots;
create policy property_lots_manage_own
  on public.property_lots
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

alter table public.leases add column if not exists lot_id uuid references public.property_lots(id) on delete set null;
create index if not exists leases_lot_id_idx on public.leases (lot_id);

alter table public.rental_listings add column if not exists lot_id uuid references public.property_lots(id) on delete set null;

notify pgrst, 'reload schema';
