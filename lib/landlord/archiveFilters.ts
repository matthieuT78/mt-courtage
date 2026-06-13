type IdLike = { id?: string | null };

const normalizedStatus = (value: unknown) => String(value || "").trim().toLowerCase();

export function isActivePropertyLike(item: any) {
  const status = normalizedStatus(item?.status || "active");
  return status !== "archived" && status !== "inactive" && status !== "deleted";
}

export function isActiveTenantLike(item: any) {
  const status = normalizedStatus(item?.status || "active");
  return !item?.archived_at && status !== "archived" && status !== "inactive" && status !== "deleted";
}

export function isSelectableLeaseLike(item: any) {
  const status = normalizedStatus(item?.status || "active");
  return status === "active" || (!status && !!item?.start_date);
}

export function includeSelected<T extends IdLike>(activeItems: T[], allItems: T[], selectedId?: string | null) {
  if (!selectedId || activeItems.some((item) => String(item.id || "") === String(selectedId))) return activeItems;
  const selected = allItems.find((item) => String(item.id || "") === String(selectedId));
  return selected ? [selected, ...activeItems] : activeItems;
}
