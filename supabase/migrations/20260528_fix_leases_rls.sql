alter table public.leases enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'leases'
      and policyname = 'leases_select_own'
  ) then
    create policy leases_select_own
      on public.leases
      for select
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'leases'
      and policyname = 'leases_insert_own'
  ) then
    create policy leases_insert_own
      on public.leases
      for insert
      with check (
        auth.uid() = user_id
        and exists (
          select 1
          from public.properties p
          where p.id = property_id
            and p.user_id = auth.uid()
        )
        and exists (
          select 1
          from public.tenants t
          where t.id = tenant_id
            and t.user_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'leases'
      and policyname = 'leases_update_own'
  ) then
    create policy leases_update_own
      on public.leases
      for update
      using (auth.uid() = user_id)
      with check (
        auth.uid() = user_id
        and exists (
          select 1
          from public.properties p
          where p.id = property_id
            and p.user_id = auth.uid()
        )
        and exists (
          select 1
          from public.tenants t
          where t.id = tenant_id
            and t.user_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'leases'
      and policyname = 'leases_delete_own'
  ) then
    create policy leases_delete_own
      on public.leases
      for delete
      using (auth.uid() = user_id);
  end if;
end $$;
