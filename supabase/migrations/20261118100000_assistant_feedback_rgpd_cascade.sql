-- Audit RGPD du 2026-11-18 : assistant_feedback (question/réponse en clair sur
-- feedback 👍/👎 Loky) et assistant_usage_daily n'avaient aucune clé étrangère
-- vers auth.users — la suppression d'un compte (pages/api/account/delete.ts)
-- laissait ces lignes orphelines indéfiniment, contredisant la promesse de
-- /confidentialite ("la suppression du compte efface immédiatement et
-- définitivement... les documents associés"). 5 lignes assistant_usage_daily
-- étaient déjà orphelines (comptes supprimés avant ce fix) — nettoyées avant
-- l'ajout de la contrainte, qui échouerait sinon.

delete from public.assistant_usage_daily au
where not exists (select 1 from auth.users u where u.id = au.user_id);

delete from public.assistant_feedback af
where not exists (select 1 from auth.users u where u.id = af.user_id);

alter table public.assistant_usage_daily
  add constraint assistant_usage_daily_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.assistant_feedback
  add constraint assistant_feedback_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;
