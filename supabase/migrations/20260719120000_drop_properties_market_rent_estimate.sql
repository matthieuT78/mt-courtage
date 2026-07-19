-- Retiré : le champ était rempli par le bailleur lui-même (pas une source fiable),
-- et pour un logement vide sur le point d'être loué, la valeur converge trivialement
-- avec le loyer réel du bail, rendant la comparaison "loyer vs marché" dans Performance
-- sans valeur ajoutée.
alter table public.properties
  drop column if exists market_rent_estimate;
