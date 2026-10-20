// lib/landlord/dateOverlap.ts
//
// Calculs de jours/chevauchement de périodes (YYYY-MM-DD), bornes incluses.
// Source unique partagée entre les outils de prorata du cockpit
// (SectionOutils.tsx) et les outils Loky équivalents (assistantTools.ts) —
// pour que le même calcul ne soit jamais réimplémenté différemment des deux
// côtés.

export function daysInclusive(start: string, end: string): number {
  if (!start || !end) return 0;
  const startTime = new Date(`${start}T00:00:00`).getTime();
  const endTime = new Date(`${end}T00:00:00`).getTime();
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime < startTime) return 0;
  return Math.floor((endTime - startTime) / 86400000) + 1;
}

// Jours communs aux deux périodes (pas juste la durée la plus courte) : si les deux
// plages ne se chevauchent pas du tout, le résultat doit être 0, pas une fraction
// calculée sur une durée sans rapport avec la période réellement commune.
export function overlapDaysInclusive(aStart: string, aEnd: string, bStart: string, bEnd: string): number {
  if (!aStart || !aEnd || !bStart || !bEnd) return 0;
  const start = aStart > bStart ? aStart : bStart;
  const end = aEnd < bEnd ? aEnd : bEnd;
  return daysInclusive(start, end);
}
