// hooks/useLeadGate.ts
import { useEffect, useMemo, useState } from "react";

type LeadGateOptions = {
  tool: string;                 // ex: "pret-relais", "capacite", etc.
  sessionEmail?: string | null; // email connecté si user loggé
  isLoggedIn?: boolean;         // true si user connecté
  version?: string;             // optionnel, pour invalider plus tard
};

type UnlockPayload = {
  email: string;
  unlockedAt: string; // ISO date
  version?: string;
};

function safeLowerEmail(v: string) {
  return (v || "").trim().toLowerCase();
}

export function useLeadGate({
  tool,
  sessionEmail = null,
  isLoggedIn = false,
  version = "v1",
}: LeadGateOptions) {
  const EMAIL_KEY = useMemo(() => `lokt_gate::${tool}::email`, [tool]);
  const UNLOCK_KEY = useMemo(() => `lokt_gate::${tool}::unlock`, [tool]);

  const [leadEmail, setLeadEmail] = useState<string>("");
  const [consentLokt, setConsentLokt] = useState<boolean>(false);

  // "unlocked" local (UI)
  const [unlocked, setUnlocked] = useState<boolean>(false);

  // --- Restore email + unlock au montage ---
  useEffect(() => {
    if (typeof window === "undefined") return;

    // 1) email prioritaire = sessionEmail (si connecté)
    const fromSession = safeLowerEmail(sessionEmail ?? "");
    const fromStorage = safeLowerEmail(window.localStorage.getItem(EMAIL_KEY) ?? "");

    const initialEmail = fromSession || fromStorage;
    if (initialEmail) setLeadEmail(initialEmail);

    // 2) restore unlock si match email
    try {
      const raw = window.localStorage.getItem(UNLOCK_KEY);
      if (!raw) {
        setUnlocked(false);
        return;
      }
      const parsed: UnlockPayload = JSON.parse(raw);

      // si connecté: pas besoin de gate => unlocked vrai
      if (isLoggedIn) {
        setUnlocked(true);
        return;
      }

      const gateEmail = safeLowerEmail(parsed?.email ?? "");
      const currentEmail = safeLowerEmail(initialEmail);

      // version check (optionnel)
      const versionOk = !parsed?.version || parsed.version === version;

      if (versionOk && gateEmail && currentEmail && gateEmail === currentEmail) {
        setUnlocked(true);
        setConsentLokt(true); // UX: éviter de recocher si déjà unlock
      } else {
        setUnlocked(false);
      }
    } catch {
      setUnlocked(false);
    }
  }, [EMAIL_KEY, UNLOCK_KEY, sessionEmail, isLoggedIn, version]);

  // --- Persiste email à chaque modification ---
  useEffect(() => {
    if (typeof window === "undefined") return;
    const email = safeLowerEmail(leadEmail);
    if (!email) return;
    window.localStorage.setItem(EMAIL_KEY, email);
  }, [leadEmail, EMAIL_KEY]);

  // --- Si l’utilisateur change l’email, on invalide le unlock (logique saine) ---
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isLoggedIn) {
      setUnlocked(true);
      return;
    }

    const email = safeLowerEmail(leadEmail);
    if (!email) {
      setUnlocked(false);
      return;
    }

    try {
      const raw = window.localStorage.getItem(UNLOCK_KEY);
      if (!raw) {
        setUnlocked(false);
        return;
      }
      const parsed: UnlockPayload = JSON.parse(raw);
      const gateEmail = safeLowerEmail(parsed?.email ?? "");
      const versionOk = !parsed?.version || parsed.version === version;

      if (versionOk && gateEmail === email) {
        setUnlocked(true);
      } else {
        setUnlocked(false);
      }
    } catch {
      setUnlocked(false);
    }
  }, [leadEmail, isLoggedIn, UNLOCK_KEY, version]);

  // --- À appeler quand le RPC d’unlock a réussi ---
  const persistUnlock = (emailArg?: string) => {
    if (typeof window === "undefined") return;

    const email = safeLowerEmail(emailArg ?? leadEmail);
    if (!email) return;

    const payload: UnlockPayload = {
      email,
      unlockedAt: new Date().toISOString(),
      version,
    };

    window.localStorage.setItem(UNLOCK_KEY, JSON.stringify(payload));
    window.localStorage.setItem(EMAIL_KEY, email); // garde l’email
    setUnlocked(true);
    setConsentLokt(true);
  };

  // --- À appeler après un nouveau calcul pour ne PAS perdre le unlock ---
  const reapplyUnlockFromStorage = () => {
    if (typeof window === "undefined") return;

    if (isLoggedIn) {
      setUnlocked(true);
      return;
    }

    const email = safeLowerEmail(leadEmail);
    if (!email) {
      setUnlocked(false);
      return;
    }

    try {
      const raw = window.localStorage.getItem(UNLOCK_KEY);
      if (!raw) {
        setUnlocked(false);
        return;
      }
      const parsed: UnlockPayload = JSON.parse(raw);
      const gateEmail = safeLowerEmail(parsed?.email ?? "");
      const versionOk = !parsed?.version || parsed.version === version;

      setUnlocked(versionOk && gateEmail === email);
    } catch {
      setUnlocked(false);
    }
  };

  const canShowFullAnalysis = isLoggedIn || unlocked;

  return {
    leadEmail,
    setLeadEmail,
    consentLokt,
    setConsentLokt,
    unlocked,
    setUnlocked,
    canShowFullAnalysis,
    persistUnlock,
    reapplyUnlockFromStorage,
  };
}
