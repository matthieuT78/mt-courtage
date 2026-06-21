-- Table pour persister les accusés de réception de documents
CREATE TABLE IF NOT EXISTS document_acknowledgments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_user_id uuid NOT NULL,
  document_type text NOT NULL,
  document_id uuid NOT NULL,
  tenant_id uuid,
  tenant_email text,
  acknowledged_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(document_type, document_id)
);

CREATE INDEX IF NOT EXISTS idx_doc_ack_landlord
  ON document_acknowledgments(landlord_user_id);

-- Tracking du partage de bail
ALTER TABLE lease_contract_documents
  ADD COLUMN IF NOT EXISTS shared_with_tenant_at timestamptz,
  ADD COLUMN IF NOT EXISTS shared_to_tenant_email text;
