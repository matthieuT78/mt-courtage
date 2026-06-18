import { useEffect, useState } from "react";
import { supabaseTenant } from "../lib/supabaseTenantClient";

export function useTenantAuthUser() {
  const [checking, setChecking] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    let mounted = true;
    let unsubscribe: (() => void) | null = null;

    const init = async () => {
      try {
        if (!supabaseTenant) {
          if (mounted) { setUser(null); setChecking(false); }
          return;
        }
        const { data } = await supabaseTenant.auth.getSession();
        if (mounted) { setUser(data.session?.user ?? null); setChecking(false); }

        const { data: sub } = supabaseTenant.auth.onAuthStateChange((_evt, session) => {
          if (mounted) { setUser(session?.user ?? null); setChecking(false); }
        });
        unsubscribe = () => sub.subscription.unsubscribe();
      } catch {
        if (mounted) { setUser(null); setChecking(false); }
      }
    };

    init();
    return () => { mounted = false; unsubscribe?.(); };
  }, []);

  return { checking, user, isLoggedIn: !!user?.id };
}
