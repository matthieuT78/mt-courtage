-- Remplace docs_payslips (booléen unique) par 3 colonnes séparées (fiche M-1, M-2, M-3).
-- docs_payslips est conservé comme colonne calculée pour compatibilité descendante.

ALTER TABLE candidatures
  ADD COLUMN IF NOT EXISTS docs_payslip_1 boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS docs_payslip_2 boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS docs_payslip_3 boolean NOT NULL DEFAULT false;

-- Rétrograde : si docs_payslips était true, on marque au moins la fiche M-1
UPDATE candidatures SET docs_payslip_1 = true WHERE docs_payslips = true;
