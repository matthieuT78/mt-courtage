// components/PermissionProvider.tsx
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { supabase } from "../lib/supabaseClient";
import { fetchEffectivePlan } from "../lib/subscriptions";
import {
  landlordMaxActiveLeases,
  Plan,
  planAllowsLandlord,
  planShowsCalcDetails,
} from "../lib/permissions";

type PermissionsState = {
  loading: boolean;
  plan: Plan;
  isLoggedIn: boolean;

  canSeeCalcDetails: boolean;
  canUseLandlord: boolean;
  maxActiveLeases: number;

  refresh: () => Promise<void>;
};

const DEFAULT_PLAN: Plan = "calc_blur";

// ✅ Fallback SSR/export : évite le crash pendant le prerender
const DEFAULT_STATE: PermissionsState = {
  loading: true,
  plan: DEFAULT_PLAN,
  isLoggedIn: false,

  canSeeCalcDetails: planShowsCalcDetails(DEFAULT_PLAN),
  canUseLandlord: planAllowsLandlord(DEFAULT_PLAN),
  maxActiveLeases: landlordMaxActiveLeases(DEFAULT_PLAN),

  // no-op safe (évite undefined)
  refresh: async () => {},
};

// ✅ IMPORTANT : on met un default non-null pour éviter le throw en prerender
const PermissionsContext = createContext<PermissionsState>(DEFAULT_STATE);

export function PermissionProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<Plan>(DEFAULT_PLAN);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // évite setState après unmount + évite refresh concurrent qui s’écrase
  const mountedRef = useRef(true);
  const refreshIdRef = useRef(0);

  const refresh = async () => {
    // SSR guard : sur le serveur, pas d’auth / pas de localStorage
    if (typeof window === "undefined") {
      if (mountedRef.current) {
        setIsLoggedIn(false);
        setPlan(DEFAULT_PLAN);
        setLoading(false);
      }
      return;
    }

    const myRefreshId = ++refreshIdRef.current;

    if (mountedRef.current) setLoading(true);

    try {
      // 1) session
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;

      const user = data.session?.user ?? null;

      if (!mountedRef.current || refreshIdRef.current !== myRefreshId) return;
      setIsLoggedIn(!!user?.id);

      // 2) plan (⚠️ peut planter → on catch)
      let nextPlan: Plan = DEFAULT_PLAN;
      try {
        // si tu veux : tu peux décider de ne PAS appeler fetchEffectivePlan si pas loggé
        // (ça dépend de ton produit : plan invité ou non)
        nextPlan = await fetchEffectivePlan();
      } catch (e) {
        // important : ne jamais crasher l’app pour un problème de plan
        console.error("[PermissionProvider] fetchEffectivePlan failed:", e);
        nextPlan = DEFAULT_PLAN;
      }

      if (!mountedRef.current || refreshIdRef.current !== myRefreshId) return;
      setPlan(nextPlan);
    } catch (e) {
      console.error("[PermissionProvider] refresh failed:", e);
      if (!mountedRef.current || refreshIdRef.current !== myRefreshId) return;
      // fallback safe : déconnecté + plan par défaut
      setIsLoggedIn(false);
      setPlan(DEFAULT_PLAN);
    } finally {
      if (!mountedRef.current || refreshIdRef.current !== myRefreshId) return;
      setLoading(false);
    }
  };

  useEffect(() => {
    mountedRef.current = true;

    // init
    refresh();

    // sync login/logout/refresh token
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      refresh();
    });

    return () => {
      mountedRef.current = false;
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<PermissionsState>(() => {
    const canSeeCalcDetails = planShowsCalcDetails(plan);
    const canUseLandlord = planAllowsLandlord(plan);
    const maxActiveLeases = landlordMaxActiveLeases(plan);

    return {
      loading,
      plan,
      isLoggedIn,
      canSeeCalcDetails,
      canUseLandlord,
      maxActiveLeases,
      refresh,
    };
  }, [loading, plan, isLoggedIn]);

  return (
    <PermissionsContext.Provider value={value}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  // ✅ plus de throw : en export/prerender, on obtient DEFAULT_STATE
  return useContext(PermissionsContext);
}
