// lib/landlord/leaseRenewal.ts
//
// `lease.end_date` en base reste figé sur la date de fin d'origine du
// contrat : elle n'est jamais avancée lors d'une reconduction tacite
// silencieuse (aucune action du bailleur ni du locataire). Un composant qui
// compare directement `end_date` à "aujourd'hui + 90 jours" se trompe donc
// dans les deux sens pour un bail déjà reconduit une ou plusieurs fois :
// - il peut le signaler "à surveiller" indéfiniment (sa date d'origine reste
//   dans le passé pour toujours) ;
// - ou au contraire ne jamais le signaler quand sa vraie échéance courante
//   approche réellement.
//
// `computeLeaseWatchDate` déroule la date d'origine par cycles de
// `durationMonths` jusqu'à retomber sur l'échéance courante, pour les types
// de bail à reconduction tacite. Source de vérité pour la durée/reconduction
// par type de bail : `leaseKindOptions` dans SectionBaux.tsx.

type LeaseForWatchDate = {
  start_date?: string | null;
  end_date?: string | null;
  lease_kind?: string | null;
  auto_renewal_enabled?: boolean | null;
};

const DURATION_MONTHS_BY_KIND: Record<string, number | null> = {
  furnished_primary: 12,
  furnished_student: 9,
  mobility: null,
  empty_primary: 36,
  professional: 72,
  other: null,
};

const TACIT_RENEWAL_BY_KIND: Record<string, boolean> = {
  furnished_primary: true,
  furnished_student: false,
  mobility: false,
  empty_primary: true,
  professional: true,
  other: false,
};

function parseISODateLocal(v?: string | null): Date | null {
  if (!v) return null;
  const [y, m, d] = String(v).slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function addMonthsLocal(d: Date, months: number): Date {
  const next = new Date(d.getFullYear(), d.getMonth() + months, d.getDate());
  if (next.getDate() !== d.getDate()) return new Date(next.getFullYear(), next.getMonth(), 0);
  return next;
}

function dateMinusOneDay(d: Date): Date {
  const next = new Date(d);
  next.setDate(next.getDate() - 1);
  return next;
}

export type LeaseWatchInfo = {
  /** Échéance du cycle en cours (reconduction tacite déroulée), ou date de
   * fin contractuelle brute si la reconduction ne s'applique pas. Peut être
   * dans le passé uniquement dans ce second cas (bail arrivé à terme sans
   * reconduction possible). Null si aucune date de fin n'est renseignée. */
  watchDate: Date | null;
  renewalEnabled: boolean;
  /** Nombre de cycles de reconduction déjà déroulés pour atteindre watchDate. */
  renewalCount: number;
};

/**
 * Calcule l'échéance à surveiller pour ce bail, en tenant compte de la
 * reconduction tacite : si elle s'applique, la date de fin stockée est
 * déroulée par cycles de `durationMonths` jusqu'à retomber sur le cycle en
 * cours (jamais dans le passé).
 */
export function computeLeaseWatchInfo(lease: LeaseForWatchDate, now: Date = new Date()): LeaseWatchInfo {
  const start = parseISODateLocal(lease.start_date);
  const contractualEnd = parseISODateLocal(lease.end_date);
  if (!contractualEnd) return { watchDate: null, renewalEnabled: false, renewalCount: 0 };

  const durationMonths = DURATION_MONTHS_BY_KIND[String(lease.lease_kind || "")] ?? null;
  const tacitRenewal = TACIT_RENEWAL_BY_KIND[String(lease.lease_kind || "")] ?? false;
  const renewalEnabled = tacitRenewal && !!durationMonths && !!start && lease.auto_renewal_enabled !== false;

  if (!renewalEnabled) return { watchDate: contractualEnd, renewalEnabled: false, renewalCount: 0 };

  let cycleEnd = contractualEnd;
  let renewalCount = 0;
  while (cycleEnd.getTime() < now.getTime() && renewalCount < 60) {
    const nextCycleStart = new Date(cycleEnd);
    nextCycleStart.setDate(nextCycleStart.getDate() + 1);
    cycleEnd = dateMinusOneDay(addMonthsLocal(nextCycleStart, durationMonths!));
    renewalCount += 1;
  }
  return { watchDate: cycleEnd, renewalEnabled: true, renewalCount };
}

/** Raccourci quand seule l'échéance importe (pas le détail des cycles). */
export function computeLeaseWatchDate(lease: LeaseForWatchDate, now: Date = new Date()): Date | null {
  return computeLeaseWatchInfo(lease, now).watchDate;
}
