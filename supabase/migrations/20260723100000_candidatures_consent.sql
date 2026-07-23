-- Trace serveur du consentement RGPD donné par le candidat à la soumission
-- (jusqu'ici la case à cocher n'existait que côté client, jamais persistée :
-- impossible de prouver après coup qu'un consentement avait été donné pour
-- une candidature précise).
alter table candidatures
  add column if not exists consent_at timestamptz;
