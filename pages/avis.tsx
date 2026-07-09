import Head from "next/head";
import { useRouter } from "next/router";
import { useState } from "react";
import AppHeader from "../components/AppHeader";
import AppFooter from "../components/AppFooter";

function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-1" role="group" aria-label="Note">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          onMouseEnter={() => setHovered(n)}
          onMouseLeave={() => setHovered(0)}
          className="text-4xl leading-none transition-transform hover:scale-110 focus:outline-none"
          aria-label={`${n} étoile${n > 1 ? "s" : ""}`}
        >
          <span className={(hovered || value) >= n ? "text-amber-400" : "text-slate-300"}>★</span>
        </button>
      ))}
    </div>
  );
}

export default function AvisPage() {
  const router = useRouter();
  const emailParam = typeof router.query.email === "string" ? router.query.email : "";
  const nameParam = typeof router.query.name === "string" ? router.query.name : "";
  const sourceParam = typeof router.query.source === "string" ? router.query.source : "campagne";

  const [note, setNote] = useState(0);
  const [name, setName] = useState(nameParam);
  const [commentaire, setCommentaire] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (note === 0) return setError("Choisissez une note.");
    if (commentaire.trim().length < 10) return setError("Dites-nous en un peu plus (10 caractères min.).");

    setLoading(true);
    try {
      const res = await fetch("/api/reviews/campaign-submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailParam, name, note, commentaire, source: sourceParam }),
      });
      const json = await res.json();
      if (!res.ok) return setError(json.error ?? "Une erreur est survenue.");
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <Head>
        <title>Donnez votre avis — lokt.fr</title>
        <meta name="robots" content="noindex" />
      </Head>
      <AppHeader />

      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-lg">
          {submitted ? (
            <div className="bg-white rounded-2xl shadow-sm p-10 text-center">
              <div className="text-5xl mb-4">🙏</div>
              <h1 className="text-2xl font-semibold text-slate-900 mb-2">Merci pour votre avis !</h1>
              <p className="text-slate-500">
                Il sera publié sur lokt.fr après validation. Ça nous aide énormément.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm p-8 sm:p-10">
              <h1 className="text-2xl font-semibold text-slate-900 mb-1">Votre avis sur lokt.fr</h1>
              <p className="text-slate-500 mb-8 text-sm">
                2 minutes suffisent — votre retour nous aide à améliorer l'outil.
              </p>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Note globale</label>
                  <StarPicker value={note} onChange={setNote} />
                  {note > 0 && (
                    <p className="mt-1 text-xs text-slate-400">
                      {["", "Décevant", "Passable", "Bien", "Très bien", "Excellent !"][note]}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1">
                    Prénom <span className="text-slate-400 font-normal">(optionnel)</span>
                  </label>
                  <input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="ex : Thomas"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400"
                  />
                </div>

                <div>
                  <label htmlFor="commentaire" className="block text-sm font-medium text-slate-700 mb-1">
                    Votre avis <span className="text-slate-400 font-normal">(ce qui vous a plu, déplu, surpris…)</span>
                  </label>
                  <textarea
                    id="commentaire"
                    rows={4}
                    value={commentaire}
                    onChange={(e) => setCommentaire(e.target.value)}
                    placeholder="J'ai utilisé lokt.fr pour..."
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400 resize-none"
                  />
                  <p className="mt-1 text-xs text-slate-400">{commentaire.length} / 1000 caractères</p>
                </div>

                {error && (
                  <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl bg-cyan-600 px-6 py-3 text-sm font-semibold text-white hover:bg-cyan-700 disabled:opacity-50 transition-colors"
                >
                  {loading ? "Envoi en cours…" : "Envoyer mon avis"}
                </button>
              </form>
            </div>
          )}
        </div>
      </main>

      <AppFooter />
    </div>
  );
}
