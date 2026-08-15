-- Le cron d'anonymisation des leads (pages/api/cron/anonymize-leads.ts) référence
-- cette colonne depuis sa création, mais elle n'a jamais été ajoutée à la table —
-- le cron échouait donc silencieusement à chaque exécution mensuelle (aucun lead
-- jamais anonymisé), sans que rien ne le signale (pas d'alerte configurée sur ce
-- cron). Corrige l'écart entre le code et le schéma réel.

alter table public.leads
  add column if not exists anonymized_at timestamptz;

create index if not exists leads_anonymized_at_idx
  on public.leads (anonymized_at)
  where anonymized_at is null;
