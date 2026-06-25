-- Charges récurrentes dans le grand livre.
-- is_recurring = true : transaction-définition (template), alimente la courbe
--   structurelle du graphe Finance et contient recurrence_*.
-- recurrence_parent_id non null : instance générée automatiquement à partir
--   de la définition ; apparaît dans le grand livre comme une écriture réelle.
-- Le parent lui-même est aussi la première occurrence (occurred_at = recurrence_since).

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS is_recurring         boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS recurrence_frequency text    CHECK (recurrence_frequency IN ('monthly', 'quarterly', 'yearly')),
  ADD COLUMN IF NOT EXISTS recurrence_since     date,
  ADD COLUMN IF NOT EXISTS recurrence_end_date  date,
  ADD COLUMN IF NOT EXISTS recurrence_parent_id uuid    REFERENCES transactions(id) ON DELETE CASCADE;
