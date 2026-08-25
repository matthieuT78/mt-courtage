-- L'inventaire LMNP (mobilier obligatoire) devient conscient des lots : un immeuble
-- à plusieurs lots peut avoir un mobilier distinct par lot, chacun avec son propre
-- statut de conformité. Nullable : les biens simples (jamais de lot) et les lots
-- déjà créés avant cette migration ne sont pas affectés.
alter table public.property_inventory_items add column if not exists lot_id uuid references public.property_lots(id) on delete set null;
create index if not exists property_inventory_items_lot_id_idx on public.property_inventory_items (lot_id);

notify pgrst, 'reload schema';
