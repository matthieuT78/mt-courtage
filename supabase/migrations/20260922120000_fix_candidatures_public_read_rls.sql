-- Sécurité critique : candidate_reads_own avait qual = true sur le rôle
-- public (anon inclus), rendant toutes les candidatures (nom, email,
-- téléphone, date de naissance, revenus, garant, chemins des pièces
-- jointes identité/fiches de paie) lisibles sans authentification via
-- l'API REST Supabase. Aucun code de l'app ne dépend de ces 3 policies :
-- tous les accès candidat réels passent par des routes serveur avec le
-- client admin (qui contourne RLS). Le seul accès client légitime est
-- côté bailleur, déjà protégé par landlord_sees_candidatures.
drop policy if exists candidate_reads_own on public.candidatures;
drop policy if exists candidate_inserts on public.candidatures;
drop policy if exists candidate_updates_own on public.candidatures;
