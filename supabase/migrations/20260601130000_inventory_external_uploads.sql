alter table public.inventory_reports
  add column if not exists document_source text not null default 'generated'
    check (document_source in ('generated', 'external')),
  add column if not exists original_file_name text;

update storage.buckets
set public = false,
    file_size_limit = 10485760,
    allowed_mime_types = array['application/pdf']
where id = 'inventory-pdfs';

notify pgrst, 'reload schema';
