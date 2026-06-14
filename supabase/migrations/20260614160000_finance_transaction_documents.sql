insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'finance-documents',
  'finance-documents',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.transaction_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  property_id uuid references public.properties(id) on delete set null,
  storage_bucket text not null default 'finance-documents',
  storage_path text not null,
  file_name text not null,
  mime_type text,
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 10485760),
  document_kind text not null default 'invoice' check (document_kind in ('invoice', 'receipt', 'quote', 'other')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (storage_bucket, storage_path)
);

create index if not exists transaction_documents_user_idx
  on public.transaction_documents (user_id, created_at desc);

create index if not exists transaction_documents_transaction_idx
  on public.transaction_documents (transaction_id, created_at desc);

alter table public.transaction_documents enable row level security;

drop policy if exists transaction_documents_select_own on public.transaction_documents;
create policy transaction_documents_select_own
  on public.transaction_documents
  for select
  using (user_id = auth.uid());

drop policy if exists transaction_documents_manage_own on public.transaction_documents;
create policy transaction_documents_manage_own
  on public.transaction_documents
  for all
  using (
    user_id = auth.uid()
    and exists (
      select 1
      from public.transactions t
      where t.id = transaction_id
        and t.user_id = auth.uid()
    )
  )
  with check (
    user_id = auth.uid()
    and storage_bucket = 'finance-documents'
    and exists (
      select 1
      from public.transactions t
      where t.id = transaction_id
        and t.user_id = auth.uid()
    )
  );

drop policy if exists finance_documents_select_own on storage.objects;
create policy finance_documents_select_own
  on storage.objects
  for select
  using (
    bucket_id = 'finance-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists finance_documents_insert_own on storage.objects;
create policy finance_documents_insert_own
  on storage.objects
  for insert
  with check (
    bucket_id = 'finance-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists finance_documents_update_own on storage.objects;
create policy finance_documents_update_own
  on storage.objects
  for update
  using (
    bucket_id = 'finance-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'finance-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists finance_documents_delete_own on storage.objects;
create policy finance_documents_delete_own
  on storage.objects
  for delete
  using (
    bucket_id = 'finance-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

notify pgrst, 'reload schema';
