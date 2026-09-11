// lib/landlord/leaseTransition.ts
//
// Logique pure (sans React) derrière le panneau "Logement en transition" —
// extraite de TransitionPanel.tsx pour rester testable en isolation, sans
// tirer les dépendances React/Supabase du composant.
import type { Lease, Property } from "./types";
import { computeLeaseWatchInfo } from "./leaseRenewal";

export function isInTransition(lease: Lease, allLeases: Lease[], propertyById: Map<string, Property>, now: Date = new Date()): boolean {
  const status = String(lease.status || "").toLowerCase();
  if (!["active", "ended"].includes(status)) return false;
  if (!lease.end_date) return false;

  // Un bien archivé n'est plus géré activement — ne pas relancer sa remise
  // en location (annonce, candidats...) ni sa caution ici. Le propriétaire
  // a explicitement sorti ce bien de la gestion active.
  const property = propertyById.get(lease.property_id);
  if (String(property?.status || "").toLowerCase() === "archived") return false;

  // Échéance réelle (reconduction tacite déroulée) pour un bail encore actif —
  // sinon un bail reconduit depuis longtemps, dont la date de fin d'origine
  // reste dans le passé, ne serait jamais détecté ici même si son échéance
  // courante approche vraiment. Un bail "ended" a une fin définitive : pas de
  // reconduction à dérouler.
  let endDate: Date;
  if (status === "active") {
    const watchInfo = computeLeaseWatchInfo(lease, now);
    if (!watchInfo.watchDate) return false;
    // Tant que la reconduction tacite s'applique (type de bail concerné, et
    // case "reconduction tacite" toujours cochée), le bail continue tout seul
    // sans action du bailleur : afficher "en transition" 6 mois avant chaque
    // anniversaire serait un faux signal ("Départ de locataire" alors que
    // rien n'indique un départ). Seul un bail sans reconduction (mobilité,
    // étudiant, "autre") ou dont le bailleur a explicitement décoché la
    // reconduction (congé donné, décision prise) doit apparaître ici.
    if (watchInfo.renewalEnabled) return false;
    endDate = watchInfo.watchDate;
  } else {
    endDate = new Date(lease.end_date + "T00:00:00");
  }
  const sixMonthsAhead = new Date(now.getFullYear(), now.getMonth() + 6, now.getDate());
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 86400000);

  if (endDate < ninetyDaysAgo || endDate > sixMonthsAhead) return false;

  // A lease with "ended" status and any active successor for the same property
  // is no longer in transition (property is already re-rented)
  if (status === "ended") {
    const hasActiveSuccessor = allLeases.some(
      (l) =>
        l.id !== lease.id &&
        l.property_id === lease.property_id &&
        String(l.status || "").toLowerCase() === "active"
    );
    if (hasActiveSuccessor) return false;
  }

  // Comparé à endDate (échéance réelle recalculée), pas à lease.end_date brut :
  // sur un bail déjà reconduit plusieurs fois, la date brute peut être très
  // ancienne et ferait manquer un successeur dont le début se situe après la
  // vraie échéance courante mais avant l'ancienne date contractuelle.
  const hasSuccessor = allLeases.some(
    (l) =>
      l.id !== lease.id &&
      l.property_id === lease.property_id &&
      String(l.status || "").toLowerCase() === "active" &&
      new Date(l.start_date + "T00:00:00") >= endDate  // >= handles same-day handover
  );
  return !hasSuccessor;
}
