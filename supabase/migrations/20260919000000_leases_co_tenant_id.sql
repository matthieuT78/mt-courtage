alter table leases add column if not exists co_tenant_id uuid references tenants(id);
