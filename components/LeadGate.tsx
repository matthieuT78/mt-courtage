// components/LeadGate.tsx
import { useMemo, useState } from "react";

export default function LeadGate({
  title = "Débloquer l’analyse",
  subtitle = "Conservez votre simulation et débloquez l’analyse détaillée.",
  email,
  setEmail,
  consent,
  setConsent,
  unlocking,
  unlockMsg,
  onUnlock,
  theme = "cyan-emerald",
}: {
  title?: string;
  subtitle?: string;
  email: string;
  setEmail: (v: string) => void;
  consent: boolean;
  setConsent: (v: boolean) => void;
  unlocking: boolean;
  unlockMsg: string | null;
  onUnlock: () => void;
  theme?: "cyan-emerald" | "cyan-amber";
}) {
  const emailOk = useMemo(() => {
    const e = (email || "").trim().toLowerCase();
    return e.length > 3 && e.includes("@");
  }, [email]);

  const canClick = emailOk && consent && !unlocking;

  const haloA = theme === "cyan-amber" ? "bg-amber-400" : "bg-emerald-400";
  const haloB = "bg-cyan-500";

  return (
    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-900 text-white p-5 relative overflow-hidden">
      <div className={`absolute -top-24 -right-24 h-64 w-64 rounded-full opacity-30 blur-3xl ${haloB}`} />
      <div className={`absolute -bottom-24 -left-24 h-64 w-64 rounded-full opacity-20 blur-3xl ${haloA}`} />

      <div className="relative space-y-3">
        <p className="text-[0.7rem] uppercase tracking-[0.18em] text-cyan-200">
          DÉBLOQUER
        </p>

        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="text-sm text-slate-200">{subtitle}</p>

        <div className="mt-2 rounded-xl bg-white/5 border border-white/10 p-4 space-y-3">
          <div className="space-y-1">
            <label className="text-xs text-slate-100 font-semibold">Votre e-mail (obligatoire)</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ex: prenom.nom@gmail.com"
              className="w-full rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-slate-300 focus:outline-none focus:ring-1 focus:ring-cyan-300"
            />
            <p className="text-[0.7rem] text-slate-300">
              Utilisé pour enregistrer votre analyse et mesurer la demande (stats agrégées).
            </p>
          </div>

          <div className="rounded-lg bg-white/5 border border-white/10 p-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-white/30 bg-white/10"
              />
              <span className="text-[0.75rem] text-slate-200 leading-relaxed">
                <span className="font-semibold">J’accepte</span> que mes données soient utilisées pour enregistrer mon
                analyse et améliorer Lokt.fr (statistiques anonymisées).
              </span>
            </label>
            <p className="mt-2 text-[0.7rem] text-slate-300">
              Pas de démarchage partenaire. Aucun consentement “recontact” n’est demandé.
            </p>
          </div>

          <button
            type="button"
            onClick={onUnlock}
            disabled={!canClick}
            className="w-full inline-flex items-center justify-center rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 hover:opacity-95 disabled:opacity-60"
          >
            {unlocking ? "Déblocage..." : "Débloquer l’analyse"}
          </button>

          {unlockMsg && <p className="text-[0.75rem] text-slate-200">{unlockMsg}</p>}

          {!emailOk ? (
            <p className="text-[0.7rem] text-slate-300">Astuce : renseignez un email valide pour activer le bouton.</p>
          ) : !consent ? (
            <p className="text-[0.7rem] text-slate-300">Astuce : cochez le consentement pour activer le bouton.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
