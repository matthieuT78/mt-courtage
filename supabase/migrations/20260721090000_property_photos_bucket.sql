-- Le bucket "property-photos" n'a jamais existé : chaque upload de photo de bien
-- échouait silencieusement à l'étape de stockage (le fichier n'était jamais reçu),
-- et l'insertion en base échouait ensuite aussi (mauvais nom de colonne côté appli,
-- corrigé séparément). Ce bucket est public : les photos de biens ne sont pas des
-- documents sensibles et sont déjà servies via getPublicUrl côté appli.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('property-photos', 'property-photos', true, 2097152, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update
set public = true,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists property_photos_insert_own on storage.objects;
create policy property_photos_insert_own
  on storage.objects for insert
  with check (
    bucket_id = 'property-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists property_photos_update_own on storage.objects;
create policy property_photos_update_own
  on storage.objects for update
  using (
    bucket_id = 'property-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'property-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists property_photos_delete_own on storage.objects;
create policy property_photos_delete_own
  on storage.objects for delete
  using (
    bucket_id = 'property-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

notify pgrst, 'reload schema';
