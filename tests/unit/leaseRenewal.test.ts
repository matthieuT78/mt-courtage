import { describe, expect, it } from "vitest";
import {
  computeLeaseWatchDate,
  computeLeaseWatchInfo,
  expectedLeaseEndDate,
} from "../../lib/landlord/leaseRenewal";

describe("computeLeaseWatchInfo — renewalEnabled", () => {
  const base = { start_date: "2026-01-09", end_date: "2027-01-08" };

  it("est actif pour un bail meublé (reconduction tacite) avec date de début", () => {
    expect(computeLeaseWatchInfo({ ...base, lease_kind: "furnished_primary" }).renewalEnabled).toBe(true);
  });

  it("est actif pour un bail vide (36 mois, reconduction tacite)", () => {
    expect(computeLeaseWatchInfo({ ...base, lease_kind: "empty_primary" }).renewalEnabled).toBe(true);
  });

  it("est actif pour un bail professionnel (72 mois, reconduction tacite)", () => {
    expect(computeLeaseWatchInfo({ ...base, lease_kind: "professional" }).renewalEnabled).toBe(true);
  });

  it("est désactivé pour un bail étudiant (pas de reconduction tacite légale)", () => {
    expect(computeLeaseWatchInfo({ ...base, lease_kind: "furnished_student" }).renewalEnabled).toBe(false);
  });

  it("est désactivé pour un bail mobilité (pas de durée fixe)", () => {
    expect(computeLeaseWatchInfo({ ...base, lease_kind: "mobility" }).renewalEnabled).toBe(false);
  });

  it("est désactivé pour un bail 'autre'", () => {
    expect(computeLeaseWatchInfo({ ...base, lease_kind: "other" }).renewalEnabled).toBe(false);
  });

  it("est désactivé si le bailleur a explicitement décoché auto_renewal_enabled", () => {
    const info = computeLeaseWatchInfo({ ...base, lease_kind: "furnished_primary", auto_renewal_enabled: false });
    expect(info.renewalEnabled).toBe(false);
    // Sans reconduction, l'échéance à surveiller reste la date de fin contractuelle brute.
    expect(info.watchDate).toEqual(new Date(2027, 0, 8));
  });

  it("est désactivé si start_date est manquante, même pour un type à reconduction tacite", () => {
    const info = computeLeaseWatchInfo({ end_date: base.end_date, lease_kind: "furnished_primary" });
    expect(info.renewalEnabled).toBe(false);
  });

  it("renvoie watchDate=null et renewalEnabled=false sans end_date", () => {
    const info = computeLeaseWatchInfo({ start_date: base.start_date, lease_kind: "furnished_primary" });
    expect(info).toEqual({ watchDate: null, renewalEnabled: false, renewalCount: 0 });
  });
});

describe("computeLeaseWatchInfo — déroulé des cycles de reconduction", () => {
  it("ne déroule aucun cycle si la date de fin contractuelle est encore dans le futur", () => {
    const info = computeLeaseWatchInfo(
      { start_date: "2026-01-09", end_date: "2027-01-08", lease_kind: "furnished_primary" },
      new Date(2026, 8, 11) // 2026-09-11
    );
    expect(info.renewalEnabled).toBe(true);
    expect(info.renewalCount).toBe(0);
    expect(info.watchDate).toEqual(new Date(2027, 0, 8));
  });

  // Reproduction exacte de l'incident réel du 2026-09 : bail meublé
  // (auto_renewal_enabled=true) dont la date de fin brute (2026-07-27) était
  // passée, ce qui a déclenché 7 fausses alertes "Bail expiré encore actif"
  // avant le fix — voir feedback_lease_watchdate_gotcha.md. watchDate doit
  // rester dans le futur par rapport à `now`, jamais dans le passé.
  it("régression: un bail meublé toujours en reconduction tacite n'est jamais 'expiré'", () => {
    const now = new Date(2026, 8, 11); // 2026-09-11
    const info = computeLeaseWatchInfo(
      {
        start_date: "2026-01-09",
        end_date: "2026-07-27",
        lease_kind: "furnished_primary",
        auto_renewal_enabled: true,
      },
      now
    );
    expect(info.renewalEnabled).toBe(true);
    expect(info.watchDate).not.toBeNull();
    expect(info.watchDate!.getTime()).toBeGreaterThanOrEqual(now.getTime());
    expect(info.watchDate).toEqual(new Date(2027, 6, 27)); // 2027-07-27
    expect(info.renewalCount).toBe(1);
  });

  it("déroule plusieurs cycles annuels pour un bail reconduit depuis longtemps", () => {
    const now = new Date(2026, 8, 11); // 2026-09-11
    const info = computeLeaseWatchInfo(
      {
        start_date: "2019-01-09",
        end_date: "2020-01-08",
        lease_kind: "furnished_primary",
      },
      now
    );
    expect(info.renewalEnabled).toBe(true);
    expect(info.watchDate).toEqual(new Date(2027, 0, 8)); // 2027-01-08
    expect(info.renewalCount).toBe(7);
    // La date à surveiller ne doit jamais retomber dans le passé.
    expect(info.watchDate!.getTime()).toBeGreaterThanOrEqual(now.getTime());
  });
});

describe("computeLeaseWatchDate — raccourci", () => {
  it("renvoie la même valeur que computeLeaseWatchInfo(...).watchDate", () => {
    const lease = { start_date: "2026-01-09", end_date: "2026-07-27", lease_kind: "furnished_primary" };
    const now = new Date(2026, 8, 11);
    expect(computeLeaseWatchDate(lease, now)).toEqual(computeLeaseWatchInfo(lease, now).watchDate);
  });
});

describe("expectedLeaseEndDate", () => {
  it("calcule start + durée légale - 1 jour pour chaque type à durée fixe", () => {
    expect(expectedLeaseEndDate("2026-01-09", "furnished_primary")).toBe("2027-01-08"); // 12 mois
    expect(expectedLeaseEndDate("2026-01-09", "furnished_student")).toBe("2026-10-08"); // 9 mois
    expect(expectedLeaseEndDate("2026-01-09", "empty_primary")).toBe("2029-01-08"); // 36 mois
    expect(expectedLeaseEndDate("2026-01-09", "professional")).toBe("2032-01-08"); // 72 mois
  });

  it("renvoie null pour les types sans durée fixe (mobilité, autre)", () => {
    expect(expectedLeaseEndDate("2026-01-09", "mobility")).toBeNull();
    expect(expectedLeaseEndDate("2026-01-09", "other")).toBeNull();
  });

  it("renvoie null sans date de début", () => {
    expect(expectedLeaseEndDate(null, "furnished_primary")).toBeNull();
  });

  it("cale sur le dernier jour du mois quand le jour de départ n'existe pas 12 mois plus tard (29 février)", () => {
    // 2028 est bissextile (29 fév existe), pas 2029 → repli sur le 28 février.
    expect(expectedLeaseEndDate("2028-02-29", "furnished_primary")).toBe("2029-02-27");
  });
});
