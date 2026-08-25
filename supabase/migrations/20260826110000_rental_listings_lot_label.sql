-- Libellé du lot figé au moment de la création de l'annonce, comme title/address/surface_m2
-- déjà dénormalisés sur cette table — évite un join vers property_lots pour la page publique.
alter table public.rental_listings add column if not exists lot_label text;

notify pgrst, 'reload schema';
