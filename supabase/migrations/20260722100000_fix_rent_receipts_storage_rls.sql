-- CRITIQUE — les policies de stockage live sur le bucket rent-receipts-pdfs
-- (jamais suivies dans une migration, appliquées hors dépôt) accordaient SELECT/
-- INSERT/UPDATE à tout utilisateur "authenticated", sans filtrer par propriétaire.
-- Vérifié en conditions réelles le 22/07 : un compte locataire A, sans aucune
-- relation avec le bailleur B, a pu lire ET écraser la quittance PDF d'un
-- locataire de B en appelant directement l'API Storage, en contournant
-- entièrement /api/tenant-portal/document-url.ts (dont la logique d'autorisation
-- côté route est correcte, mais inopérante puisque le stockage sous-jacent
-- n'était pas verrouillé).
--
-- Correctif : mêmes policies propriétaire-scopées que lease-contract-pdfs et
-- property-dpe-pdfs (le chemin de fichier commence par ${landlord_user_id}/...,
-- donc seul le compte bailleur propriétaire peut lire/écrire directement).
-- L'accès locataire continue de fonctionner normalement : il passe uniquement
-- par des URLs signées générées côté serveur (rôle service, hors RLS) dans
-- /api/tenant-portal/document-url.ts, qui vérifie déjà que le document demandé
-- appartient bien à une location du locataire appelant.

drop policy if exists "read receipts pdf via signed url" on storage.objects;
drop policy if exists "update receipts pdf (service role only)" on storage.objects;
drop policy if exists "upload receipts pdf (service role only)" on storage.objects;

create policy rent_receipts_pdfs_select_own on storage.objects
  for select
  using (bucket_id = 'rent-receipts-pdfs' and (storage.foldername(name))[1] = auth.uid()::text);

create policy rent_receipts_pdfs_insert_own on storage.objects
  for insert
  with check (bucket_id = 'rent-receipts-pdfs' and (storage.foldername(name))[1] = auth.uid()::text);

create policy rent_receipts_pdfs_update_own on storage.objects
  for update
  using (bucket_id = 'rent-receipts-pdfs' and (storage.foldername(name))[1] = auth.uid()::text);
