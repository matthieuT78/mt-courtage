-- Nettoyage RGPD (minimisation des données) : ces 3 tables ne sont
-- référencées nulle part dans le code applicatif (vérifié par recherche
-- exhaustive sur pages/, lib/, components/, scripts/, migrations/) —
-- fonctionnalités mortes ou jamais branchées, gardées en base sans raison.
--
--   - lead_events (49 colonnes, dont email/téléphone/revenus en clair) :
--     2 lignes, plus aucune depuis janvier 2026. Sa policy INSERT
--     (lead_events_insert_anyone, with_check=true, roles anon+authenticated)
--     laissait de surcroît n'importe quel visiteur non authentifié y écrire
--     des lignes arbitraires — aucune lecture n'était exposée (SELECT
--     correctement scopé), mais c'était un vecteur de spam/pollution inutile
--     vu que rien ne lit cette table.
--   - contacts (1 ligne résiduelle depuis décembre 2025) et lease_guarantors
--     (table de garants jamais utilisée, distincte des champs guarantor_*
--     de candidatures/tenants qui sont eux la voie réellement utilisée) :
--     RLS correctement scopée (auth.uid() = user_id), pas de risque de
--     fuite, juste du code mort.
drop table if exists public.lease_guarantors;
drop table if exists public.contacts;
drop table if exists public.lead_events;
