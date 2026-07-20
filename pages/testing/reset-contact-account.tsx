// pages/testing/reset-contact-account.tsx
//
// Page de confirmation pour l'outil de reset de contact@lokt.fr. Volontairement une
// simple page GET (rien de destructeur au chargement) : de nombreux clients email
// pro (Outlook Safe Links, etc.) visitent automatiquement les liens reçus pour les
// scanner. L'action réelle ne part qu'au clic explicite, via un POST côté client.
import { useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";

type State = "idle" | "loading" | "done" | "error";

export default function ResetContactAccountPage() {
  const router = useRouter();
  const [state, setState] = useState<State>("idle");
  const [result, setResult] = useState<{ propertiesArchived: number; tenantsArchived: number; leasesEnded: number } | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  const token = typeof router.query.token === "string" ? router.query.token : "";

  const handleReset = async () => {
    setState("loading");
    setError(null);
    try {
      const res = await fetch("/api/testing/reset-contact-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const body = await res.json();
      if (!res.ok || !body.ok) throw new Error(body?.error || "Erreur inconnue.");
      setResult(body);
      setState("done");
    } catch (e: any) {
      setError(e?.message || "Erreur inattendue.");
      setState("error");
    }
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <Head>
        <title>Reset contact@lokt.fr | lokt.fr</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <main className="mx-auto max-w-xl px-4 py-16">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6">
          <h1 className="text-lg font-semibold text-slate-900">Réinitialiser contact@lokt.fr</h1>
          <p className="mt-2 text-sm text-slate-600">
            Archive tous les logements et locataires, termine tous les baux, efface le profil et relance l'assistant
            de mise en route pour ce compte de test uniquement.
          </p>

          {!token ? (
            <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              Lien invalide (token manquant).
            </p>
          ) : state === "done" && result ? (
            <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-700">
              <p className="font-semibold">Compte réinitialisé ✓</p>
              <p className="mt-1 text-xs">
                {result.propertiesArchived} logement(s) archivé(s), {result.tenantsArchived} locataire(s) archivé(s),{" "}
                {result.leasesEnded} bail(aux) terminé(s).
              </p>
              <p className="mt-2 text-xs text-emerald-800">
                Si ce navigateur a déjà terminé l'assistant sur ce compte, il faut aussi vider le localStorage (ou
                utiliser une navigation privée) pour que l'assistant se relance vraiment.
              </p>
            </div>
          ) : (
            <>
              {error ? (
                <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
              ) : null}
              <button
                type="button"
                onClick={handleReset}
                disabled={state === "loading"}
                className="mt-5 rounded-full bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {state === "loading" ? "Réinitialisation…" : "Confirmer la réinitialisation"}
              </button>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
