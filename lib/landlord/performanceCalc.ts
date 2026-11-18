// Logique de revenu/dépense partagée par SectionPerformance et SectionFinance (cashflow, TRI,
// alertes, recettes/dépenses) et leurs tests. Extraite pour rester testable sans monter de
// composant React, et pour que les deux sections restent nécessairement d'accord sur ce qui
// compte comme revenu/dépense — voir tests/unit/performanceCalc.test.ts, qui couvre les
// incidents du 2026-11 : double comptage du loyer pour les baux en gestion déléguée, ratio
// "charges/loyer" gonflé faute de ramener les dépenses ponctuelles à un montant mensuel, et
// retenue sur caution comptée à tort comme un revenu locatif.

// Label dédié aux baux "quittances agence" (receipts_disabled), écrit par
// syncDelegatedRentTransaction (lib/rentPaymentFinance.ts) : ces paiements n'ont jamais de
// quittance lokt, donc jamais de receipt_id, mais existent déjà dans rent_payments. Défini ici
// (fichier sans dépendance serveur) plutôt que dans rentPaymentFinance.ts, qui importe
// supabaseAdmin — SectionPerformance.tsx est un composant client et ne doit pas embarquer ce
// genre de dépendance côté navigateur juste pour lire une constante.
export const DELEGATED_RENT_LABEL = "Loyer (gestion agence)";

// "deposit_retained" (retenue sur caution en fin de bail, catégorie "in") est un mouvement de
// capital au même titre que deposit_collected/deposit_returned, pas un revenu locatif — déjà
// traité comme tel dans SectionDeclaration.tsx, mais manquait ici : une retenue de caution
// gonflait les recettes de Finance et Performance comme si c'était un loyer encaissé.
export const DEPOSIT_TRANSIT_CATEGORIES = ["deposit_collected", "deposit_returned", "deposit_retained"];

export type PerformanceTx = {
  direction: "in" | "out";
  category: string;
  status?: string | null;
  amount: number;
  label?: string | null;
  is_recurring?: boolean | null;
  recurrence_parent_id?: string | null;
  receipt_id?: string | null;
};

export function isReceivedIncome(row: PerformanceTx): boolean {
  const status = String(row.status || "").toLowerCase();
  return (
    row.direction === "in" &&
    (status === "received" || status === "paid") &&
    !DEPOSIT_TRANSIT_CATEGORIES.includes(row.category)
  );
}

// Lignes déjà comptées dans les charges récurrentes : à exclure des sommes ponctuelles
// (dépenses/recettes) pour éviter un double comptage avec le total récurrent.
export function isRecurringFlow(row: PerformanceTx): boolean {
  return Boolean(row.is_recurring || row.recurrence_parent_id);
}

// Revenu "loyer" présent dans `transactions` mais pas encore compté ailleurs par l'appelant
// (typiquement via rent_payments -> `received`). Exclut deux catégories de lignes qui
// existent déjà dans rent_payments sous une autre forme, sinon ce loyer serait compté deux
// fois : (1) les copies automatiques d'une quittance (receipt_id non nul, écrites par
// syncReceiptsToTransactions côté Finance), et (2) les lignes "Loyer (gestion agence)" des
// baux receipts_disabled (écrites par syncDelegatedRentTransaction, qui n'a jamais de
// receipt_id puisqu'il n'y a pas de quittance lokt — payments/confirm.ts écrit alors le même
// montant à la fois dans rent_payments ET dans transactions). Ne PAS exclure toute la
// catégorie "rent" : un loyer peut aussi être ajouté manuellement dans Finance (catégorie
// "Loyer (quittance)" sélectionnable à la main, receipt_id = null), et doit rester compté.
export function computeLedgerIncome(periodTx: PerformanceTx[]): number {
  return periodTx
    .filter(
      (row) =>
        !isRecurringFlow(row) &&
        isReceivedIncome(row) &&
        !row.receipt_id &&
        row.label !== DELEGATED_RENT_LABEL
    )
    .reduce((total, row) => total + Number(row.amount || 0), 0);
}

// Dépenses ponctuelles (hors charges récurrentes) ramenées à un montant mensuel — jamais le
// total brut sur la période sélectionnée. Un appelant qui compare ce montant à des valeurs
// mensuelles (loyer, charges récurrentes) doit utiliser cette fonction, jamais sommer les
// transactions brutes sans diviser par monthCount : sinon le ratio "charges/loyer" est gonflé
// d'un facteur ≈ monthCount (incident réel : 172 % affiché au lieu de 110 % sur une fenêtre de
// 6 mois).
export function computeExpenseMonthly(periodTx: PerformanceTx[], monthCount: number): number {
  const total = periodTx
    .filter((row) => !isRecurringFlow(row) && row.direction === "out" && !DEPOSIT_TRANSIT_CATEGORIES.includes(row.category))
    .reduce((sum, row) => sum + Number(row.amount || 0), 0);
  return monthCount > 1 ? total / monthCount : total;
}
