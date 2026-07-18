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
