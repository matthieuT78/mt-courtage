-- Le portail locataire (et la messagerie) est annoncé sur /tarifs comme réservé à lokt·one
-- ("ouvre le portail locataire", "le partage avec le locataire et le portail en ligne
-- nécessitent le plan lokt·one"), mais rien ne l'appliquait : ni côté API (déjà corrigé dans
-- pages/api/tenant-portal/invite.ts et toggle-messaging.ts), ni côté base. La policy RLS
-- tenant_portal_access_manage_landlord autorise `for all` sur simple appartenance
-- (landlord_user_id = auth.uid()), donc un compte gratuit pouvait écrire directement sur
-- cette table depuis le client Supabase et contourner les deux endpoints. On ferme le trou
-- au niveau trigger, même principe que enforce_lease_receipt_automation_plan.

create or replace function public.enforce_tenant_portal_access_plan()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.landlord_user_can_use_receipt_automation(new.landlord_user_id) then
    raise exception 'Le portail locataire est réservé aux abonnements payants (à partir de lokt·one).';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_tenant_portal_access_plan on public.tenant_portal_access;

create trigger trg_enforce_tenant_portal_access_plan
before insert or update on public.tenant_portal_access
for each row
execute function public.enforce_tenant_portal_access_plan();
