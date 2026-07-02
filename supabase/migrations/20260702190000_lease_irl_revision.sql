ALTER TABLE public.leases
  ADD COLUMN IF NOT EXISTS irl_sent_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS irl_sent_ref_quarter TEXT,
  ADD COLUMN IF NOT EXISTS irl_sent_new_quarter TEXT,
  ADD COLUMN IF NOT EXISTS irl_sent_new_rent    NUMERIC,
  ADD COLUMN IF NOT EXISTS irl_apply_on         DATE,
  ADD COLUMN IF NOT EXISTS irl_applied_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS irl_previous_rent    NUMERIC;

CREATE INDEX IF NOT EXISTS leases_irl_apply_on_idx ON public.leases (irl_apply_on)
  WHERE irl_apply_on IS NOT NULL AND irl_applied_at IS NULL;
