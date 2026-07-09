import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";

type StatusData = {
  id: string;
  document_label: string;
  document_type: string;
  status: string;
  role: "bailleur" | "locataire";
  alreadySigned: boolean;
  expired: boolean;
  landlord_name: string;
  landlord_email: string;
  landlord_signed: boolean;
  tenant_name: string;
  tenant_email: string;
  tenant_signed: boolean;
  expires_at: string;
};

type View = "loading" | "error" | "expired" | "already" | "completed" | "form" | "signing" | "done";

async function openDocument(token: string) {
  const r = await fetch(`/api/signatures/document?token=${token}`);
  const d = await r.json();
  if (d.url) window.open(d.url, "_blank");
}

export default function SignerPage() {
  const router = useRouter();
  const token = router.query.token as string | undefined;

  const [view, setView] = useState<View>("loading");
  const [data, setData] = useState<StatusData | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!token) return;
    fetch(`/api/signatures/status?token=${token}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setView("error"); setErrorMsg(d.error); return; }
        setData(d);
        if (d.expired) { setView("expired"); return; }
        if (d.status === "completed") { setView("completed"); return; }
        if (d.alreadySigned) { setView("already"); return; }
        setView("form");
      })
      .catch(() => { setView("error"); setErrorMsg("Impossible de charger la demande."); });
  }, [token]);

  async function handleSign() {
    if (!agreed || !token) return;
    setView("signing");
    try {
      const r = await fetch("/api/signatures/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const d = await r.json();
      if (!r.ok) { setView("error"); setErrorMsg(d.error || "Erreur lors de la signature."); return; }
      if (d.status === "completed") { setView("done"); setData((prev) => prev ? { ...prev, status: "completed" } : prev); }
      else setView("done");
    } catch {
      setView("error");
      setErrorMsg("Erreur réseau. Réessayez.");
    }
  }

  const roleLabel = data?.role === "bailleur" ? "Bailleur" : "Locataire";
  const otherRole = data?.role === "bailleur" ? "Locataire" : "Bailleur";
  const otherName = data?.role === "bailleur" ? (data.tenant_name || data.tenant_email) : (data?.landlord_name || data?.landlord_email);
  const otherSigned = data?.role === "bailleur" ? data?.tenant_signed : data?.landlord_signed;

  return (
    <>
      <Head>
        <title>Signature électronique — lokt.fr</title>
        <meta name="robots" content="noindex" />
      </Head>
      <div className="min-h-screen bg-[#f6f9fc] flex flex-col items-center justify-center px-4 py-12">
        {/* Logo */}
        <Link href="/" className="mb-8 block">
          <img src="/lokt-logo-small.jpg" alt="lokt.fr" className="h-8 rounded-lg" />
        </Link>

        <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">

          {/* LOADING */}
          {view === "loading" && (
            <div className="flex items-center justify-center py-12 text-slate-400 text-sm">Chargement…</div>
          )}

          {/* ERROR */}
          {view === "error" && (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
                <span className="text-xl text-red-500">✕</span>
              </div>
              <h1 className="text-lg font-semibold text-slate-900">Lien invalide</h1>
              <p className="mt-2 text-sm text-slate-500">{errorMsg}</p>
            </div>
          )}

          {/* EXPIRED */}
          {view === "expired" && (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50">
                <span className="text-xl text-amber-500">⏱</span>
              </div>
              <h1 className="text-lg font-semibold text-slate-900">Lien expiré</h1>
              <p className="mt-2 text-sm text-slate-500">Ce lien de signature n'est plus valable. Contactez le bailleur pour obtenir un nouveau lien.</p>
            </div>
          )}

          {/* ALREADY SIGNED */}
          {view === "already" && data && (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-sky-50">
                <span className="text-xl text-sky-500">✓</span>
              </div>
              <h1 className="text-lg font-semibold text-slate-900">Vous avez déjà signé</h1>
              <p className="mt-2 text-sm text-slate-500">
                {otherSigned
                  ? "Les deux signatures ont été recueillies. Vous avez reçu le PDF signé par email."
                  : `En attente de la signature ${otherRole.toLowerCase()} (${otherName}).`}
              </p>
            </div>
          )}

          {/* COMPLETED */}
          {view === "completed" && (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
                <span className="text-xl text-emerald-500">✓</span>
              </div>
              <h1 className="text-lg font-semibold text-slate-900">Document signé</h1>
              <p className="mt-2 text-sm text-slate-500">Les deux signatures ont été recueillies. Le PDF certifié a été envoyé aux deux parties par email.</p>
            </div>
          )}

          {/* FORM */}
          {view === "form" && data && (
            <>
              <div className="mb-6">
                <span className="inline-flex items-center rounded-full border border-[#635bff]/20 bg-[#635bff]/5 px-3 py-1 text-xs font-semibold text-[#635bff]">
                  Signature électronique — {roleLabel}
                </span>
                <h1 className="mt-3 text-xl font-semibold text-slate-900">{data.document_label}</h1>
              </div>

              {/* Statut des signatures */}
              <div className="mb-6 space-y-2">
                {[
                  { role: "Bailleur", name: data.landlord_name || data.landlord_email, signed: data.landlord_signed },
                  { role: "Locataire", name: data.tenant_name || data.tenant_email, signed: data.tenant_signed },
                ].map(({ role: r, name: n, signed }) => (
                  <div key={r} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{n}</p>
                      <p className="text-xs text-slate-500">{r}</p>
                    </div>
                    <span className={`text-xs font-semibold ${signed ? "text-emerald-600" : "text-amber-600"}`}>
                      {signed ? "✓ Signé" : "En attente"}
                    </span>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => openDocument(token!)}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-slate-500 stroke-[1.8]" aria-hidden>
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" strokeLinejoin="round"/>
                  <polyline points="14,2 14,8 20,8" strokeLinejoin="round"/>
                </svg>
                Lire le document avant de signer (PDF)
              </button>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 leading-6">
                <p className="font-semibold text-slate-800 mb-2">Avant de signer</p>
                <ul className="space-y-1 text-xs text-slate-500">
                  <li>• Vous avez pris connaissance du document transmis par le bailleur.</li>
                  <li>• En cliquant sur "Je signe", vous consentez électroniquement à ce document.</li>
                  <li>• Cette action constitue une signature électronique simple au sens du règlement eIDAS.</li>
                </ul>
              </div>

              <label className="mt-5 flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-[#635bff]"
                />
                <span className="text-sm text-slate-700">
                  J'ai lu le document et je consens à le signer électroniquement.
                </span>
              </label>

              <button
                type="button"
                onClick={handleSign}
                disabled={!agreed}
                className="mt-5 w-full rounded-full bg-gradient-to-r from-[#635bff] to-[#00d4ff] px-6 py-3 text-sm font-semibold text-white hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Je signe électroniquement →
              </button>

              <p className="mt-3 text-center text-xs text-slate-400">
                Lien valable jusqu'au {new Date(data.expires_at).toLocaleDateString("fr-FR")}
              </p>
            </>
          )}

          {/* SIGNING */}
          {view === "signing" && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#635bff] border-t-transparent" />
              <p className="text-sm text-slate-500">Enregistrement de votre signature…</p>
            </div>
          )}

          {/* DONE */}
          {view === "done" && (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
                <span className="text-2xl text-emerald-500">✓</span>
              </div>
              <h1 className="text-xl font-semibold text-slate-900">Signature enregistrée</h1>
              <p className="mt-3 text-sm text-slate-500 leading-6">
                {data?.status === "completed"
                  ? "Les deux parties ont signé. Vous recevrez le PDF certifié par email dans quelques instants."
                  : `Votre signature a été enregistrée. En attente de la signature ${otherRole.toLowerCase()} (${otherName}).`}
              </p>
            </div>
          )}
        </div>

        <p className="mt-6 text-xs text-slate-400 text-center">
          Signature électronique simple — eIDAS Art. 3(10) — <Link href="https://lokt.fr" className="underline">lokt.fr</Link>
        </p>
      </div>
    </>
  );
}
