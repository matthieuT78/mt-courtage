-- Un lot doit être traité comme un bien à part entière : ses caractéristiques
-- physiques (surface, pièces, DPE/GES) lui appartiennent, pas à l'immeuble dans son
-- ensemble — un immeuble n'a pas une seule surface ou un seul DPE représentatifs.
alter table public.property_lots add column if not exists rooms integer;
alter table public.property_lots add column if not exists energy_class text;
alter table public.property_lots add column if not exists energy_value numeric;
alter table public.property_lots add column if not exists ghg_class text;

-- DPE archivé par lot (un immeuble à plusieurs lots a un DPE par logement, pas un
-- DPE unique pour tout le bâtiment).
alter table public.property_dpe_documents add column if not exists lot_id uuid references public.property_lots(id) on delete cascade;
create index if not exists property_dpe_documents_lot_id_idx on public.property_dpe_documents (lot_id);

notify pgrst, 'reload schema';
