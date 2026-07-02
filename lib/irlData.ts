// Indice de Référence des Loyers — INSEE, base 100 = T1 1998
// Source officielle : https://www.insee.fr/fr/statistiques/serie/001515333
// À mettre à jour chaque trimestre après publication INSEE (délai ~30 j après fin de trimestre).
// NB : T2 2022 → T1 2024 : hausse plafonnée à +3,5 % (bouclier loyer).

export type IrlEntry = {
  quarter: string;  // "2024-T2"
  label: string;    // "T2 2024"
  value: number;
};

export const IRL_TABLE: IrlEntry[] = [
  { quarter: "2026-T1", label: "T1 2026", value: 151.34 },
  { quarter: "2025-T4", label: "T4 2025", value: 150.61 },
  { quarter: "2025-T3", label: "T3 2025", value: 149.95 },
  { quarter: "2025-T2", label: "T2 2025", value: 149.12 },
  { quarter: "2025-T1", label: "T1 2025", value: 148.09 },
  { quarter: "2024-T4", label: "T4 2024", value: 147.34 },
  { quarter: "2024-T3", label: "T3 2024", value: 146.71 },
  { quarter: "2024-T2", label: "T2 2024", value: 146.01 },
  { quarter: "2024-T1", label: "T1 2024", value: 145.57 },
  { quarter: "2023-T4", label: "T4 2023", value: 143.47 },
  { quarter: "2023-T3", label: "T3 2023", value: 142.12 },
  { quarter: "2023-T2", label: "T2 2023", value: 141.43 },
  { quarter: "2023-T1", label: "T1 2023", value: 140.59 },
  { quarter: "2022-T4", label: "T4 2022", value: 138.26 },
  { quarter: "2022-T3", label: "T3 2022", value: 136.27 },
  { quarter: "2022-T2", label: "T2 2022", value: 133.93 },
  { quarter: "2022-T1", label: "T1 2022", value: 133.40 },
  { quarter: "2021-T4", label: "T4 2021", value: 131.67 },
  { quarter: "2021-T3", label: "T3 2021", value: 131.12 },
  { quarter: "2021-T2", label: "T2 2021", value: 130.26 },
  { quarter: "2021-T1", label: "T1 2021", value: 129.72 },
  { quarter: "2020-T4", label: "T4 2020", value: 130.26 },
  { quarter: "2020-T3", label: "T3 2020", value: 130.07 },
  { quarter: "2020-T2", label: "T2 2020", value: 130.26 },
  { quarter: "2020-T1", label: "T1 2020", value: 130.57 },
  { quarter: "2019-T4", label: "T4 2019", value: 130.84 },
  { quarter: "2019-T3", label: "T3 2019", value: 130.57 },
  { quarter: "2019-T2", label: "T2 2019", value: 130.26 },
  { quarter: "2019-T1", label: "T1 2019", value: 129.38 },
  { quarter: "2018-T4", label: "T4 2018", value: 129.38 },
  { quarter: "2018-T3", label: "T3 2018", value: 128.82 },
  { quarter: "2018-T2", label: "T2 2018", value: 128.45 },
  { quarter: "2018-T1", label: "T1 2018", value: 127.77 },
];

// Dernier IRL publié (tête de liste)
export const LATEST_IRL = IRL_TABLE[0];

// Convertit une date ISO en trimestre IRL (ex: "2023-04-15" → "2023-T2")
export function dateToIrlQuarter(iso: string): string {
  const d = new Date(iso);
  const q = Math.floor(d.getMonth() / 3) + 1;
  return `${d.getFullYear()}-T${q}`;
}

export function irlByQuarter(quarter: string): IrlEntry | null {
  return IRL_TABLE.find((e) => e.quarter === quarter) || null;
}
