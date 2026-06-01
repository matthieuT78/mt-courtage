insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('lease-contract-pdfs', 'lease-contract-pdfs', false, 10485760, array['application/pdf'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.lease_contract_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  lease_id uuid not null references public.leases(id) on delete cascade,
  contract_kind text not null check (contract_kind in ('empty_primary', 'furnished_primary', 'furnished_student', 'mobility')),
  status text not null default 'draft' check (status in ('draft', 'ready', 'signed', 'archived')),
  form_data jsonb not null default '{}'::jsonb,
  pdf_url text,
  signed_pdf_url text,
  generated_at timestamptz,
  signed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lease_id)
);

create index if not exists lease_contract_documents_user_idx
  on public.lease_contract_documents (user_id, updated_at desc);

alter table public.lease_contract_documents enable row level security;

drop policy if exists lease_contract_documents_select_own on public.lease_contract_documents;
create policy lease_contract_documents_select_own
  on public.lease_contract_documents for select
  using (auth.uid() = user_id);

drop policy if exists lease_contract_documents_manage_own on public.lease_contract_documents;
create policy lease_contract_documents_manage_own
  on public.lease_contract_documents for all
  using (
    auth.uid() = user_id
    and exists (select 1 from public.leases l where l.id = lease_id and l.user_id = auth.uid())
  )
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.leases l where l.id = lease_id and l.user_id = auth.uid())
  );

drop policy if exists lease_contract_pdfs_select_own on storage.objects;
create policy lease_contract_pdfs_select_own
  on storage.objects for select
  using (
    bucket_id = 'lease-contract-pdfs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists lease_contract_pdfs_insert_own on storage.objects;
create policy lease_contract_pdfs_insert_own
  on storage.objects for insert
  with check (
    bucket_id = 'lease-contract-pdfs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists lease_contract_pdfs_update_own on storage.objects;
create policy lease_contract_pdfs_update_own
  on storage.objects for update
  using (
    bucket_id = 'lease-contract-pdfs'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'lease-contract-pdfs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

notify pgrst, 'reload schema';
