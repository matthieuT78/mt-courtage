-- Secure legacy tables created before RLS was consistently enabled.
-- Server-side routes keep access through the service role, which bypasses RLS.

alter table public.projects enable row level security;
alter table public.city_market_benchmarks enable row level security;
alter table public.receipt_confirm_tokens enable row level security;
alter table public.app_settings enable row level security;
alter table public.receipt_actions enable row level security;

revoke all on table public.city_market_benchmarks from anon, authenticated;
revoke all on table public.receipt_confirm_tokens from anon, authenticated;
revoke all on table public.receipt_actions from anon, authenticated;

revoke all on table public.projects from anon;
grant select, insert, update, delete on table public.projects to authenticated;

drop policy if exists projects_select_own on public.projects;
create policy projects_select_own
  on public.projects
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists projects_insert_own on public.projects;
create policy projects_insert_own
  on public.projects
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists projects_update_own on public.projects;
create policy projects_update_own
  on public.projects
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists projects_delete_own on public.projects;
create policy projects_delete_own
  on public.projects
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.is_admin_profile()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (
      select p.is_admin
      from public.profiles p
      where p.id = (select auth.uid())
    ),
    false
  );
$$;

revoke all on function public.is_admin_profile() from public;
grant execute on function public.is_admin_profile() to authenticated;

revoke all on table public.app_settings from anon;
grant select, insert, update on table public.app_settings to authenticated;

drop policy if exists app_settings_select_scoped on public.app_settings;
create policy app_settings_select_scoped
  on public.app_settings
  for select
  to authenticated
  using (
    key = ('onboarding_done_at:' || (select auth.uid())::text)
    or (select public.is_admin_profile())
  );

drop policy if exists app_settings_insert_scoped on public.app_settings;
create policy app_settings_insert_scoped
  on public.app_settings
  for insert
  to authenticated
  with check (
    key = ('onboarding_done_at:' || (select auth.uid())::text)
    or (select public.is_admin_profile())
  );

drop policy if exists app_settings_update_scoped on public.app_settings;
create policy app_settings_update_scoped
  on public.app_settings
  for update
  to authenticated
  using (
    key = ('onboarding_done_at:' || (select auth.uid())::text)
    or (select public.is_admin_profile())
  )
  with check (
    key = ('onboarding_done_at:' || (select auth.uid())::text)
    or (select public.is_admin_profile())
  );

-- RLS protects rows, but profile owners previously retained the ability to
-- write privileged fields on their own row. Keep those fields server-managed.
create or replace function public.protect_profile_privileged_fields()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if (select auth.role()) = 'authenticated' then
    if tg_op = 'INSERT' then
      new.is_admin := false;
      new.account_tier := 'free';
      new.subscription_plan := null;
    elsif tg_op = 'UPDATE' then
      new.is_admin := old.is_admin;
      new.account_tier := old.account_tier;
      new.subscription_plan := old.subscription_plan;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists protect_profile_privileged_fields on public.profiles;
create trigger protect_profile_privileged_fields
  before insert or update on public.profiles
  for each row
  execute function public.protect_profile_privileged_fields();

-- Keep the explicitly approved administrator accounts aligned with the
-- database-level authorization used by app_settings policies.
update public.profiles
set is_admin = true
where lower(email) in (
  'matthieu.turbier@gmail.com'
);

notify pgrst, 'reload schema';
