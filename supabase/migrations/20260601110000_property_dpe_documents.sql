insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('property-dpe-pdfs', 'property-dpe-pdfs', false, 10485760, array['application/pdf'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.property_dpe_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  property_id uuid not null references public.properties(id) on delete cascade,
  storage_bucket text not null default 'property-dpe-pdfs',
  storage_path text not null,
  file_name text not null,
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 10485760),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (storage_bucket, storage_path)
);

create index if not exists property_dpe_documents_user_idx
  on public.property_dpe_documents (user_id, created_at desc);

alter table public.property_dpe_documents enable row level security;

drop policy if exists property_dpe_documents_select_own on public.property_dpe_documents;
create policy property_dpe_documents_select_own
  on public.property_dpe_documents for select
  using (auth.uid() = user_id);

drop policy if exists property_dpe_documents_manage_own on public.property_dpe_documents;
create policy property_dpe_documents_manage_own
  on public.property_dpe_documents for all
  using (
    auth.uid() = user_id
    and exists (select 1 from public.properties p where p.id = property_id and p.user_id = auth.uid())
  )
  with check (
    auth.uid() = user_id
    and storage_bucket = 'property-dpe-pdfs'
    and exists (select 1 from public.properties p where p.id = property_id and p.user_id = auth.uid())
  );

drop policy if exists property_dpe_pdfs_select_own on storage.objects;
create policy property_dpe_pdfs_select_own
  on storage.objects for select
  using (
    bucket_id = 'property-dpe-pdfs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists property_dpe_pdfs_insert_own on storage.objects;
create policy property_dpe_pdfs_insert_own
  on storage.objects for insert
  with check (
    bucket_id = 'property-dpe-pdfs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists property_dpe_pdfs_update_own on storage.objects;
create policy property_dpe_pdfs_update_own
  on storage.objects for update
  using (
    bucket_id = 'property-dpe-pdfs'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'property-dpe-pdfs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

notify pgrst, 'reload schema';
