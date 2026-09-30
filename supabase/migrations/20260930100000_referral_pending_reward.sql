-- Un parrain sans abonnement actif au moment où son filleul souscrit ne
-- recevait jamais sa récompense : applyReferralReward() cherchait un
-- abonnement Stripe actif à appliquer le coupon, et abandonnait
-- silencieusement si aucun n'existait — sans rattrapage si le parrain
-- s'abonnait plus tard lui-même. Colonne pour mémoriser la récompense due
-- et l'appliquer dès que ce parrain souscrit à son tour.
alter table public.profiles add column if not exists referral_reward_pending_since timestamptz;
