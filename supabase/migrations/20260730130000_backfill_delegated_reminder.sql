-- Jusqu'ici, déléguer la gestion courante à une agence désactivait automatiquement
-- auto_reminder_enabled sur le bail, empêchant tout rappel email de confirmation de
-- paiement — alors que ce rappel ne sert qu'à alimenter le suivi Finance du bailleur
-- (aucune quittance n'est générée pour ces baux, cf. lib/receiptWorkflow.ts).
-- On rattrape les baux existants pour qu'ils bénéficient du correctif sans attendre
-- que le bailleur rouvre et resauvegarde chacun d'entre eux manuellement.

update public.leases
set auto_reminder_enabled = true,
    updated_at = now()
where receipts_disabled = true
  and auto_reminder_enabled = false;
