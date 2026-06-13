drop policy if exists app_settings_select_scoped on public.app_settings;
create policy app_settings_select_scoped
  on public.app_settings
  for select
  to authenticated
  using (
    key = ('onboarding_done_at:' || (select auth.uid())::text)
    or key = ('landlord_nav_order:' || (select auth.uid())::text)
    or (select public.is_admin_profile())
  );

drop policy if exists app_settings_insert_scoped on public.app_settings;
create policy app_settings_insert_scoped
  on public.app_settings
  for insert
  to authenticated
  with check (
    key = ('onboarding_done_at:' || (select auth.uid())::text)
    or key = ('landlord_nav_order:' || (select auth.uid())::text)
    or (select public.is_admin_profile())
  );

drop policy if exists app_settings_update_scoped on public.app_settings;
create policy app_settings_update_scoped
  on public.app_settings
  for update
  to authenticated
  using (
    key = ('onboarding_done_at:' || (select auth.uid())::text)
    or key = ('landlord_nav_order:' || (select auth.uid())::text)
    or (select public.is_admin_profile())
  )
  with check (
    key = ('onboarding_done_at:' || (select auth.uid())::text)
    or key = ('landlord_nav_order:' || (select auth.uid())::text)
    or (select public.is_admin_profile())
  );

notify pgrst, 'reload schema';
