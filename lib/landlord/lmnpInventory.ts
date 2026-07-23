export type LmnpInventoryStatus = "ok" | "missing" | "partial" | "replace";

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
  status?: string | null;
  lease_kind?: string | null;
};

// Un bien doit respecter la liste des 18 meubles obligatoires s'il est loué
// meublé — déterminé par le type de bail actif (furnished_primary,
// furnished_student, mobility — un bail mobilité est toujours meublé par la
// loi), pas seulement par le régime fiscal LMNP choisi en Finance : les deux
// notions sont liées mais indépendantes (un bien peut être meublé sans être
// déclaré en LMNP pour des raisons fiscales propres au bailleur). On combine
// les deux signaux plutôt que de remplacer l'un par l'autre, pour ne jamais
// faire perdre la visibilité à un bien déjà suivi via son régime fiscal.
export function propertyRequiresLmnpInventory(
  propertyId: string,
  taxRegime: string | null | undefined,
  leases: LmnpLeaseLike[] | null | undefined
): boolean {
  const isLmnpTaxRegime = taxRegime === "lmnp_micro" || taxRegime === "lmnp_real";
  const hasFurnishedActiveLease = (leases || []).some(
    (l) =>
      l.property_id === propertyId &&
      String(l.status || "").toLowerCase() === "active" &&
      FURNISHED_LEASE_KINDS.has(String(l.lease_kind || ""))
  );
  return isLmnpTaxRegime || hasFurnishedActiveLease;
}
