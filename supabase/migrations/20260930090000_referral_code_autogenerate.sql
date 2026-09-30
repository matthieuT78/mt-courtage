-- profiles.referral_code n'était jamais écrit par le code applicatif — les
-- valeurs existantes venaient d'un backfill SQL ponctuel. Tout nouveau profil
-- se retrouvait donc avec referral_code = null, ce qui casse silencieusement
-- la récompense de parrainage : le webhook Stripe (pages/api/billing/
-- stripe-webhook.ts) cherche le parrain via `referral_code = referred_by`, et
-- ne le trouve jamais si la colonne est vide — même si le lien affiché côté
-- client (dérivé de l'UUID) a l'air parfaitement valide.
--
-- Backfill des profils actuellement orphelins.
update public.profiles
set referral_code = upper(left(replace(id::text, '-', ''), 8))
where referral_code is null;

-- Génération automatique à la création de tout nouveau profil, sur le même
-- format que le calcul déjà utilisé côté client (components/landlord/
-- ReferralCard.tsx) — pour qu'un code affiché soit toujours celui réellement
-- enregistré en base.
create or replace function public.set_referral_code()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.referral_code is null then
    new.referral_code := upper(left(replace(new.id::text, '-', ''), 8));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_set_referral_code on public.profiles;
create trigger trg_profiles_set_referral_code
  before insert on public.profiles
  for each row
  execute function public.set_referral_code();
