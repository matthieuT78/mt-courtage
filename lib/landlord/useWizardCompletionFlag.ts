import { useCallback, useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

// Indique si l'utilisateur a déjà franchi une fois les étapes obligatoires de
// l'assistant de mise en route (profil + bien + locataire + location). Une
// fois posé, ce flag reste vrai pour toujours — y compris si l'utilisateur
// redevient temporairement incomplet plus tard (ex. locataire parti) : dans
// ce cas seule la checklist non-bloquante du cockpit doit le relancer, pas
// l'assistant obligatoire. Volontairement indépendant du mécanisme
// `doneAtISO` de SectionDashboard.tsx (5 étapes, Finance incluse), qui garde
// son propre comportement inchangé.

export function useWizardCompletionFlag(userId: string | null) {
  const [done, setDone] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const storageKey = `imp:onboarding_wizard_done:${(userId || "").trim() || "anon"}`;
  const settingsKey = `onboarding_wizard_done:${userId}`;

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        if (typeof window !== "undefined" && window.localStorage.getItem(storageKey) === "1") {
          if (!cancelled) {
            setDone(true);
            setLoaded(true);
          }
          return;
        }
      } catch {
        // localStorage indisponible : on retombe sur Supabase.
      }

      if (!supabase || !userId) {
        if (!cancelled) setLoaded(true);
        return;
      }

      try {
        const { data } = await supabase.from("app_settings").select("value_json").eq("key", settingsKey).maybeSingle();
        const isDone = !!data?.value_json?.done;
        if (!cancelled) {
          setDone(isDone);
          if (isDone) {
            try {
              window.localStorage.setItem(storageKey, "1");
            } catch {
              // ignore
            }
          }
        }
      } catch {
        // table absente ou RLS : on considère non-fait, l'assistant s'affichera.
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const markDone = useCallback(() => {
    setDone(true);
    try {
      window.localStorage.setItem(storageKey, "1");
    } catch {
      // ignore
    }
    (async () => {
      try {
        if (!supabase || !userId) return;
        await supabase.from("app_settings").upsert({ key: settingsKey, value_json: { done: true } }, { onConflict: "key" });
      } catch {
        // On ne bloque pas la transition vers le cockpit si cette écriture échoue.
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, storageKey, settingsKey]);

  return { done, loaded, markDone };
}
