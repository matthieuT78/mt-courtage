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
