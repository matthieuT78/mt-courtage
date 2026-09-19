alter table tenant_portal_access add column if not exists lease_id uuid references leases(id);
