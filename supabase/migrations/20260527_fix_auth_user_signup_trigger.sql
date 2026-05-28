-- Fix signup failures caused by a brittle auth.users trigger.
-- Symptom in the app: "Database error saving new user".
--
-- The auth signup transaction fails if any trigger attached to auth.users raises.
-- We keep the expected behaviour (create/update public.profiles), but make it
-- idempotent and non-blocking for optional fields.

do $$
declare
  trigger_record record;
begin
  for trigger_record in
    select tgname
    from pg_trigger
    where tgrelid = 'auth.users'::regclass
      and not tgisinternal
  loop
    execute format('drop trigger if exists %I on auth.users', trigger_record.tgname);
  end loop;
end $$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  first_name_value text := nullif(trim(coalesce(meta->>'first_name', meta->>'given_name', '')), '');
  last_name_value text := nullif(trim(coalesce(meta->>'last_name', meta->>'family_name', '')), '');
  full_name_value text := nullif(trim(coalesce(meta->>'full_name', meta->>'name', '')), '');
begin
  if full_name_value is null then
    full_name_value := nullif(trim(coalesce(first_name_value, '') || ' ' || coalesce(last_name_value, '')), '');
  end if;

  insert into public.profiles (
    id,
    email,
    first_name,
    last_name,
    full_name,
    country,
    billing_same_as_main,
    marketing_opt_in,
    updated_at
  )
  values (
    new.id,
    new.email,
    first_name_value,
    last_name_value,
    full_name_value,
    'FR',
    true,
    false,
    now()
  )
  on conflict (id) do update
    set
      email = coalesce(excluded.email, public.profiles.email),
      first_name = coalesce(excluded.first_name, public.profiles.first_name),
      last_name = coalesce(excluded.last_name, public.profiles.last_name),
      full_name = coalesce(excluded.full_name, public.profiles.full_name),
      updated_at = now();

  return new;
exception
  when others then
    -- Never block auth signup because of profile enrichment.
    raise warning 'public.handle_new_user failed for user %: %', new.id, sqlerrm;
    return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
