-- Passe les dossiers fiscaux au niveau catégorie (LMNP / Nu / Pinel)
-- au lieu du niveau bien individuel.
-- En droit fiscal français, le régime micro/réel s'applique
-- à l'ensemble des biens d'une même catégorie — pas bien par bien.

-- 1. Supprimer les doublons en gardant le plus récemment mis à jour
--    pour chaque (user_id, year, regime)
delete from public.tax_declarations a
  using public.tax_declarations b
  where a.updated_at < b.updated_at
    and a.user_id = b.user_id
    and a.year = b.year
    and a.regime = b.regime
    and a.id != b.id;

-- 2. Supprimer l'ancienne contrainte par bien
alter table public.tax_declarations
  drop constraint if exists tax_declarations_user_year_regime_property_key;

-- 3. Ajouter la nouvelle contrainte par catégorie fiscale
alter table public.tax_declarations
  drop constraint if exists tax_declarations_user_id_year_regime_key;

alter table public.tax_declarations
  add constraint tax_declarations_user_id_year_regime_key
  unique (user_id, year, regime);
