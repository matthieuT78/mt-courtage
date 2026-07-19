-- Le workflow "quittance automatique" (auto_quittance_enabled / auto_reminder_enabled)
-- n'était vérifié que côté client (bouton désactivé + payload forcé à false). La création
-- de bail passe par une API et l'édition par un appel Supabase direct depuis le client —
-- aucun des deux chemins ne revérifiait le plan côté serveur. Les endpoints qui exécutent
-- réellement l'automatisation (relances, quittances) revérifient déjà le plan, donc ce
-- trou n'ouvrait pas d'automatisation réelle — juste un flag incohérent en base. On le
-- ferme au niveau trigger pour couvrir les deux chemins (API + update direct) d'un coup,
-- sur le même principe que enforce_property_active_limit.

create or replace function public.landlord_user_can_use_receipt_automation(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan text;
  v_status text;
  v_ends_at timestamptz;
begin
  if to_regclass('public.subscriptions') is null then
    return false;
  end if;

  execute
    'select plan, status, ends_at
       from public.subscriptions
      where user_id = $1
      order by updated_at desc nulls last
      limit 1'
    into v_plan, v_status, v_ends_at
    using p_user_id;

  -- Aucune ligne subscriptions (cas le plus courant pour un compte gratuit) : v_plan/v_status
  -- restent NULL. "null not in (...)" vaut NULL en SQL, pas TRUE — sans ce garde explicite,
  -- le "if" suivant est silencieusement sauté et la fonction retombe sur `v_plan in (...)`
  -- qui vaut NULL, pas false : le trigger appelant ne bloque alors plus rien pour ces comptes.
  if v_plan is null then
    return false;
  end if;

  if coalesce(v_status, '') not in ('active', 'trialing') then
    return false;
  end if;

  if v_ends_at is not null and v_ends_at <= now() then
    return false;
  end if;

  return v_plan in ('landlord_5', 'landlord_15', 'landlord_unlimited');
end;
$$;

create or replace function public.enforce_lease_receipt_automation_plan()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (coalesce(new.auto_quittance_enabled, false) or coalesce(new.auto_reminder_enabled, false))
     and not public.landlord_user_can_use_receipt_automation(new.user_id) then
    new.auto_quittance_enabled := false;
    new.auto_reminder_enabled := false;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_lease_receipt_automation_plan on public.leases;

create trigger trg_enforce_lease_receipt_automation_plan
before insert or update of auto_quittance_enabled, auto_reminder_enabled, user_id on public.leases
for each row
execute function public.enforce_lease_receipt_automation_plan();
