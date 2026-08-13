-- Le parrainage (referral_code / referred_by) et l'opt-in marketing saisis à
-- l'inscription échouaient silencieusement à se sauvegarder : ils passaient
-- par un upsert client (supabase.from("profiles").upsert(...)) exécuté juste
-- après signUp(), à un moment où la session n'existe pas encore tant que
-- l'email n'est pas confirmé (mailer_autoconfirm = false sur ce projet) — la
-- RLS bloque alors l'écriture (401), sans que l'utilisateur ne le sache.
--
-- Le trigger handle_new_user() (voir 20260527_fix_auth_user_signup_trigger.sql)
-- s'exécute en SECURITY DEFINER au moment même de l'insertion dans
-- auth.users, donc avant même la confirmation email — c'est le seul endroit
-- fiable pour ces écritures. On y ajoute referral_code (déterministe à
-- partir de l'UUID), referred_by (candidat transmis via les métadonnées du
-- compte, avec garde anti-auto-parrainage) et marketing_opt_in.

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
  referral_code_value text := upper(left(replace(new.id::text, '-', ''), 8));
  referred_by_candidate text := nullif(trim(upper(coalesce(meta->>'referred_by_input', ''))), '');
  referred_by_value text;
  marketing_opt_in_value boolean := coalesce((meta->>'marketing_opt_in')::boolean, false);
begin
  if full_name_value is null then
    full_name_value := nullif(trim(coalesce(first_name_value, '') || ' ' || coalesce(last_name_value, '')), '');
  end if;

  -- Garde anti-auto-parrainage : un candidat identique au propre code du
  -- nouvel utilisateur (cas quasi impossible en pratique, mais gratuit à
  -- vérifier) n'est jamais retenu.
  if referred_by_candidate is not null and referred_by_candidate <> referral_code_value then
    referred_by_value := referred_by_candidate;
  else
    referred_by_value := null;
  end if;

  insert into public.profiles (
    id,
    email,
    first_name,
    last_name,
    full_name,
    referral_code,
    referred_by,
    marketing_opt_in,
    country,
    billing_same_as_main,
    updated_at
  )
  values (
    new.id,
    new.email,
    first_name_value,
    last_name_value,
    full_name_value,
    referral_code_value,
    referred_by_value,
    marketing_opt_in_value,
    'FR',
    true,
    now()
  )
  on conflict (id) do update
    set
      email = coalesce(excluded.email, public.profiles.email),
      first_name = coalesce(excluded.first_name, public.profiles.first_name),
      last_name = coalesce(excluded.last_name, public.profiles.last_name),
      full_name = coalesce(excluded.full_name, public.profiles.full_name),
      referral_code = coalesce(public.profiles.referral_code, excluded.referral_code),
      referred_by = coalesce(public.profiles.referred_by, excluded.referred_by),
      marketing_opt_in = coalesce(public.profiles.marketing_opt_in, excluded.marketing_opt_in),
      updated_at = now();

  return new;
exception
  when others then
    -- Never block auth signup because of profile enrichment.
    raise warning 'public.handle_new_user failed for user %: %', new.id, sqlerrm;
    return new;
end;
$$;
