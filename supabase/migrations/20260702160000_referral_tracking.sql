-- Colonnes parrainage sur profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_code        TEXT,
  ADD COLUMN IF NOT EXISTS referred_by          TEXT,
  ADD COLUMN IF NOT EXISTS referral_rewarded_at TIMESTAMPTZ;

-- Génère les codes pour les utilisateurs existants (même formule que le front)
UPDATE public.profiles
SET referral_code = UPPER(SUBSTRING(REPLACE(id::TEXT, '-', ''), 1, 8))
WHERE referral_code IS NULL;

-- Contrainte unicité (ne bloque pas si deux UUIDs partagent les mêmes 8 premiers hex — rare à cette échelle)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_referral_code_uidx
  ON public.profiles (referral_code)
  WHERE referral_code IS NOT NULL;

-- Index pour la recherche parrain → filleul
CREATE INDEX IF NOT EXISTS profiles_referred_by_idx
  ON public.profiles (referred_by)
  WHERE referred_by IS NOT NULL;
