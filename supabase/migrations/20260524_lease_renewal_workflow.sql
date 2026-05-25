alter table public.leases
  add column if not exists lease_kind text not null default 'furnished_primary',
  add column if not exists auto_renewal_enabled boolean not null default true;

comment on column public.leases.lease_kind is
  'Type métier du bail: furnished_primary, furnished_student, mobility, empty_primary, other.';

comment on column public.leases.auto_renewal_enabled is
  'Indique si lokt.fr suit le bail comme reconduit tacitement après la date de fin contractuelle.';

update public.leases
set lease_kind = coalesce(nullif(lease_kind, ''), 'furnished_primary'),
    auto_renewal_enabled = coalesce(auto_renewal_enabled, true);
