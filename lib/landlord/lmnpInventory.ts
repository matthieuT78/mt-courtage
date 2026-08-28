export type LmnpInventoryStatus = "ok" | "missing" | "partial" | "replace";

// Les 18 éléments obligatoires pour un logement meublé (décret n° 2015-981) —
// source unique utilisée à la fois par la section Inventaire (initialisation
// de la liste) et par l'assistant IA (calcul de ce qui manque sans dupliquer
// la liste réglementaire à deux endroits).
export const LMNP_REQUIRED_ITEMS = [
  { room: "Chambre", category: "Literie", label: "Literie avec couette ou couverture", required_quantity: 1 },
  { room: "Chambre", category: "Occultation", label: "Volets, stores ou rideaux dans les chambres", required_quantity: 1 },
  { room: "Cuisine", category: "Cuisson", label: "Plaques de cuisson", required_quantity: 1 },
  { room: "Cuisine", category: "Cuisson", label: "Four ou four micro-ondes", required_quantity: 1 },
  { room: "Cuisine", category: "Froid", label: "Réfrigérateur avec congélateur ou freezer", required_quantity: 1 },
  // Le décret n° 2015-981 impose une "vaisselle nécessaire à la prise des repas"
  // sans fixer de quantité — la pratique du secteur retient 4 à 6 couverts pour
  // un studio (majorité du parc LMNP) ; on part sur 4, borne basse prudente.
  { room: "Cuisine", category: "Vaisselle", label: "Assiettes", required_quantity: 4 },
  { room: "Cuisine", category: "Vaisselle", label: "Verres", required_quantity: 4 },
  { room: "Cuisine", category: "Vaisselle", label: "Bols", required_quantity: 4 },
  { room: "Cuisine", category: "Ustensiles", label: "Fourchettes", required_quantity: 4 },
  { room: "Cuisine", category: "Ustensiles", label: "Couteaux", required_quantity: 4 },
  { room: "Cuisine", category: "Ustensiles", label: "Cuillères", required_quantity: 4 },
  { room: "Cuisine", category: "Ustensiles", label: "Ustensiles de cuisine", required_quantity: 1 },
  { room: "Cuisine", category: "Cuisson", label: "Casseroles et poêles", required_quantity: 1 },
  { room: "Séjour", category: "Mobilier", label: "Table", required_quantity: 1 },
  { room: "Séjour", category: "Mobilier", label: "Sièges", required_quantity: 2 },
  { room: "Rangement", category: "Mobilier", label: "Étagères ou rangements", required_quantity: 1 },
  { room: "Toutes pièces", category: "Éclairage", label: "Luminaires", required_quantity: 1 },
  { room: "Entretien", category: "Ménage", label: "Matériel d’entretien adapté au logement", required_quantity: 1 },
] as const;

export type LmnpInventoryItemLike = {
  actual_quantity?: number | null;
  required_quantity?: number | null;
  condition?: string | null;
};

// Source unique de vérité pour "cet élément est-il conforme ?" — utilisée à
// la fois par la section Inventaire (détail par bien) et le cockpit
// (badge de conformité), pour ne jamais afficher deux pourcentages différents
// sur le même bien.
export function getLmnpItemStatus(item: LmnpInventoryItemLike): LmnpInventoryStatus {
  if (item.condition === "a_remplacer") return "replace";
  const actual = Number(item.actual_quantity || 0);
  const required = Number(item.required_quantity || 0);
  if (actual <= 0) return "missing";
  if (actual < required) return "partial";
  return "ok";
}

export function isLmnpItemCompliant(item: LmnpInventoryItemLike): boolean {
  return getLmnpItemStatus(item) === "ok";
}

const FURNISHED_LEASE_KINDS = new Set(["furnished_primary", "furnished_student", "mobility"]);

export type LmnpLeaseLike = {
  property_id: string;
  lot_id?: string | null;
  status?: string | null;
  lease_kind?: string | null;
};

export type LmnpPropertyLike = {
  id: string;
  delegated_services?: string[] | null;
};

// Un bien doit respecter la liste des 18 meubles obligatoires s'il est loué
// meublé — déterminé UNIQUEMENT par le type de bail actif (furnished_primary,
// furnished_student, mobility — un bail mobilité est toujours meublé par la
// loi). Le régime fiscal choisi en Finance (property_finance.tax_regime :
// lmnp_micro/lmnp_real/nu_micro/nu_real/pinel) répond à une question
// différente — "quel régime fiscal le bailleur a-t-il choisi" — et reste
// facultatif/souvent non renseigné, contrairement au type de bail qui est
// obligatoire à la création. Volontairement une seule source de vérité ici :
// pas de second signal fiscal qui rendrait le déclenchement imprévisible
// selon que Finance a été rempli ou non.
//
// Exception : un bien dont le bail ET l'état des lieux sont délégués à une
// agence (delegated_services contient "bail_edl") n'est jamais soumis à
// l'inventaire LMNP de lokt.fr, quel que soit lease_kind — ce n'est pas le
// bailleur qui gère ce document légal ici, donc lokt.fr n'a pas à lui
// imposer son propre suivi.
export function propertyRequiresLmnpInventory(
  propertyId: string,
  leases: LmnpLeaseLike[] | null | undefined,
  properties?: LmnpPropertyLike[] | null
): boolean {
  if (properties) {
    const property = properties.find((p) => p.id === propertyId);
    if (property?.delegated_services?.includes("bail_edl")) return false;
  }
  return (leases || []).some(
    (l) =>
      l.property_id === propertyId &&
      String(l.status || "").toLowerCase() === "active" &&
      FURNISHED_LEASE_KINDS.has(String(l.lease_kind || ""))
  );
}

// Variante par lot, pour un immeuble à plusieurs lots : chaque lot a son
// propre bail, donc sa propre obligation LMNP — un lot loué nu dans un
// immeuble dont un autre lot est meublé ne doit pas être soumis à
// l'inventaire pour autant.
export function lotRequiresLmnpInventory(lotId: string, leases: LmnpLeaseLike[] | null | undefined): boolean {
  return (leases || []).some(
    (l) =>
      l.lot_id === lotId &&
      String(l.status || "").toLowerCase() === "active" &&
      FURNISHED_LEASE_KINDS.has(String(l.lease_kind || ""))
  );
}

// Point d'entrée unique pour "ce bail donné doit-il suivre l'inventaire LMNP ?" —
// bascule automatiquement sur la vérification par lot si le bail en a un
// (immeuble), sinon la vérification par bien habituelle.
export function leaseRequiresLmnpInventory(
  lease: LmnpLeaseLike | null | undefined,
  leases: LmnpLeaseLike[] | null | undefined,
  properties?: LmnpPropertyLike[] | null
): boolean {
  if (!lease) return false;
  if (lease.lot_id) return lotRequiresLmnpInventory(lease.lot_id, leases);
  return propertyRequiresLmnpInventory(lease.property_id, leases, properties);
}
