create or replace function public.landlord_property_limit_for_user(p_user_id uuid)
returns integer
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
    return 1;
  end if;

  execute
    'select plan, status, ends_at
       from public.subscriptions
      where user_id = $1
      order by updated_at desc nulls last
      limit 1'
    into v_plan, v_status, v_ends_at
    using p_user_id;

  if v_status not in ('active', 'trialing') then
    return 1;
  end if;

  if v_ends_at is not null and v_ends_at <= now() then
    return 1;
  end if;

  if v_plan = 'landlord_5' then
    return 3;
  elsif v_plan = 'landlord_15' then
    return 10;
  elsif v_plan = 'landlord_unlimited' then
    return 999999;
  end if;

  return 1;
end;
$$;

create or replace function public.enforce_property_active_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer;
  v_active_count integer;
  v_new_status text;
begin
  v_new_status := lower(coalesce(new.status, 'active'));

  if v_new_status = 'archived' then
    return new;
  end if;

  v_limit := public.landlord_property_limit_for_user(new.user_id);

  select count(*)
    into v_active_count
    from public.properties p
   where p.user_id = new.user_id
     and lower(coalesce(p.status, 'active')) <> 'archived'
     and (tg_op = 'INSERT' or p.id <> new.id);

  if v_active_count >= v_limit then
    raise exception 'Votre offre actuelle permet % bien(s) actif(s). Passez à un abonnement pour en ajouter davantage.', v_limit
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_property_active_limit on public.properties;

create trigger trg_enforce_property_active_limit
before insert or update of status, user_id on public.properties
for each row
execute function public.enforce_property_active_limit();
