-- Tantièmes de copropriété : saisis une fois par l'utilisateur dans l'outil
-- "Répartition des charges", réutilisés automatiquement les années suivantes
-- plutôt que ressaisis à chaque répartition. Valeur légale externe à lokt
-- (règlement de copropriété), jamais déduite automatiquement.

alter table public.properties add column if not exists tantiemes_base numeric;
alter table public.property_lots add column if not exists tantiemes numeric;

notify pgrst, 'reload schema';
