-- Permet de repérer, dans un état des lieux, les lignes préremplies depuis
-- l'inventaire LMNP du bien (par opposition aux éléments saisis librement
-- par le bailleur) — sert de pont entre les deux fonctionnalités sans les
-- fusionner : préremplissage à l'entrée, alerte et resynchronisation à la
-- sortie.
alter table public.inventory_items
  add column if not exists is_lmnp_required boolean not null default false;

notify pgrst, 'reload schema';
