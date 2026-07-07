import { useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "./supabaseClient";

export function useCheckout() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startCheckout = async (planId: string, billing: "monthly" | "annual" = "monthly") => {
    setError(null);
    setLoading(true);

    try {
      if (!supabase) throw new Error("Authentification indisponible.");
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      if (!token) {
        const redirect = `/mon-compte/abonnement?plan=${encodeURIComponent(planId)}&billing=${billing}`;
        router.push(`/mon-compte?mode=register&redirect=${encodeURIComponent(redirect)}`);
        return;
      }

      const resp = await fetch("/api/billing/create-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ plan: planId, billing }),
      });

      const payload = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(payload?.error || "Impossible de démarrer le paiement.");
      if (!payload?.url) throw new Error("URL de paiement Stripe manquante.");

      window.location.href = payload.url;
    } catch (err: any) {
      setError(err?.message || "Impossible de démarrer le paiement.");
    } finally {
      setLoading(false);
    }
  };

  return { startCheckout, loading, error };
}
