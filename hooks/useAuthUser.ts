// hooks/useAuthUser.ts
import { useEffect, useLayoutEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

function hasLocalSupabaseSession(): boolean {
  try {
    return Object.keys(localStorage).some((k) => k.startsWith("sb-"));
  } catch {
    return false; // SSR ou localStorage indisponible
  }
}

export function useAuthUser() {
  const [checking, setChecking] = useState(true);
  const [user, setUser] = useState<any>(null);

  // Avant le premier rendu visible : si aucune clé sb-* en localStorage,
  // on est sûrement déconnecté — on skip le skeleton immédiatement.
  useLayoutEffect(() => {
    if (!hasLocalSupabaseSession()) {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    let unsubscribe: (() => void) | null = null;

    const init = async () => {
      try {
        if (!supabase) {
          if (!mounted) return;
          setUser(null);
          setChecking(false);
          return;
        }

        const { data } = await supabase.auth.getSession();
        if (!mounted) return;

        setUser(data.session?.user ?? null);
        setChecking(false);

        const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
          if (!mounted) return;
          setUser(session?.user ?? null);
          setChecking(false);
        });

        unsubscribe = () => sub.subscription.unsubscribe();
      } catch {
        if (!mounted) return;
        setUser(null);
        setChecking(false);
      }
    };

    init();

    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, []);

  return { checking, user, isLoggedIn: !!user?.id };
}
