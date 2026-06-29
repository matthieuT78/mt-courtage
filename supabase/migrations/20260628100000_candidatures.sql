-- Dossier de candidature numérique
-- Permet au bailleur de créer un lien de candidature et aux candidats de soumettre leur dossier

-- ── Annonces de mise en location ──────────────────────────────
CREATE TABLE IF NOT EXISTS rental_listings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id     uuid REFERENCES properties(id) ON DELETE SET NULL,
  token           text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  title           text NOT NULL,
  address         text,
  rent_amount     numeric(10,2) NOT NULL,
  charges_amount  numeric(10,2) NOT NULL DEFAULT 0,
  property_type   text NOT NULL DEFAULT 'vide', -- 'vide' | 'meuble'
  surface_m2      numeric(6,1),
  available_at    date,
  income_ratio    numeric(4,1) NOT NULL DEFAULT 3,  -- ratio revenus/loyer requis
  status          text NOT NULL DEFAULT 'active',   -- 'active' | 'closed' | 'archived'
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ── Candidatures ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS candidatures (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id      uuid NOT NULL REFERENCES rental_listings(id) ON DELETE CASCADE,
  token           text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(12), 'hex'),
  status          text NOT NULL DEFAULT 'draft', -- 'draft' | 'submitted' | 'accepted' | 'rejected' | 'waitlist'

  -- Identité candidat
  first_name      text,
  last_name       text,
  email           text,
  phone           text,
  birth_date      date,

  -- Situation professionnelle
  professional_situation  text,  -- 'CDI' | 'CDD' | 'independant' | 'fonctionnaire' | 'etudiant' | 'retraite' | 'autre'
  employer_name           text,
  net_monthly_income      numeric(10,2),

  -- Garant
  has_guarantor           boolean NOT NULL DEFAULT false,
  guarantor_first_name    text,
  guarantor_last_name     text,
  guarantor_email         text,
  guarantor_situation     text,
  guarantor_income        numeric(10,2),

  -- Complétude des documents
  docs_identity    boolean NOT NULL DEFAULT false,
  docs_payslips    boolean NOT NULL DEFAULT false,
  docs_tax         boolean NOT NULL DEFAULT false,
  docs_address     boolean NOT NULL DEFAULT false,

  -- Note bailleur
  landlord_note    text,

  submitted_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ── RLS ────────────────────────────────────────────────────────
ALTER TABLE rental_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidatures    ENABLE ROW LEVEL SECURITY;

-- Drop policies first to allow re-running the migration
DROP POLICY IF EXISTS "landlord_owns_listing"        ON rental_listings;
DROP POLICY IF EXISTS "landlord_sees_candidatures"   ON candidatures;
DROP POLICY IF EXISTS "landlord_updates_candidatures" ON candidatures;
DROP POLICY IF EXISTS "candidate_reads_own"          ON candidatures;
DROP POLICY IF EXISTS "candidate_inserts"            ON candidatures;
DROP POLICY IF EXISTS "candidate_updates_own"        ON candidatures;

-- Bailleur : accès complet à ses annonces
CREATE POLICY "landlord_owns_listing"
  ON rental_listings FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Bailleur : accès à toutes les candidatures de ses annonces
CREATE POLICY "landlord_sees_candidatures"
  ON candidatures FOR SELECT
  USING (
    listing_id IN (
      SELECT id FROM rental_listings WHERE user_id = auth.uid()
    )
  );

-- Bailleur : peut modifier le statut et la note
CREATE POLICY "landlord_updates_candidatures"
  ON candidatures FOR UPDATE
  USING (
    listing_id IN (
      SELECT id FROM rental_listings WHERE user_id = auth.uid()
    )
  );

-- Candidat anonyme : lecture via token (filtrée côté API)
CREATE POLICY "candidate_reads_own"
  ON candidatures FOR SELECT
  USING (true);

-- Candidat anonyme : insertion d'une candidature
CREATE POLICY "candidate_inserts"
  ON candidatures FOR INSERT
  WITH CHECK (true);

-- Candidat anonyme : mise à jour de son propre dossier avant soumission
CREATE POLICY "candidate_updates_own"
  ON candidatures FOR UPDATE
  USING (status = 'draft');

-- ── Index ──────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_rental_listings_user_id  ON rental_listings(user_id);
CREATE INDEX IF NOT EXISTS idx_rental_listings_token    ON rental_listings(token);
CREATE INDEX IF NOT EXISTS idx_candidatures_listing_id  ON candidatures(listing_id);
CREATE INDEX IF NOT EXISTS idx_candidatures_token       ON candidatures(token);
CREATE INDEX IF NOT EXISTS idx_candidatures_status      ON candidatures(status);
CREATE INDEX IF NOT EXISTS idx_candidatures_email       ON candidatures(email);
