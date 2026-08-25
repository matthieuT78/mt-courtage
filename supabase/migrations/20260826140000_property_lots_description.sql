-- Dernière caractéristique manquante pour qu'un lot soit un bien à part entière :
-- la description libre (étage, balcon, etc.), déjà disponible sur un bien simple.
alter table public.property_lots add column if not exists description text;

notify pgrst, 'reload schema';
