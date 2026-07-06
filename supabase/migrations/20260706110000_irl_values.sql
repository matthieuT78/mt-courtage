-- Table IRL pour mise à jour sans redéploiement
CREATE TABLE IF NOT EXISTS public.irl_values (
  quarter    TEXT PRIMARY KEY,          -- "2026-T1"
  label      TEXT NOT NULL,             -- "T1 2026"
  value      NUMERIC(10, 2) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed depuis les valeurs connues
INSERT INTO public.irl_values (quarter, label, value) VALUES
  ('2026-T1', 'T1 2026', 151.34),
  ('2025-T4', 'T4 2025', 150.61),
  ('2025-T3', 'T3 2025', 149.95),
  ('2025-T2', 'T2 2025', 149.12),
  ('2025-T1', 'T1 2025', 148.09),
  ('2024-T4', 'T4 2024', 147.34),
  ('2024-T3', 'T3 2024', 146.71),
  ('2024-T2', 'T2 2024', 146.01),
  ('2024-T1', 'T1 2024', 145.57),
  ('2023-T4', 'T4 2023', 143.47),
  ('2023-T3', 'T3 2023', 142.12),
  ('2023-T2', 'T2 2023', 141.43),
  ('2023-T1', 'T1 2023', 140.59),
  ('2022-T4', 'T4 2022', 138.26),
  ('2022-T3', 'T3 2022', 136.27),
  ('2022-T2', 'T2 2022', 133.93),
  ('2022-T1', 'T1 2022', 133.40),
  ('2021-T4', 'T4 2021', 131.67),
  ('2021-T3', 'T3 2021', 131.12),
  ('2021-T2', 'T2 2021', 130.26),
  ('2021-T1', 'T1 2021', 129.72),
  ('2020-T4', 'T4 2020', 130.26),
  ('2020-T3', 'T3 2020', 130.07),
  ('2020-T2', 'T2 2020', 130.26),
  ('2020-T1', 'T1 2020', 130.57),
  ('2019-T4', 'T4 2019', 130.84),
  ('2019-T3', 'T3 2019', 130.57),
  ('2019-T2', 'T2 2019', 130.26),
  ('2019-T1', 'T1 2019', 129.38),
  ('2018-T4', 'T4 2018', 129.38),
  ('2018-T3', 'T3 2018', 128.82),
  ('2018-T2', 'T2 2018', 128.45),
  ('2018-T1', 'T1 2018', 127.77)
ON CONFLICT (quarter) DO NOTHING;

-- RLS : lecture publique (données publiques INSEE), écriture service role uniquement
ALTER TABLE public.irl_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "irl_values_select" ON public.irl_values
  FOR SELECT USING (true);
