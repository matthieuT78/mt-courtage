import { useEffect } from "react";
import { useRouter } from "next/router";
import { supabase } from "../../lib/supabaseClient";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    if (!router.isReady || !supabase) return;

    const code = router.query.code;
    const redirect = router.query.redirect;
    const dest =
      typeof redirect === "string" && redirect.startsWith("/")
        ? redirect
        : "/espace-bailleur";

    if (code && typeof code === "string") {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) {
          console.error("[auth/callback]", error.message);
          router.replace("/mon-compte");
        } else {
          router.replace(dest);
        }
      });
    } else {
      router.replace("/mon-compte");
    }
  }, [router.isReady, router.query]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950">
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-600 border-t-[#635bff]" />
        <p className="text-sm text-slate-400">Connexion en cours…</p>
      </div>
    </div>
  );
}
