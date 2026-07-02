-- Raison sociale / SCI pour les bailleurs en société
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS company_name TEXT;
