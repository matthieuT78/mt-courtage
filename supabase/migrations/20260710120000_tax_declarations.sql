create table if not exists public.tax_declarations (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  year        integer     not null,
  regime      text        not null,
  data        jsonb       not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique(user_id, year, regime)
);

alter table public.tax_declarations enable row level security;

create policy "Users manage own declarations"
  on public.tax_declarations for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);
