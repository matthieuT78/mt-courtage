-- 1) Rejoue la migration standalone-reports, jamais appliquée en prod
--    (les colonnes property_label/occupant_email/etc. n'existaient pas,
--    rendant la création d'un état des lieux "libre" impossible).
alter table public.inventory_reports
  alter column lease_id drop not null,
  add column if not exists attachment_status text not null default 'attached'
    check (attachment_status in ('attached', 'standalone')),
  add column if not exists property_id uuid references public.properties(id) on delete set null,
  add column if not exists tenant_id uuid references public.tenants(id) on delete set null,
  add column if not exists property_label text,
  add column if not exists property_address_line1 text,
  add column if not exists property_address_line2 text,
  add column if not exists property_postal_code text,
  add column if not exists property_city text,
  add column if not exists occupant_label text,
  add column if not exists occupant_email text,
  add column if not exists occupant_phone text;

update public.inventory_reports
set attachment_status = case when lease_id is null then 'standalone' else 'attached' end
where attachment_status is distinct from case when lease_id is null then 'standalone' else 'attached' end;

create index if not exists inventory_reports_user_standalone_idx
  on public.inventory_reports (user_id, created_at desc)
  where lease_id is null;

-- 2) RLS pour inventory_reports / inventory_rooms / inventory_items.
--    Ces tables existaient déjà mais leurs policies avaient été créées
--    à la main, jamais versionnées : on les recrée ici explicitement
--    (idempotent, drop+create) pour avoir un état connu et reproductible.

alter table public.inventory_reports enable row level security;
alter table public.inventory_rooms enable row level security;
alter table public.inventory_items enable row level security;

drop policy if exists inventory_reports_select_own on public.inventory_reports;
create policy inventory_reports_select_own
  on public.inventory_reports
  for select
  using (user_id = auth.uid());

drop policy if exists inventory_reports_insert_own on public.inventory_reports;
create policy inventory_reports_insert_own
  on public.inventory_reports
  for insert
  with check (user_id = auth.uid());

drop policy if exists inventory_reports_update_own on public.inventory_reports;
create policy inventory_reports_update_own
  on public.inventory_reports
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists inventory_rooms_select_own on public.inventory_rooms;
create policy inventory_rooms_select_own
  on public.inventory_rooms
  for select
  using (
    exists (
      select 1 from public.inventory_reports r
      where r.id = report_id and r.user_id = auth.uid()
    )
  );

drop policy if exists inventory_rooms_insert_own on public.inventory_rooms;
create policy inventory_rooms_insert_own
  on public.inventory_rooms
  for insert
  with check (
    exists (
      select 1 from public.inventory_reports r
      where r.id = report_id and r.user_id = auth.uid()
        and r.status not in ('signed', 'archived')
    )
  );

drop policy if exists inventory_rooms_update_own on public.inventory_rooms;
create policy inventory_rooms_update_own
  on public.inventory_rooms
  for update
  using (
    exists (
      select 1 from public.inventory_reports r
      where r.id = report_id and r.user_id = auth.uid()
        and r.status not in ('signed', 'archived')
    )
  )
  with check (
    exists (
      select 1 from public.inventory_reports r
      where r.id = report_id and r.user_id = auth.uid()
    )
  );

drop policy if exists inventory_rooms_delete_own on public.inventory_rooms;
create policy inventory_rooms_delete_own
  on public.inventory_rooms
  for delete
  using (
    exists (
      select 1 from public.inventory_reports r
      where r.id = report_id and r.user_id = auth.uid()
        and r.status not in ('signed', 'archived')
    )
  );

drop policy if exists inventory_items_select_own on public.inventory_items;
create policy inventory_items_select_own
  on public.inventory_items
  for select
  using (
    exists (
      select 1 from public.inventory_reports r
      where r.id = report_id and r.user_id = auth.uid()
    )
  );

drop policy if exists inventory_items_insert_own on public.inventory_items;
create policy inventory_items_insert_own
  on public.inventory_items
  for insert
  with check (
    exists (
      select 1 from public.inventory_reports r
      where r.id = report_id and r.user_id = auth.uid()
        and r.status not in ('signed', 'archived')
    )
  );

drop policy if exists inventory_items_update_own on public.inventory_items;
create policy inventory_items_update_own
  on public.inventory_items
  for update
  using (
    exists (
      select 1 from public.inventory_reports r
      where r.id = report_id and r.user_id = auth.uid()
        and r.status not in ('signed', 'archived')
    )
  )
  with check (
    exists (
      select 1 from public.inventory_reports r
      where r.id = report_id and r.user_id = auth.uid()
    )
  );

drop policy if exists inventory_items_delete_own on public.inventory_items;
create policy inventory_items_delete_own
  on public.inventory_items
  for delete
  using (
    exists (
      select 1 from public.inventory_reports r
      where r.id = report_id and r.user_id = auth.uid()
        and r.status not in ('signed', 'archived')
    )
  );

notify pgrst, 'reload schema';
