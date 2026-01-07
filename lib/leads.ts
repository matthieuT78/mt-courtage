// lib/leads.ts
export type ToolName = "capacite" | "pret-relais" | "investissement" | "parc-immobilier";

export function safeEmail(v: string) {
  return (v || "").trim().toLowerCase();
}

export function toolKeys(tool: ToolName) {
  return {
    emailKey: `lokt_lead_email_v1:${tool}`,
    unlockKey: `lokt_unlock_v1:${tool}`,
  };
}

export function loadLeadEmail(tool: ToolName): string {
  if (typeof window === "undefined") return "";
  const { emailKey } = toolKeys(tool);
  return safeEmail(window.localStorage.getItem(emailKey) || "");
}

export function persistLeadEmail(tool: ToolName, email: string) {
  if (typeof window === "undefined") return;
  const { emailKey } = toolKeys(tool);
  const e = safeEmail(email);
  if (!e) return;
  window.localStorage.setItem(emailKey, e);
}

export function isUnlockedForEmail(tool: ToolName, email: string): boolean {
  if (typeof window === "undefined") return false;
  const { unlockKey } = toolKeys(tool);
  const e = safeEmail(email);
  if (!e) return false;

  try {
    const raw = window.localStorage.getItem(unlockKey);
    if (!raw) return false;
    const data = JSON.parse(raw);
    const savedEmail = safeEmail(data?.email || "");
    const consent = !!data?.consent_analysis;
    return savedEmail === e && consent;
  } catch {
    return false;
  }
}

export function persistUnlock(tool: ToolName, email: string) {
  if (typeof window === "undefined") return;
  const { unlockKey } = toolKeys(tool);
  const e = safeEmail(email);
  if (!e) return;

  window.localStorage.setItem(
    unlockKey,
    JSON.stringify({
      email: e,
      consent_analysis: true,
      ts: new Date().toISOString(),
    })
  );
}
