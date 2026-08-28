-- Coût réel (en micro-dollars, 1 000 000 = 1 $) de chaque jour d'usage de
-- Loky, calculé à partir des tokens réellement consommés par l'API Claude.
-- Permet de plafonner par coût réel (% du prix de l'abonnement) plutôt que
-- par un nombre de messages, qui n'est qu'une approximation du vrai risque.
alter table public.assistant_usage_daily
  add column if not exists cost_usd_micros bigint not null default 0;

notify pgrst, 'reload schema';
