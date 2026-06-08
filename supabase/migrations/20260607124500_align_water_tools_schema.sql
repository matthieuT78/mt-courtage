alter table public.water_allocations
  add column if not exists site_id uuid,
  add column if not exists property_id uuid references public.properties(id) on delete set null,
  add column if not exists address_line1 text,
  add column if not exists address_line2 text,
  add column if not exists postal_code text,
  add column if not exists city text,
  add column if not exists allocation_method text not null default 'all_meters',
  add column if not exists principal_unit_label text,
  add column if not exists principal_occupant_label text,
  add column if not exists principal_occupant_email text,
  add column if not exists fixed_charge_amount numeric not null default 0,
  add column if not exists billed_consumption numeric,
  add column if not exists global_previous_reading numeric not null default 0,
  add column if not exists global_current_reading numeric not null default 0,
  add column if not exists global_consumption numeric not null default 0;

alter table public.water_allocation_readings
  add column if not exists site_unit_id uuid,
  add column if not exists reading_source text not null default 'manual',
  add column if not exists unit_label text,
  add column if not exists occupant_email text,
  add column if not exists variable_amount_due numeric not null default 0,
  add column if not exists fixed_amount_due numeric not null default 0;

do $$
begin
  if exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'water_allocation_readings'
      and c.column_name = 'label'
  ) then
    execute 'update public.water_allocation_readings set unit_label = coalesce(unit_label, label) where unit_label is null';
  end if;
end;
$$;

alter table public.water_allocation_readings
  alter column unit_label set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'water_allocations_allocation_method_check'
  ) then
    alter table public.water_allocations
      add constraint water_allocations_allocation_method_check
      check (allocation_method in ('all_meters', 'principal_residual'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'water_allocations_fixed_charge_amount_check'
  ) then
    alter table public.water_allocations
      add constraint water_allocations_fixed_charge_amount_check
      check (fixed_charge_amount >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'water_allocations_billed_consumption_check'
  ) then
    alter table public.water_allocations
      add constraint water_allocations_billed_consumption_check
      check (billed_consumption is null or billed_consumption >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'water_allocations_global_previous_reading_check'
  ) then
    alter table public.water_allocations
      add constraint water_allocations_global_previous_reading_check
      check (global_previous_reading >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'water_allocations_global_current_reading_check'
  ) then
    alter table public.water_allocations
      add constraint water_allocations_global_current_reading_check
      check (global_current_reading >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'water_allocations_global_consumption_check'
  ) then
    alter table public.water_allocations
      add constraint water_allocations_global_consumption_check
      check (global_consumption >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'water_allocations_global_reading_order_check'
  ) then
    alter table public.water_allocations
      add constraint water_allocations_global_reading_order_check
      check (global_current_reading >= global_previous_reading);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'water_allocations_global_total_delta_check'
  ) then
    alter table public.water_allocations
      add constraint water_allocations_global_total_delta_check
      check (abs(global_consumption - total_consumption) <= 1) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'water_allocation_readings_reading_source_check'
  ) then
    alter table public.water_allocation_readings
      add constraint water_allocation_readings_reading_source_check
      check (reading_source in ('manual', 'principal_residual'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'water_allocation_readings_variable_amount_due_check'
  ) then
    alter table public.water_allocation_readings
      add constraint water_allocation_readings_variable_amount_due_check
      check (variable_amount_due >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'water_allocation_readings_fixed_amount_due_check'
  ) then
    alter table public.water_allocation_readings
      add constraint water_allocation_readings_fixed_amount_due_check
      check (fixed_amount_due >= 0);
  end if;
end;
$$;

notify pgrst, 'reload schema';
