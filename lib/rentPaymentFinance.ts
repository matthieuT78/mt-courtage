import { supabaseAdmin } from "./supabaseAdmin";

export async function removeTrackedPartialPaymentTransactions(params: {
  leaseId: string;
  periodStart: string;
  periodEnd: string;
}) {
  if (!supabaseAdmin) throw new Error("Supabase admin non configuré.");

  const { error } = await supabaseAdmin
    .from("transactions")
    .delete()
    .eq("lease_id", params.leaseId)
    .is("receipt_id", null)
    .eq("category", "rent")
    .eq("label", "Paiement partiel loyer")
    .eq("occurred_at", params.periodEnd || params.periodStart);

  if (error) throw error;
}

// Label dédié aux baux "quittances agence" (receipts_disabled) : ces paiements
// n'ont jamais de quittance lokt, donc pas de receipt_id — cette écriture Finance
// est la seule trace du paiement pour ces baux.
const DELEGATED_RENT_LABEL = "Loyer (gestion agence)";

export async function syncDelegatedRentTransaction(params: {
  userId: string;
  propertyId?: string | null;
  leaseId: string;
  periodStart: string;
  periodEnd: string;
  amount: number;
}) {
  if (!supabaseAdmin) throw new Error("Supabase admin non configuré.");
  const occurredAt = (params.periodEnd || params.periodStart || "").slice(0, 10);

  const del = await supabaseAdmin
    .from("transactions")
    .delete()
    .eq("user_id", params.userId)
    .eq("lease_id", params.leaseId)
    .is("receipt_id", null)
    .eq("category", "rent")
    .eq("label", DELEGATED_RENT_LABEL)
    .eq("occurred_at", occurredAt);
  if (del.error) throw del.error;

  if (params.amount <= 0) return;

  const ins = await supabaseAdmin.from("transactions").insert({
    user_id: params.userId,
    property_id: params.propertyId ?? null,
    lease_id: params.leaseId,
    receipt_id: null,
    occurred_at: occurredAt,
    direction: "in",
    status: "received",
    category: "rent",
    label: DELEGATED_RENT_LABEL,
    amount: params.amount,
    notes: null,
    updated_at: new Date().toISOString(),
  } as any);
  if (ins.error) throw ins.error;
}
