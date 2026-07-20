-- Le flag "assistant de mise en route terminé" (onboarding_wizard_done:{uid}),
-- utilisé par useWizardCompletionFlag pour ne plus jamais réafficher l'assistant
-- obligatoire une fois franchi, n'était pas dans l'allowlist de clés de
-- app_settings — son écriture échouait silencieusement (403 RLS) et le flag ne
-- persistait qu'en localStorage, donc réapparaissait sur tout autre navigateur/appareil.

drop policy if exists app_settings_select_scoped on public.app_settings;
create policy app_settings_select_scoped
  on public.app_settings
  for select
  to authenticated
  using (
    key = ('onboarding_done_at:' || (select auth.uid())::text)
    or key = ('landlord_nav_order:' || (select auth.uid())::text)
    or key = ('onboarding_wizard_done:' || (select auth.uid())::text)
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
    or key = ('onboarding_wizard_done:' || (select auth.uid())::text)
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
    or key = ('onboarding_wizard_done:' || (select auth.uid())::text)
    or (select public.is_admin_profile())
  )
  with check (
    key = ('onboarding_done_at:' || (select auth.uid())::text)
    or key = ('landlord_nav_order:' || (select auth.uid())::text)
    or key = ('onboarding_wizard_done:' || (select auth.uid())::text)
    or (select public.is_admin_profile())
  );

notify pgrst, 'reload schema';
