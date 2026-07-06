-- Contrôle de la messagerie par bail dans le portail locataire
ALTER TABLE public.tenant_portal_access
  ADD COLUMN IF NOT EXISTS messaging_enabled BOOLEAN NOT NULL DEFAULT true;
