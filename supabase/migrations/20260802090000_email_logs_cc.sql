-- Trace l'adresse mise en copie (bailleur) sur les envois de quittance, pour pouvoir
-- répondre en 30 secondes à "est-ce que j'ai bien reçu une copie ?" sans devoir
-- recroiser lease.reminder_email manuellement.

alter table public.email_logs
  add column if not exists cc_email text;
