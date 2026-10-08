-- Anti-spam pour le cron free-plan-quittance-reminder.ts : ne jamais relancer
-- deux fois un bailleur gratuit pour la même période (même principe que
-- leases.last_auto_sent_period côté plan payant, mais une colonne séparée
-- pour ne jamais mélanger les deux logiques si un bail change de plan).
alter table public.leases
  add column if not exists last_free_plan_reminder_period text;
