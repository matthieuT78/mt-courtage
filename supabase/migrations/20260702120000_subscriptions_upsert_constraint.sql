-- Dédoublonnage : on garde la ligne la plus récente par stripe_subscription_id
delete from public.subscriptions s1
using public.subscriptions s2
where s1.stripe_subscription_id = s2.stripe_subscription_id
  and s1.stripe_subscription_id is not null
  and s1.updated_at < s2.updated_at;

-- Contrainte unique pour permettre l'upsert idempotent
alter table public.subscriptions
  add constraint subscriptions_stripe_subscription_id_key
  unique (stripe_subscription_id);
