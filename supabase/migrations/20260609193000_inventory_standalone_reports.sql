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

notify pgrst, 'reload schema';
