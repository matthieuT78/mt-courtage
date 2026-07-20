CREATE TABLE signature_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  document_type text NOT NULL CHECK (document_type IN ('bail', 'edl')),
  document_label text,

  -- Références au document source
  lease_contract_id uuid,
  inventory_report_id uuid,
  lease_id uuid,
  property_id uuid,
  landlord_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,

  -- PDF original (bucket:path)
  original_pdf_url text NOT NULL,
  -- PDF estampillé une fois les deux signatures recueillies
  signed_pdf_url text,
  -- Hash SHA-256 du PDF original pour l'audit trail
  document_hash text,

  -- Bailleur
  landlord_email text NOT NULL,
  landlord_name text,
  landlord_token text UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  landlord_signed_at timestamptz,
  landlord_ip text,
  landlord_user_agent text,

  -- Locataire
  tenant_email text NOT NULL,
  tenant_name text,
  tenant_token text UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  tenant_signed_at timestamptz,
  tenant_ip text,
  tenant_user_agent text,

  status text DEFAULT 'pending' CHECK (status IN ('pending', 'partially_signed', 'completed', 'expired', 'cancelled')),

  expires_at timestamptz DEFAULT now() + interval '7 days',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE signature_requests ENABLE ROW LEVEL SECURITY;

-- Le bailleur voit ses propres demandes
CREATE POLICY "sig_select_landlord" ON signature_requests
  FOR SELECT TO authenticated
  USING (landlord_id = auth.uid());

-- Création par le bailleur authentifié
CREATE POLICY "sig_insert_landlord" ON signature_requests
  FOR INSERT TO authenticated
  WITH CHECK (landlord_id = auth.uid());

-- Mise à jour par service role uniquement (confirm endpoint)
-- Les updates publics passent par supabaseAdmin dans l'API
