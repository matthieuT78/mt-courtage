-- Quand un abonnement devient inactif (paiement refusé, résiliation), le
-- compte repasse au quota du plan gratuit (1 bien actif). Les biens en trop
-- sont archivés automatiquement (jamais supprimés) depuis
-- pages/api/billing/stripe-webhook.ts (syncPropertyQuota). plan_locked_at
-- distingue cet archivage automatique d'un archivage choisi par le client :
-- seuls les biens avec plan_locked_at non nul sont candidats à la
-- réactivation automatique quand l'abonnement redevient actif.
alter table public.properties add column if not exists plan_locked_at timestamptz;

comment on column public.properties.plan_locked_at is
  'Non nul si ce bien a été archivé automatiquement par syncPropertyQuota (dépassement de quota suite à un abonnement devenu inactif), par opposition à un archivage volontaire du client. Sert à savoir quels biens réactiver automatiquement quand l''abonnement redevient actif.';
