import { useEffect } from "react";
import { useRouter } from "next/router";
import { supabase } from "../../lib/supabaseClient";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    if (!router.isReady || !supabase) return;

    const redirect = router.query.redirect;
    const dest =
      typeof redirect === "string" && redirect.startsWith("/")
        ? redirect
        : "/espace-bailleur";

    // Supabase (detectSessionInUrl: true) échange le code automatiquement.
    // On attend juste que la session soit établie.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        subscription.unsubscribe();
        router.replace(dest);
      }
      if (event === "SIGNED_OUT" || (!session && event !== "INITIAL_SESSION")) {
        subscription.unsubscribe();
        router.replace("/mon-compte");
      }
    });

    // Fallback : si onAuthStateChange ne fire pas dans 5s, on vérifie manuellement
    const timeout = setTimeout(async () => {
      subscription.unsubscribe();
      const { data } = await supabase.auth.getSession();
      router.replace(data.session ? dest : "/mon-compte");
    }, 5000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [router.isReady]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950">
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-600 border-t-[#635bff]" />
        <p className="text-sm text-slate-400">Connexion en cours…</p>
      </div>
    </div>
  );
}
