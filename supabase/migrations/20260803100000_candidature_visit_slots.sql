-- Agenda de visite pour les annonces de candidature : le bailleur propose des
-- créneaux (avec capacité, pour permettre les visites groupées), les candidats
-- réservent depuis la page publique de l'annonce.

create table if not exists public.candidature_visit_slots (
  id                uuid primary key default gen_random_uuid(),
  listing_id        uuid not null references public.rental_listings(id) on delete cascade,
  user_id           uuid not null references auth.users(id) on delete cascade,
  starts_at         timestamptz not null,
  duration_minutes  integer not null default 30 check (duration_minutes > 0),
  capacity          integer not null default 1 check (capacity > 0),
  created_at        timestamptz not null default now()
);

create table if not exists public.candidature_visit_bookings (
  id            uuid primary key default gen_random_uuid(),
  slot_id       uuid not null references public.candidature_visit_slots(id) on delete cascade,
  first_name    text not null,
  last_name     text not null,
  email         text not null,
  phone         text,
  cancelled_at  timestamptz,
  created_at    timestamptz not null default now()
);

alter table public.candidature_visit_slots enable row level security;
alter table public.candidature_visit_bookings enable row level security;

drop policy if exists "landlord_owns_visit_slots" on public.candidature_visit_slots;
drop policy if exists "public_reads_visit_slots" on public.candidature_visit_slots;
drop policy if exists "landlord_sees_visit_bookings" on public.candidature_visit_bookings;

-- Bailleur : gère ses propres créneaux (création, suppression, lecture)
create policy "landlord_owns_visit_slots"
  on public.candidature_visit_slots for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Lecture publique des créneaux (la page candidature/[token] affiche les
-- disponibilités) — filtrée par annonce active côté API, pas besoin de policy
-- plus fine ici puisque aucune donnée sensible n'est exposée par cette table.
create policy "public_reads_visit_slots"
  on public.candidature_visit_slots for select
  using (true);

-- Bailleur : voit les réservations de ses créneaux. Pas de policy d'insertion
-- publique : la réservation passe uniquement par l'API (service role), pour
-- pouvoir vérifier la capacité restante de façon atomique côté serveur.
create policy "landlord_sees_visit_bookings"
  on public.candidature_visit_bookings for select
  using (
    slot_id in (select id from public.candidature_visit_slots where user_id = auth.uid())
  );

create index if not exists idx_visit_slots_listing on public.candidature_visit_slots(listing_id);
create index if not exists idx_visit_slots_user    on public.candidature_visit_slots(user_id);
create index if not exists idx_visit_bookings_slot on public.candidature_visit_bookings(slot_id);
