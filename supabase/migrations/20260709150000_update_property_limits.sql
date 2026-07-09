-- Mise à jour des limites de logements suite au repricing
-- landlord_5 (lokt·one) : 3 → 2 logements
-- landlord_15 (lokt·plus) : 10 → 5 logements

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
    return 2;
  elsif v_plan = 'landlord_15' then
    return 5;
  elsif v_plan = 'landlord_unlimited' then
    return 999999;
  end if;

  return 1;
end;
$$;
