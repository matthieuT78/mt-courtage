-- Verrouille en base (pas seulement côté client/API) toute modification d'un
-- contrat de bail une fois signé ou archivé, sur le même principe que ce qui
-- existe déjà pour les états des lieux (inventory_reports/rooms/items).

drop policy if exists lease_contract_documents_manage_own on public.lease_contract_documents;

drop policy if exists lease_contract_documents_insert_own on public.lease_contract_documents;
create policy lease_contract_documents_insert_own
  on public.lease_contract_documents for insert
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.leases l where l.id = lease_id and l.user_id = auth.uid())
  );

drop policy if exists lease_contract_documents_update_own on public.lease_contract_documents;
create policy lease_contract_documents_update_own
  on public.lease_contract_documents for update
  using (
    auth.uid() = user_id
    and exists (select 1 from public.leases l where l.id = lease_id and l.user_id = auth.uid())
    and status not in ('signed', 'archived')
  )
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.leases l where l.id = lease_id and l.user_id = auth.uid())
  );

drop policy if exists lease_contract_documents_delete_own on public.lease_contract_documents;
create policy lease_contract_documents_delete_own
  on public.lease_contract_documents for delete
  using (
    auth.uid() = user_id
    and exists (select 1 from public.leases l where l.id = lease_id and l.user_id = auth.uid())
    and status not in ('signed', 'archived')
  );

notify pgrst, 'reload schema';
