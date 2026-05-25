create table if not exists public.property_inventory_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  property_id uuid not null,
  room text,
  category text not null default 'Autre',
  label text not null,
  required_quantity integer not null default 1 check (required_quantity >= 0),
  actual_quantity integer not null default 1 check (actual_quantity >= 0),
  condition text not null default 'bon' check (condition in ('neuf', 'tres_bon', 'bon', 'moyen', 'a_remplacer')),
  is_required_lmnp boolean not null default false,
  replacement_cost numeric(12,2),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists property_inventory_items_user_idx on public.property_inventory_items(user_id);
create index if not exists property_inventory_items_property_idx on public.property_inventory_items(property_id);
create index if not exists property_inventory_items_lmnp_idx on public.property_inventory_items(user_id, property_id, is_required_lmnp);

alter table public.property_inventory_items enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'property_inventory_items'
      and policyname = 'property_inventory_items_select_own'
  ) then
    create policy property_inventory_items_select_own
      on public.property_inventory_items
      for select
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'property_inventory_items'
      and policyname = 'property_inventory_items_insert_own'
  ) then
    create policy property_inventory_items_insert_own
      on public.property_inventory_items
      for insert
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'property_inventory_items'
      and policyname = 'property_inventory_items_update_own'
  ) then
    create policy property_inventory_items_update_own
      on public.property_inventory_items
      for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'property_inventory_items'
      and policyname = 'property_inventory_items_delete_own'
  ) then
    create policy property_inventory_items_delete_own
      on public.property_inventory_items
      for delete
      using (auth.uid() = user_id);
  end if;
end $$;
