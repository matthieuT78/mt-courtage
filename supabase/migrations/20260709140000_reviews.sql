CREATE TABLE reviews (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email           text NOT NULL,
  name            text,
  note            integer NOT NULL CHECK (note BETWEEN 1 AND 5),
  commentaire     text NOT NULL,
  source          text DEFAULT 'direct',
  approved        boolean DEFAULT false,
  approval_token  text UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reviews_insert_public"
  ON reviews FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "reviews_select_approved"
  ON reviews FOR SELECT TO anon, authenticated
  USING (approved = true);
