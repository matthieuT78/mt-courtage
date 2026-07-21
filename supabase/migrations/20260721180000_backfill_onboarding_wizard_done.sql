-- Avant le 20/07 (migration 20260720090000_allow_onboarding_wizard_done_settings),
-- la policy RLS de app_settings n'autorisait pas l'écriture de la clé
-- onboarding_wizard_done:{uid} : l'upsert fait par markDone() échouait
-- silencieusement (403, avalé par le try/catch de useWizardCompletionFlag),
-- donc AUCUN utilisateur existant n'a pu obtenir ce flag côté serveur avant
-- cette date, quelle que soit son ancienneté ou l'état réel de son compte.
--
-- Conséquence en prod : tout compte bailleur déjà en activité (bien/locataire
-- déjà créés) mais dont les données ne satisfont pas exactement la définition
-- stricte de mandatoryStepsComplete (ex : un bien encore sans location, un
-- profil avec adresse incomplète) revoit l'assistant de mise en route
-- obligatoire au prochain login, comme si son compte avait été réinitialisé.
-- C'est ce qui est arrivé à matthieu.turbier@gmail.com le 21/07.
--
-- Ce backfill pose le flag pour tout compte bailleur qui avait déjà au moins
-- un bien ou un locataire AVANT l'existence de l'assistant (déploiement du
-- 20/07) et qui n'a pas déjà le flag — ces comptes se sont déjà "mis en route"
-- eux-mêmes, l'assistant obligatoire ne doit pas leur être imposé rétroactivement.
-- Les nouveaux inscrits (aucune donnée) ne sont pas concernés et continueront
-- de voir l'assistant normalement.

insert into public.app_settings (key, value_json)
select
  'onboarding_wizard_done:' || p.id::text,
  jsonb_build_object('done', true)
from public.profiles p
join auth.users u on u.id = p.id
where coalesce(u.raw_user_meta_data ->> 'account_type', '') <> 'tenant'
  and u.created_at < '2026-07-20 00:00:00+00'
  and not exists (
    select 1 from public.app_settings s
    where s.key = 'onboarding_wizard_done:' || p.id::text
  )
  and (
    exists (
      select 1 from public.properties pr
      where pr.user_id = p.id and coalesce(lower(pr.status), '') <> 'archived'
    )
    or exists (
      select 1 from public.tenants t
      where t.user_id = p.id and t.archived_at is null
    )
  )
on conflict (key) do nothing;
