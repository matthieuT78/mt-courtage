insert into storage.buckets (id, name, public)
values ('inventory-pdfs', 'inventory-pdfs', false)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'inventory_pdfs_select_own'
  ) then
    create policy inventory_pdfs_select_own
      on storage.objects
      for select
      using (
        bucket_id = 'inventory-pdfs'
        and (storage.foldername(name))[1] = 'inventory'
        and (storage.foldername(name))[2] = auth.uid()::text
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'inventory_pdfs_insert_own'
  ) then
    create policy inventory_pdfs_insert_own
      on storage.objects
      for insert
      with check (
        bucket_id = 'inventory-pdfs'
        and (storage.foldername(name))[1] = 'inventory'
        and (storage.foldername(name))[2] = auth.uid()::text
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'inventory_pdfs_update_own'
  ) then
    create policy inventory_pdfs_update_own
      on storage.objects
      for update
      using (
        bucket_id = 'inventory-pdfs'
        and (storage.foldername(name))[1] = 'inventory'
        and (storage.foldername(name))[2] = auth.uid()::text
      )
      with check (
        bucket_id = 'inventory-pdfs'
        and (storage.foldername(name))[1] = 'inventory'
        and (storage.foldername(name))[2] = auth.uid()::text
      );
  end if;
end $$;
