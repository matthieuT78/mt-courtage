import { describe, expect, it } from "vitest";
import { isInTransition } from "../../lib/landlord/leaseTransition";
import type { Lease, Property } from "../../lib/landlord/types";

const NOW = new Date(2026, 8, 11); // 2026-09-11

function makeLease(overrides: Partial<Lease>): Lease {
  return {
    id: "lease-1",
    user_id: "user-1",
    property_id: "property-1",
    tenant_id: "tenant-1",
    start_date: "2026-01-09",
    end_date: "2026-07-27",
    status: "active",
    lease_kind: "furnished_primary",
    auto_renewal_enabled: true,
    ...overrides,
  } as Lease;
}

const propertyById = new Map<string, Property>([
  ["property-1", { id: "property-1", status: "active" } as Property],
]);

describe("isInTransition", () => {
  // Reproduction de l'incident réel : un bail actif toujours en reconduction
  // tacite ne doit jamais être signalé "en transition" (ce qui afficherait à
  // tort "Départ de locataire" 6 mois avant chaque anniversaire, pour
  // toujours) — voir feedback_lease_watchdate_gotcha.md.
  it("ignore un bail actif toujours en reconduction tacite, même avec end_date brut dans le passé", () => {
    const lease = makeLease({ end_date: "2026-07-27", auto_renewal_enabled: true });
    expect(isInTransition(lease, [lease], propertyById, NOW)).toBe(false);
  });

  it("signale un bail actif dont la reconduction tacite a été décochée et dont l'échéance approche", () => {
    const lease = makeLease({ end_date: "2026-11-01", auto_renewal_enabled: false });
    expect(isInTransition(lease, [lease], propertyById, NOW)).toBe(true);
  });

  it("ignore un bail actif dont la reconduction est décochée mais l'échéance est trop lointaine (> 6 mois)", () => {
    const lease = makeLease({ end_date: "2027-06-01", auto_renewal_enabled: false });
    expect(isInTransition(lease, [lease], propertyById, NOW)).toBe(false);
  });

  it("ignore un bail actif dont la reconduction est décochée mais l'échéance est trop ancienne (> 90 jours)", () => {
    const lease = makeLease({ end_date: "2026-05-01", auto_renewal_enabled: false });
    expect(isInTransition(lease, [lease], propertyById, NOW)).toBe(false);
  });

  it("signale un bail sans reconduction tacite légale (étudiant) dont l'échéance approche", () => {
    const lease = makeLease({ end_date: "2026-11-01", lease_kind: "furnished_student", auto_renewal_enabled: true });
    expect(isInTransition(lease, [lease], propertyById, NOW)).toBe(true);
  });

  it("ignore un bail sans end_date", () => {
    const lease = makeLease({ end_date: null });
    expect(isInTransition(lease, [lease], propertyById, NOW)).toBe(false);
  });

  it("ignore un bail dont le statut n'est ni actif ni terminé (ex. brouillon)", () => {
    const lease = makeLease({ status: "draft" });
    expect(isInTransition(lease, [lease], propertyById, NOW)).toBe(false);
  });

  it("ignore un bail sur un bien archivé", () => {
    const archivedPropertyById = new Map<string, Property>([
      ["property-1", { id: "property-1", status: "archived" } as Property],
    ]);
    const lease = makeLease({ end_date: "2026-11-01", auto_renewal_enabled: false });
    expect(isInTransition(lease, [lease], archivedPropertyById, NOW)).toBe(false);
  });

  it("ignore un bail terminé si un bail successeur actif existe déjà sur le même bien", () => {
    const lease = makeLease({ status: "ended", end_date: "2026-08-01" });
    const successor = makeLease({ id: "lease-2", status: "active", start_date: "2026-08-02", end_date: "2027-08-01" });
    expect(isInTransition(lease, [lease, successor], propertyById, NOW)).toBe(false);
  });

  it("signale un bail terminé sans successeur", () => {
    const lease = makeLease({ status: "ended", end_date: "2026-08-01" });
    expect(isInTransition(lease, [lease], propertyById, NOW)).toBe(true);
  });

  it("ignore un bail actif décoché avec un successeur déjà en place (relais assuré)", () => {
    const lease = makeLease({ end_date: "2026-11-01", auto_renewal_enabled: false });
    const successor = makeLease({ id: "lease-2", status: "active", start_date: "2026-11-02", end_date: "2027-11-01" });
    expect(isInTransition(lease, [lease, successor], propertyById, NOW)).toBe(false);
  });
});
