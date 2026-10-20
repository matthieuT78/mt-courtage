-- Ajoute une case CGU obligatoire à l'inscription, distincte de la case
-- marketing (RGPD : le consentement marketing doit rester une action à part,
-- jamais fusionnée avec l'acceptation d'un contrat). On horodate l'acceptation
-- côté serveur (now()), jamais une date envoyée par le client, pour garder une
-- preuve fiable en cas de litige.
--
-- Même raison que marketing_opt_in (20260813120000) : l'écriture doit se
-- faire dans handle_new_user() au moment de l'insertion dans auth.users, pas
-- via un upsert client après signUp() qui échoue silencieusement tant que
-- l'email n'est pas confirmé.

alter table public.profiles
  add column if not exists cgu_accepted_at timestamptz;

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
  cgu_accepted_value boolean := coalesce((meta->>'cgu_accepted')::boolean, false);
  cgu_accepted_at_value timestamptz := case when coalesce((meta->>'cgu_accepted')::boolean, false) then now() else null end;
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
    cgu_accepted_at,
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
    cgu_accepted_at_value,
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
      cgu_accepted_at = coalesce(public.profiles.cgu_accepted_at, excluded.cgu_accepted_at),
      updated_at = now();

  return new;
exception
  when others then
    -- Never block auth signup because of profile enrichment.
    raise warning 'public.handle_new_user failed for user %: %', new.id, sqlerrm;
    return new;
end;
$$;
