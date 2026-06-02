delete from public.transactions partial_tx
using public.rent_receipts receipt, public.rent_payments payment
where partial_tx.lease_id = receipt.lease_id
  and partial_tx.receipt_id is null
  and partial_tx.category = 'rent'
  and partial_tx.label = 'Paiement partiel loyer'
  and partial_tx.occurred_at = receipt.period_end
  and payment.lease_id = receipt.lease_id
  and payment.period_start = receipt.period_start
  and payment.period_end = receipt.period_end
  and payment.paid_at is not null
  and payment.total_amount + 0.01 >= receipt.total_amount;
