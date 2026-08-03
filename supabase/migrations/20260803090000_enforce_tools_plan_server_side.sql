-- La "Boîte à outils bailleur" (eau, charges, TEOM, régularisation) n'est verrouillée
-- que côté navigation (DashboardShell masque l'onglet si le plan ne le permet pas).
-- Les écritures elles-mêmes passent par le client Supabase public, protégées seulement
-- par une policy RLS qui vérifie le propriétaire de la ligne, pas son plan — un compte
-- gratuit ou lokt·one qui contournerait l'UI pourrait quand même créer ces données.
-- On ferme ce trou au niveau trigger, même principe que
-- enforce_lease_receipt_automation_plan.sql.

create or replace function public.landlord_user_can_use_tools(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan text;
  v_status text;
  v_ends_at timestamptz;
begin
  if to_regclass('public.subscriptions') is null then
    return false;
  end if;

  execute
    'select plan, status, ends_at
       from public.subscriptions
      where user_id = $1
      order by updated_at desc nulls last
      limit 1'
    into v_plan, v_status, v_ends_at
    using p_user_id;

  -- Aucune ligne subscriptions (compte gratuit) : v_plan reste NULL, et "null in (...)"
  -- vaut NULL, pas FALSE — garde explicite pour ne pas laisser passer ce cas.
  if v_plan is null then
    return false;
  end if;

  if coalesce(v_status, '') not in ('active', 'trialing') then
    return false;
  end if;

  if v_ends_at is not null and v_ends_at <= now() then
    return false;
  end if;

  return v_plan in ('landlord_15', 'landlord_unlimited');
end;
$$;

create or replace function public.enforce_landlord_tools_plan()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.landlord_user_can_use_tools(new.user_id) then
    raise exception 'La boîte à outils bailleur nécessite le plan lokt·plus.'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_tools_plan on public.water_allocations;
create trigger trg_enforce_tools_plan
before insert on public.water_allocations
for each row
execute function public.enforce_landlord_tools_plan();

drop trigger if exists trg_enforce_tools_plan on public.water_meter_sites;
create trigger trg_enforce_tools_plan
before insert on public.water_meter_sites
for each row
execute function public.enforce_landlord_tools_plan();

drop trigger if exists trg_enforce_tools_plan on public.water_meter_site_units;
create trigger trg_enforce_tools_plan
before insert on public.water_meter_site_units
for each row
execute function public.enforce_landlord_tools_plan();

drop trigger if exists trg_enforce_tools_plan on public.water_allocation_readings;
create trigger trg_enforce_tools_plan
before insert on public.water_allocation_readings
for each row
execute function public.enforce_landlord_tools_plan();
