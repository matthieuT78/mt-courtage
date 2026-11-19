import { describe, expect, it } from "vitest";
import {
  computeExpenseMonthly,
  computeLedgerIncome,
  DELEGATED_RENT_LABEL,
  isReceivedIncome,
  type PerformanceTx,
} from "../../lib/landlord/performanceCalc";

function rentTx(overrides: Partial<PerformanceTx> = {}): PerformanceTx {
  return {
    direction: "in",
    category: "rent",
    status: "received",
    amount: 900,
    label: "Loyer (quittance)",
    receipt_id: null,
    ...overrides,
  };
}

describe("computeLedgerIncome", () => {
  // Incident réel du 2026-11 : payments/confirm.ts écrit le même loyer confirmé à la fois
  // dans rent_payments (compté par l'appelant via `received`) et, pour les baux
  // receipts_disabled, dans transactions via syncDelegatedRentTransaction (receipt_id
  // toujours null faute de quittance lokt). Sans cette exclusion, ce loyer est compté deux
  // fois côté Performance — voir components/landlord/sections/SectionPerformance.tsx.
  it("exclut les lignes 'Loyer (gestion agence)' (baux en gestion déléguée, receipts_disabled)", () => {
    const txs = [rentTx({ label: DELEGATED_RENT_LABEL, receipt_id: null })];
    expect(computeLedgerIncome(txs)).toBe(0);
  });

  it("exclut les copies automatiques d'une quittance (receipt_id non nul)", () => {
    const txs = [rentTx({ receipt_id: "receipt-123" })];
    expect(computeLedgerIncome(txs)).toBe(0);
  });

  it("compte un loyer ajouté manuellement dans Finance (receipt_id null, label différent)", () => {
    const txs = [rentTx({ label: "Loyer (quittance)", receipt_id: null })];
    expect(computeLedgerIncome(txs)).toBe(900);
  });

  it("compte un revenu annexe (parking, remboursement...) saisi hors quittance", () => {
    const txs = [rentTx({ category: "other", label: "Place de parking", amount: 60, receipt_id: null })];
    expect(computeLedgerIncome(txs)).toBe(60);
  });

  it("ignore les écritures récurrentes (déjà comptées dans les charges récurrentes)", () => {
    const txs = [rentTx({ is_recurring: true, receipt_id: null })];
    expect(computeLedgerIncome(txs)).toBe(0);
  });

  it("ignore les dépenses (direction out) et le dépôt de garantie en transit", () => {
    const txs = [
      rentTx({ direction: "out", amount: 100 }),
      rentTx({ category: "deposit_collected", amount: 760 }),
    ];
    expect(computeLedgerIncome(txs)).toBe(0);
  });

  // Incident réel du 2026-11 : une retenue sur caution (fin de bail) est un mouvement de
  // capital, pas un loyer encaissé — une transaction deposit_retained réelle de 1200€ était
  // comptée comme revenu locatif dans Finance et Performance avant ce fix.
  it("ignore une retenue sur caution (deposit_retained)", () => {
    const txs = [rentTx({ category: "deposit_retained", label: "Retenue sur caution", amount: 1200, receipt_id: null })];
    expect(computeLedgerIncome(txs)).toBe(0);
  });

  it("additionne plusieurs lignes comptables distinctes", () => {
    const txs = [
      rentTx({ label: "Loyer (quittance)", receipt_id: null, amount: 900 }),
      rentTx({ category: "other", label: "Parking", amount: 60, receipt_id: null }),
    ];
    expect(computeLedgerIncome(txs)).toBe(960);
  });
});

describe("isReceivedIncome", () => {
  // Incident réel du 2026-11 : SectionDashboard.tsx (le cockpit, page la plus visible du site)
  // avait sa propre copie de ce prédicat, avec son propre DEPOSIT_CATEGORIES local qui n'avait
  // jamais été mis à jour avec "deposit_retained" — la retenue de caution de Saint-Rémy restait
  // comptée comme loyer dans le graphe "Trésorerie 6 mois" du tableau de bord alors qu'elle
  // avait déjà été corrigée dans Finance et Performance. category est typé nullable ici
  // (TransactionRow du dashboard n'a pas la même forme stricte que Transaction de Finance) —
  // vérifie que ça ne casse pas le filtre deposit_retained.
  it("exclut deposit_retained même avec un type category nullable (cas SectionDashboard)", () => {
    const tx: PerformanceTx = { direction: "in", status: "received", amount: 689.03, category: "deposit_retained" };
    expect(isReceivedIncome(tx)).toBe(false);
  });

  it("ne plante pas si category est absent/null", () => {
    expect(isReceivedIncome({ direction: "in", status: "received", amount: 100, category: null })).toBe(true);
    expect(isReceivedIncome({ direction: "in", status: "received", amount: 100 })).toBe(true);
  });

  it("compte un loyer normal", () => {
    expect(isReceivedIncome({ direction: "in", status: "received", amount: 900, category: "rent" })).toBe(true);
  });
});

describe("computeExpenseMonthly", () => {
  // Incident réel du 2026-11 : plusieurs alertes de SectionPerformance comparaient le total
  // de dépenses sur toute la période sélectionnée (6 mois par défaut) à des montants
  // mensuels (loyer, charges récurrentes) sans diviser par le nombre de mois — ratio
  // "charges/loyer" affiché à 172 % au lieu de 110 % réels sur un cas réel.
  it("ramène un total de dépenses sur 6 mois à une moyenne mensuelle", () => {
    const txs = [
      { direction: "out", category: "copro", amount: 113, status: "paid" } as PerformanceTx,
      { direction: "out", category: "copro", amount: 330, status: "paid" } as PerformanceTx,
      { direction: "out", category: "copro", amount: 116, status: "paid" } as PerformanceTx,
      { direction: "out", category: "copro", amount: 116.99, status: "paid" } as PerformanceTx,
    ];
    // 675.99 € de dépenses ponctuelles sur une fenêtre de 6 mois -> 112.665 €/mois.
    expect(computeExpenseMonthly(txs, 6)).toBeCloseTo(675.99 / 6, 5);
  });

  it("ne divise pas pour une fenêtre d'un seul mois", () => {
    const txs = [{ direction: "out", category: "repairs", amount: 240, status: "paid" } as PerformanceTx];
    expect(computeExpenseMonthly(txs, 1)).toBe(240);
  });

  it("exclut les écritures récurrentes et le dépôt de garantie rendu", () => {
    const txs = [
      { direction: "out", category: "loan", amount: 762.96, status: "paid", is_recurring: true } as PerformanceTx,
      { direction: "out", category: "deposit_returned", amount: 760, status: "paid" } as PerformanceTx,
    ];
    expect(computeExpenseMonthly(txs, 6)).toBe(0);
  });

  it("ignore les entrées (direction in)", () => {
    const txs = [{ direction: "in", category: "rent", amount: 900, status: "received" } as PerformanceTx];
    expect(computeExpenseMonthly(txs, 6)).toBe(0);
  });
});
