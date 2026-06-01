export const LEASE_CONTRACT_BUCKET = "lease-contract-pdfs";

export type LeaseContractKind = "empty_primary" | "furnished_primary" | "furnished_student" | "mobility";

export const leaseContractKindLabels: Record<LeaseContractKind, string> = {
  empty_primary: "Location vide - résidence principale",
  furnished_primary: "Location meublée - résidence principale",
  furnished_student: "Location meublée étudiant - 9 mois",
  mobility: "Bail mobilité",
};

export function isLeaseContractKind(value: unknown): value is LeaseContractKind {
  return ["empty_primary", "furnished_primary", "furnished_student", "mobility"].includes(String(value));
}

export function parseStoredLeaseContractUrl(value?: string | null) {
  const raw = String(value || "");
  const index = raw.indexOf(":");
  if (index < 1) return null;
  return { bucket: raw.slice(0, index), path: raw.slice(index + 1) };
}

export function contractPdfPath(userId: string, leaseId: string, documentId: string, signed = false) {
  return `${userId}/${leaseId}/${documentId}.${signed ? "signed" : "generated"}.pdf`;
}
