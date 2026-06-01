alter table public.lease_contract_documents
  add column if not exists document_source text not null default 'generated'
    check (document_source in ('generated', 'external')),
  add column if not exists external_pdf_url text,
  add column if not exists original_file_name text;

alter table public.lease_contract_documents
  drop constraint if exists lease_contract_documents_contract_kind_check;

alter table public.lease_contract_documents
  add constraint lease_contract_documents_contract_kind_check
  check (contract_kind in ('empty_primary', 'furnished_primary', 'furnished_student', 'mobility', 'other'));

notify pgrst, 'reload schema';
