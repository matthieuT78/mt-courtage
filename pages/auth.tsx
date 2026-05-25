import { useEffect } from "react";
import Head from "next/head";
import { useRouter } from "next/router";

export default function AuthPage() {
  const router = useRouter();

  useEffect(() => {
    if (!router.isReady) return;
    const mode = router.query.mode === "signup" ? "register" : router.query.mode;
    const params = new URLSearchParams();
    if (mode === "register" || mode === "login") params.set("mode", String(mode));
    if (typeof router.query.redirect === "string") params.set("redirect", router.query.redirect);
    router.replace(`/mon-compte${params.toString() ? `?${params.toString()}` : ""}`);
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
      <Head>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-600 shadow-sm">
        Redirection vers la page de connexion…
      </div>
    </div>
  );
}
