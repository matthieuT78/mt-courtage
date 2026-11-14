-- billing_invoices n'a volontairement AUCUNE foreign key vers auth.users.
-- Ces lignes sont des données comptables (factures) soumises à une
-- obligation légale de conservation de 10 ans (Code de commerce art.
-- L.123-22), qui doit survivre à la suppression d'un compte utilisateur
-- (RGPD art. 17 — droit à l'effacement, pages/api/account/delete.ts).
--
-- Contrairement à subscriptions (clé primaire = user_id, cascade avec
-- auth.users, archivée explicitement dans billing_retention_archive avant
-- suppression), billing_invoices n'a jamais eu de FK du tout — ses lignes
-- survivent donc déjà par absence de contrainte, pas par archivage actif.
-- Ce commentaire documente que c'est voulu : NE JAMAIS ajouter de foreign
-- key avec CASCADE sur billing_invoices.user_id, ça supprimerait
-- silencieusement des factures légalement protégées. Si une FK est
-- nécessaire un jour pour l'intégrité des données, utiliser
-- "on delete set null" ou passer par un archivage explicite comme pour
-- subscriptions — jamais un cascade direct.
comment on table public.billing_invoices is
  'Factures Stripe. AUCUNE FK vers auth.users par design (conservation légale 10 ans, Code de commerce art. L.123-22) — ne jamais ajouter de FK avec CASCADE sur user_id, voir pages/api/account/delete.ts.';

comment on column public.billing_invoices.user_id is
  'Référence auth.users SANS contrainte FK, volontairement — doit survivre à la suppression du compte (obligation comptable 10 ans). Ne pas ajouter de FK CASCADE.';
