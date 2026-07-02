CREATE TABLE IF NOT EXISTS public.app_reviews (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating      SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_reviews_user_idx ON public.app_reviews (user_id);

-- RLS : chaque utilisateur ne voit que ses propres avis
ALTER TABLE public.app_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user can insert own review"
  ON public.app_reviews FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user can read own review"
  ON public.app_reviews FOR SELECT
  USING (auth.uid() = user_id);
