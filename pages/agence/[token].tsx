import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";

export default function AgenceActivatePage() {
  const router = useRouter();
  const { token } = router.query;

  const [status, setStatus] = useState<"pending" | "ok" | "error">("pending");
  const [agenceName, setAgenceName] = useState("");

  useEffect(() => {
    if (!token || typeof token !== "string") return;

    fetch(`/api/agence/activate?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          setAgenceName(data.name || "");
          setStatus("ok");
          setTimeout(() => router.push("/calculettes"), 2500);
        } else {
          setStatus("error");
        }
      })
      .catch(() => setStatus("error"));
  }, [token, router]);

  return (
    <>
      <Head>
        <title>Accès simulateurs — lokt.fr</title>
        <meta name="robots" content="noindex" />
      </Head>

      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 text-center">
        <img src="/LOKT_LOGO.jpg" alt="lokt.fr" className="mb-8 h-12 w-auto object-contain" />

        {status === "pending" && (
          <>
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-600 border-t-[#635bff]" />
            <p className="mt-4 text-sm text-slate-400">Activation en cours…</p>
          </>
        )}

        {status === "ok" && (
          <div className="space-y-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-2xl mx-auto">
              ✓
            </div>
            <p className="text-lg font-semibold text-white">
              {agenceName ? `Bienvenue, ${agenceName}` : "Accès activé"}
            </p>
            <p className="text-sm text-slate-400">
              Tous les simulateurs sont maintenant disponibles sans saisie email.
              <br />Redirection vers les calculettes…
            </p>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-3">
            <p className="text-lg font-semibold text-white">Lien invalide ou expiré</p>
            <p className="text-sm text-slate-400">
              Ce lien n'est plus actif. Contactez lokt.fr pour un nouvel accès.
            </p>
            <Link
              href="/"
              className="mt-4 inline-flex items-center rounded-full bg-[#635bff] px-6 py-2.5 text-sm font-semibold text-white"
            >
              Retour à l'accueil
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
