create table if not exists public.tenant_portal_access (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  landlord_user_id uuid not null,
  tenant_user_id uuid not null,
  invited_email text not null,
  status text not null default 'invited' check (status in ('invited', 'active', 'revoked')),
  invited_at timestamptz not null default now(),
  activated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id),
  unique (tenant_user_id, tenant_id)
);

create index if not exists tenant_portal_access_landlord_idx
  on public.tenant_portal_access (landlord_user_id);

create index if not exists tenant_portal_access_user_idx
  on public.tenant_portal_access (tenant_user_id);

create table if not exists public.tenant_message_threads (
  id uuid primary key default gen_random_uuid(),
  landlord_user_id uuid not null,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  property_id uuid references public.properties(id) on delete set null,
  lease_id uuid references public.leases(id) on delete set null,
  subject text not null default 'Échanges locatifs',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (landlord_user_id, tenant_id)
);

create index if not exists tenant_message_threads_tenant_idx
  on public.tenant_message_threads (tenant_id);

create table if not exists public.tenant_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.tenant_message_threads(id) on delete cascade,
  sender_user_id uuid not null,
  sender_role text not null check (sender_role in ('landlord', 'tenant')),
  body text not null check (char_length(trim(body)) between 1 and 5000),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists tenant_messages_thread_created_idx
  on public.tenant_messages (thread_id, created_at);

alter table public.tenant_portal_access enable row level security;
alter table public.tenant_message_threads enable row level security;
alter table public.tenant_messages enable row level security;

create or replace function public.can_access_tenant_portal(target_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tenant_portal_access a
    where a.tenant_id = target_tenant_id
      and a.tenant_user_id = auth.uid()
      and a.status in ('invited', 'active')
  );
$$;

create or replace function public.can_access_tenant_message_thread(target_thread_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tenant_message_threads t
    where t.id = target_thread_id
      and (
        t.landlord_user_id = auth.uid()
        or public.can_access_tenant_portal(t.tenant_id)
      )
  );
$$;

drop policy if exists tenant_portal_access_select_participant on public.tenant_portal_access;
create policy tenant_portal_access_select_participant
  on public.tenant_portal_access
  for select
  using (landlord_user_id = auth.uid() or tenant_user_id = auth.uid());

drop policy if exists tenant_portal_access_manage_landlord on public.tenant_portal_access;
create policy tenant_portal_access_manage_landlord
  on public.tenant_portal_access
  for all
  using (landlord_user_id = auth.uid())
  with check (landlord_user_id = auth.uid());

drop policy if exists tenant_message_threads_select_participant on public.tenant_message_threads;
create policy tenant_message_threads_select_participant
  on public.tenant_message_threads
  for select
  using (landlord_user_id = auth.uid() or public.can_access_tenant_portal(tenant_id));

drop policy if exists tenant_message_threads_manage_landlord on public.tenant_message_threads;
create policy tenant_message_threads_manage_landlord
  on public.tenant_message_threads
  for all
  using (landlord_user_id = auth.uid())
  with check (landlord_user_id = auth.uid());

drop policy if exists tenant_messages_select_participant on public.tenant_messages;
create policy tenant_messages_select_participant
  on public.tenant_messages
  for select
  using (public.can_access_tenant_message_thread(thread_id));

drop policy if exists tenant_messages_insert_participant on public.tenant_messages;
create policy tenant_messages_insert_participant
  on public.tenant_messages
  for insert
  with check (
    public.can_access_tenant_message_thread(thread_id)
    and sender_user_id = auth.uid()
    and (
      (
        sender_role = 'landlord'
        and exists (
          select 1 from public.tenant_message_threads t
          where t.id = thread_id and t.landlord_user_id = auth.uid()
        )
      )
      or
      (
        sender_role = 'tenant'
        and exists (
          select 1 from public.tenant_message_threads t
          where t.id = thread_id and public.can_access_tenant_portal(t.tenant_id)
        )
      )
    )
  );
