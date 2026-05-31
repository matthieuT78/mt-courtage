insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('inventory-photos', 'inventory-photos', false, 1048576, array['image/jpeg'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.inventory_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  report_id uuid not null references public.inventory_reports(id) on delete cascade,
  item_id uuid not null references public.inventory_items(id) on delete cascade,
  storage_bucket text not null default 'inventory-photos',
  storage_path text not null,
  mime_type text not null default 'image/jpeg',
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 1048576),
  created_at timestamptz not null default now(),
  unique (storage_bucket, storage_path)
);

alter table public.inventory_photos
  add column if not exists user_id uuid,
  add column if not exists report_id uuid references public.inventory_reports(id) on delete cascade,
  add column if not exists item_id uuid references public.inventory_items(id) on delete cascade,
  add column if not exists storage_bucket text not null default 'inventory-photos',
  add column if not exists storage_path text,
  add column if not exists mime_type text not null default 'image/jpeg',
  add column if not exists size_bytes integer,
  add column if not exists created_at timestamptz not null default now();

create index if not exists inventory_photos_report_idx
  on public.inventory_photos (report_id, created_at);

create index if not exists inventory_photos_item_idx
  on public.inventory_photos (item_id, created_at);

create or replace function public.enforce_inventory_photo_limit()
returns trigger
language plpgsql
as $$
begin
  if (
    select count(*)
    from public.inventory_photos p
    where p.item_id = new.item_id
  ) >= 3 then
    raise exception 'Maximum 3 photos par observation.';
  end if;
  return new;
end;
$$;

drop trigger if exists inventory_photos_limit_trigger on public.inventory_photos;
create trigger inventory_photos_limit_trigger
  before insert on public.inventory_photos
  for each row execute function public.enforce_inventory_photo_limit();

alter table public.inventory_photos enable row level security;

drop policy if exists inventory_photos_select_own on public.inventory_photos;
create policy inventory_photos_select_own
  on public.inventory_photos
  for select
  using (user_id = auth.uid());

drop policy if exists inventory_photos_insert_own on public.inventory_photos;
create policy inventory_photos_insert_own
  on public.inventory_photos
  for insert
  with check (
    user_id = auth.uid()
    and storage_bucket = 'inventory-photos'
    and exists (
      select 1
      from public.inventory_reports r
      join public.inventory_items i on i.report_id = r.id
      where r.id = report_id
        and i.id = item_id
        and r.user_id = auth.uid()
        and r.status not in ('signed', 'archived')
    )
  );

drop policy if exists inventory_photos_delete_own on public.inventory_photos;
create policy inventory_photos_delete_own
  on public.inventory_photos
  for delete
  using (
    user_id = auth.uid()
    and exists (
      select 1
      from public.inventory_reports r
      where r.id = report_id
        and r.user_id = auth.uid()
        and r.status not in ('signed', 'archived')
    )
  );

drop policy if exists inventory_photos_storage_select_own on storage.objects;
create policy inventory_photos_storage_select_own
  on storage.objects
  for select
  using (
    bucket_id = 'inventory-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists inventory_photos_storage_insert_own on storage.objects;
create policy inventory_photos_storage_insert_own
  on storage.objects
  for insert
  with check (
    bucket_id = 'inventory-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists inventory_photos_storage_delete_own on storage.objects;
create policy inventory_photos_storage_delete_own
  on storage.objects
  for delete
  using (
    bucket_id = 'inventory-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
    and (
      not exists (
        select 1
        from public.inventory_photos p
        where p.storage_bucket = bucket_id
          and p.storage_path = name
      )
      or exists (
        select 1
        from public.inventory_photos p
        join public.inventory_reports r on r.id = p.report_id
        where p.storage_bucket = bucket_id
          and p.storage_path = name
          and p.user_id = auth.uid()
          and r.user_id = auth.uid()
          and r.status not in ('signed', 'archived')
      )
    )
  );

notify pgrst, 'reload schema';
