insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'water-tools',
  'water-tools',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.water_allocations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  site_id uuid,
  property_id uuid references public.properties(id) on delete set null,
  title text not null,
  scope_label text,
  address_line1 text,
  address_line2 text,
  postal_code text,
  city text,
  allocation_method text not null default 'all_meters' check (allocation_method in ('all_meters', 'principal_residual')),
  principal_unit_label text,
  principal_occupant_label text,
  principal_occupant_email text,
  period_start date not null,
  period_end date not null,
  invoice_total_amount numeric not null check (invoice_total_amount >= 0),
  fixed_charge_amount numeric not null default 0 check (fixed_charge_amount >= 0),
  billed_consumption numeric check (billed_consumption is null or billed_consumption >= 0),
  global_previous_reading numeric not null check (global_previous_reading >= 0),
  global_current_reading numeric not null check (global_current_reading >= 0),
  global_consumption numeric not null check (global_consumption >= 0),
  total_consumption numeric not null default 0 check (total_consumption >= 0),
  invoice_storage_bucket text,
  invoice_storage_path text,
  invoice_file_name text,
  invoice_size_bytes integer check (invoice_size_bytes is null or (invoice_size_bytes > 0 and invoice_size_bytes <= 10485760)),
  notes text,
  status text not null default 'finalized' check (status in ('draft', 'finalized')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end >= period_start),
  check (global_current_reading >= global_previous_reading),
  check (abs(global_consumption - total_consumption) <= 1),
  unique (invoice_storage_bucket, invoice_storage_path)
);

create table if not exists public.water_meter_sites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  property_id uuid references public.properties(id) on delete set null,
  site_name text not null,
  scope_label text,
  address_line1 text,
  address_line2 text,
  postal_code text,
  city text,
  global_meter_label text,
  allocation_method text not null default 'all_meters' check (allocation_method in ('all_meters', 'principal_residual')),
  principal_unit_label text,
  principal_occupant_label text,
  principal_occupant_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.water_meter_site_units (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.water_meter_sites(id) on delete cascade,
  user_id uuid not null,
  unit_label text not null,
  occupant_label text,
  occupant_email text,
  notes text,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.water_allocation_readings (
  id uuid primary key default gen_random_uuid(),
  allocation_id uuid not null references public.water_allocations(id) on delete cascade,
  user_id uuid not null,
  site_unit_id uuid,
  reading_source text not null default 'manual' check (reading_source in ('manual', 'principal_residual')),
  unit_label text not null,
  occupant_label text,
  occupant_email text,
  previous_reading numeric not null check (previous_reading >= 0),
  current_reading numeric not null check (current_reading >= 0),
  consumption numeric not null check (consumption >= 0),
  share_percent numeric not null default 0 check (share_percent >= 0),
  variable_amount_due numeric not null default 0 check (variable_amount_due >= 0),
  fixed_amount_due numeric not null default 0 check (fixed_amount_due >= 0),
  amount_due numeric not null default 0 check (amount_due >= 0),
  photo_storage_bucket text,
  photo_storage_path text,
  photo_file_name text,
  photo_size_bytes integer check (photo_size_bytes is null or (photo_size_bytes > 0 and photo_size_bytes <= 10485760)),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (current_reading >= previous_reading),
  unique (photo_storage_bucket, photo_storage_path)
);

create index if not exists water_allocations_user_created_idx
  on public.water_allocations (user_id, created_at desc);

create index if not exists water_meter_sites_user_created_idx
  on public.water_meter_sites (user_id, created_at desc);

create index if not exists water_meter_site_units_site_idx
  on public.water_meter_site_units (site_id, sort_order, created_at);

create index if not exists water_allocation_readings_allocation_idx
  on public.water_allocation_readings (allocation_id, created_at);

alter table public.water_allocations enable row level security;
alter table public.water_meter_sites enable row level security;
alter table public.water_meter_site_units enable row level security;
alter table public.water_allocation_readings enable row level security;

drop policy if exists water_allocations_select_own on public.water_allocations;
create policy water_allocations_select_own
  on public.water_allocations
  for select
  using (user_id = auth.uid());

drop policy if exists water_allocations_manage_own on public.water_allocations;
create policy water_allocations_manage_own
  on public.water_allocations
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists water_meter_sites_select_own on public.water_meter_sites;
create policy water_meter_sites_select_own
  on public.water_meter_sites
  for select
  using (user_id = auth.uid());

drop policy if exists water_meter_sites_manage_own on public.water_meter_sites;
create policy water_meter_sites_manage_own
  on public.water_meter_sites
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists water_meter_site_units_select_own on public.water_meter_site_units;
create policy water_meter_site_units_select_own
  on public.water_meter_site_units
  for select
  using (user_id = auth.uid());

drop policy if exists water_meter_site_units_manage_own on public.water_meter_site_units;
create policy water_meter_site_units_manage_own
  on public.water_meter_site_units
  for all
  using (
    user_id = auth.uid()
    and exists (
      select 1
      from public.water_meter_sites s
      where s.id = site_id
        and s.user_id = auth.uid()
    )
  )
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.water_meter_sites s
      where s.id = site_id
        and s.user_id = auth.uid()
    )
  );

drop policy if exists water_readings_select_own on public.water_allocation_readings;
create policy water_readings_select_own
  on public.water_allocation_readings
  for select
  using (user_id = auth.uid());

drop policy if exists water_readings_manage_own on public.water_allocation_readings;
create policy water_readings_manage_own
  on public.water_allocation_readings
  for all
  using (
    user_id = auth.uid()
    and exists (
      select 1
      from public.water_allocations a
      where a.id = allocation_id
        and a.user_id = auth.uid()
    )
  )
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.water_allocations a
      where a.id = allocation_id
        and a.user_id = auth.uid()
    )
  );

drop policy if exists water_tools_storage_select_own on storage.objects;
create policy water_tools_storage_select_own
  on storage.objects
  for select
  using (
    bucket_id = 'water-tools'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists water_tools_storage_insert_own on storage.objects;
create policy water_tools_storage_insert_own
  on storage.objects
  for insert
  with check (
    bucket_id = 'water-tools'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists water_tools_storage_update_own on storage.objects;
create policy water_tools_storage_update_own
  on storage.objects
  for update
  using (
    bucket_id = 'water-tools'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'water-tools'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists water_tools_storage_delete_own on storage.objects;
create policy water_tools_storage_delete_own
  on storage.objects
  for delete
  using (
    bucket_id = 'water-tools'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

notify pgrst, 'reload schema';
