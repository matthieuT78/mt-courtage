alter table landlord_alert_preferences
  add column if not exists co_tenant_email_missing boolean not null default true;
