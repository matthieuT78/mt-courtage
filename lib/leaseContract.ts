export const LEASE_CONTRACT_BUCKET = "lease-contract-pdfs";

export type LeaseContractKind = "empty_primary" | "furnished_primary" | "furnished_student" | "mobility" | "professional" | "other";

export const leaseContractKindLabels: Record<LeaseContractKind, string> = {
  empty_primary: "Location vide - résidence principale",
  furnished_primary: "Location meublée - résidence principale",
  furnished_student: "Location meublée étudiant - 9 mois",
  mobility: "Bail mobilité",
  professional: "Bail professionnel (profession libérale)",
  other: "Autre contrat de location",
};

export function isLeaseContractKind(value: unknown): value is LeaseContractKind {
  return ["empty_primary", "furnished_primary", "furnished_student", "mobility", "professional", "other"].includes(String(value));
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

export function externalContractPdfPath(userId: string, leaseId: string, documentId: string) {
  return `${userId}/${leaseId}/${documentId}.external.pdf`;
}
