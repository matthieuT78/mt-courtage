import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

// Extrait de pages/mon-compte/abonnement.tsx pour être réutilisable ailleurs
// (cockpit) sans dupliquer la logique de lien/récompense — le programme de
// parrainage existait déjà (webhook Stripe, tracking de récompense) mais
// n'était visible que dans les réglages de facturation, jamais vu par la
// plupart des bailleurs.
export function ReferralCard({ userId, referralCode: codeOverride }: { userId: string; referralCode?: string }) {
  const referralCode = codeOverride || userId.replace(/-/g, "").slice(0, 8).toUpperCase();
  const referralLink =
    typeof window !== "undefined"
      ? `${window.location.origin}?ref=${referralCode}`
      : `https://lokt.fr?ref=${referralCode}`;
  const shareMessage = `Je gère mes locations avec lokt.fr, un outil gratuit pour les bailleurs. Avec mon lien, on a chacun 3 mois à -50% si tu t'abonnes : ${referralLink}`;
  const [copied, setCopied] = useState(false);
  const [filleulCount, setFilleulCount] = useState<number | null>(null);
  const [rewarded, setRewarded] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);

  useEffect(() => {
    setCanNativeShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  useEffect(() => {
    // Passe par l'API (service role) plutôt qu'une requête client directe :
    // RLS sur profiles ne laisse jamais un utilisateur lire la fiche d'un
    // autre, même filtrée par referred_by — la requête directe renvoyait
    // toujours un tableau vide, quelle que soit la réalité.
    const load = async () => {
      try {
        if (!supabase) return;
        const { data: session } = await supabase.auth.getSession();
        const token = session.session?.access_token;
        if (!token) return;
        const res = await fetch("/api/referral/stats", { headers: { Authorization: `Bearer ${token}` } });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json?.ok) return;
        setFilleulCount(json.filleulCount ?? 0);
        setRewarded(!!json.rewarded);
      } catch {
        // Non bloquant — le widget reste utilisable sans les stats.
      }
    };
    load();
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {}
  };

  const handleNativeShare = async () => {
    try {
      await navigator.share({ title: "lokt.fr", text: shareMessage });
    } catch {}
  };

  return (
    <div className="rounded-3xl border border-[#635bff]/20 bg-gradient-to-br from-[#f6f9fc] to-white shadow-sm px-6 py-6 sm:px-8">
      <div className="flex gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#635bff]/10 text-[#635bff]">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="20 12 20 22 4 22 4 12" />
            <rect x="2" y="7" width="20" height="5" />
            <line x1="12" y1="22" x2="12" y2="7" />
            <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
            <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
          </svg>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900">Parrainez un bailleur — 3 mois à −50 % pour vous deux</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Invitez un propriétaire à rejoindre lokt.fr avec votre lien. Dès qu'il souscrit,{" "}
            <strong className="font-semibold text-slate-900">vous bénéficiez tous les deux de 3 mois à moitié prix</strong>{" "}
            — appliqués automatiquement sur vos abonnements respectifs.
          </p>

          <div className="mt-4">
            <p className="text-xs font-semibold text-slate-700 mb-2">Votre lien de parrainage</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                <p className="truncate font-mono text-xs text-slate-700">{referralLink}</p>
              </div>
              <button
                type="button"
                onClick={handleCopy}
                className={
                  "shrink-0 rounded-xl border px-4 py-2.5 text-xs font-semibold transition " +
                  (copied
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 bg-white text-slate-900 hover:bg-slate-50")
                }
              >
                {copied ? "Copié ✓" : "Copier"}
              </button>
            </div>

            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <a
                href={`https://wa.me/?text=${encodeURIComponent(shareMessage)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                WhatsApp
              </a>
              <a
                href={`mailto:?subject=${encodeURIComponent("lokt.fr — gestion locative")}&body=${encodeURIComponent(shareMessage)}`}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Email
              </a>
              {canNativeShare ? (
                <button
                  type="button"
                  onClick={handleNativeShare}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Autre appli…
                </button>
              ) : null}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-center">
              <p className="text-lg font-semibold text-slate-900">{filleulCount ?? "…"}</p>
              <p className="text-xs text-slate-500">filleul{(filleulCount ?? 0) > 1 ? "s" : ""}</p>
            </div>
            {rewarded ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5">
                <p className="text-xs font-semibold text-emerald-700">Récompense appliquée ✓</p>
                <p className="text-xs text-emerald-600">3 mois à −50 % activés sur votre abonnement</p>
              </div>
            ) : (filleulCount ?? 0) > 0 ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5">
                <p className="text-xs font-semibold text-amber-700">En attente de souscription</p>
                <p className="text-xs text-amber-600">La récompense s'active dès que votre filleul souscrit</p>
              </div>
            ) : null}
          </div>

          <p className="mt-3 text-xs text-slate-500">
            Code personnel :{" "}
            <span className="font-mono font-semibold text-slate-700">{referralCode}</span>
            {" "}· Votre filleul peut aussi le mentionner à{" "}
            <a href="mailto:contact@lokt.fr?subject=Parrainage%20lokt.fr" className="underline hover:text-slate-700">
              contact@lokt.fr
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
