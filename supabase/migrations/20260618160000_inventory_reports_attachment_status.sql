-- Statut de rattachement de l'état des lieux à un bail
-- "attached" = lié à un bail, "standalone" = document autonome
ALTER TABLE inventory_reports
  ADD COLUMN IF NOT EXISTS attachment_status text CHECK (attachment_status IN ('attached', 'standalone'));
