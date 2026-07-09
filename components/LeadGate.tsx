// components/LeadGate.tsx
import { useMemo } from "react";

export default function LeadGate({
  title = "Recevoir mon rapport personnalisé",
  subtitle = "Score, points de vigilance et plan d’action clair à conserver.",
  email,
  setEmail,
  phone,
  setPhone,
  contactConsent,
  setContactConsent,
  unlocking,
  unlockMsg,
  onUnlock,
  theme = "cyan-emerald",

  sendingEmail,
  sendEmailMsg,
}: {
  title?: string;
  subtitle?: string;
  email: string;
  setEmail: (v: string) => void;
  phone?: string;
  setPhone?: (v: string) => void;
  consent?: boolean;
  setConsent?: (v: boolean) => void;
  contactConsent?: boolean;
  setContactConsent?: (v: boolean) => void;
  unlocking: boolean;
  unlockMsg: string | null;
  onUnlock: () => void;
  theme?: "cyan-emerald" | "cyan-amber";

  sendByEmail?: boolean;
  setSendByEmail?: (v: boolean) => void;
  sendingEmail?: boolean;
  sendEmailMsg?: string | null;
}) {
  const emailOk = useMemo(() => {
    const e = (email || "").trim().toLowerCase();
    return e.length > 3 && e.includes("@");
  }, [email]);

  const canClick = emailOk && !unlocking;

  const haloA = theme === "cyan-amber" ? "bg-amber-400" : "bg-emerald-400";
  const haloB = "bg-cyan-500";

  const showPhone = typeof phone === "string" && typeof setPhone === "function";
  const showContactConsent =
    typeof contactConsent === "boolean" && typeof setContactConsent === "function";

  return (
    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-900 text-white p-5 relative overflow-hidden">
      <div className={`absolute -top-24 -right-24 h-64 w-64 rounded-full opacity-30 blur-3xl ${haloB}`} />
      <div className={`absolute -bottom-24 -left-24 h-64 w-64 rounded-full opacity-20 blur-3xl ${haloA}`} />

      <div className="relative space-y-3">
        <p className="text-[0.7rem] uppercase tracking-[0.18em] text-cyan-200">
          RAPPORT PERSONNALISÉ
        </p>

        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="text-sm text-slate-200">{subtitle}</p>

        <div className="mt-2 rounded-xl bg-white/5 border border-white/10 p-4 space-y-4">
          {/* Email */}
          <div className="space-y-1">
            <label className="text-xs text-slate-100 font-semibold">
              Votre e-mail (obligatoire)
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ex: prenom.nom@gmail.com"
              className="w-full rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-slate-300 focus:outline-none focus:ring-1 focus:ring-cyan-300"
            />
            <p className="text-[0.7rem] text-slate-300">
              Utilisé pour vous envoyer le rapport et retrouver votre simulation.{" "}
              <a href="/confidentialite" className="underline hover:text-white">En savoir plus sur vos données personnelles</a>.
            </p>
          </div>

          {showPhone ? (
            <div className="space-y-1">
              <label className="text-xs text-slate-100 font-semibold">
                Téléphone <span className="font-normal text-slate-400">(optionnel)</span>
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone!(e.target.value)}
                placeholder="ex: 06 12 34 56 78"
                className="w-full rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-slate-300 focus:outline-none focus:ring-1 focus:ring-cyan-300"
              />
              <p className="text-[0.7rem] text-slate-300">
                Pour être rappelé(e) rapidement par un conseiller partenaire.
              </p>
            </div>
          ) : null}

          {showContactConsent ? (
            <div
              className="rounded-lg bg-white/5 border border-white/10 p-3 cursor-pointer"
              onClick={() => setContactConsent(!contactConsent)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  setContactConsent(!contactConsent);
                }
              }}
            >
              <div className="flex items-start gap-3">
                <input
                  id="lokt-contact-consent"
                  type="checkbox"
                  checked={!!contactConsent}
                  onChange={(e) => setContactConsent(e.target.checked)}
                  onClick={(e) => e.stopPropagation()}
                  className="mt-1 h-4 w-4 accent-cyan-400"
                />
                <label
                  htmlFor="lokt-contact-consent"
                  className="text-[0.75rem] text-slate-200 leading-relaxed cursor-pointer"
                >
                  <span className="font-semibold">Optionnel :</span> j’accepte d’être mis en relation avec un conseiller partenaire pour aller plus loin sur mon projet.
                  <span className="block mt-1 text-[0.7rem] text-slate-300">
                    Cette case n’est pas obligatoire pour recevoir le rapport.
                  </span>
                </label>
              </div>
            </div>
          ) : null}

          {/* CTA */}
          <button
            type="button"
            onClick={onUnlock}
            disabled={!canClick}
            className="w-full inline-flex items-center justify-center rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 hover:opacity-95 disabled:opacity-60"
          >
            {unlocking ? "Préparation..." : "Recevoir mon rapport"}
          </button>

          {unlockMsg && (
            <p className="text-[0.75rem] text-slate-200">{unlockMsg}</p>
          )}
          {sendingEmail ? <p className="text-[0.7rem] text-slate-300">Envoi de l’email…</p> : null}
          {sendEmailMsg ? <p className="text-[0.7rem] text-slate-200">{sendEmailMsg}</p> : null}

          {!emailOk ? (
            <p className="text-[0.7rem] text-slate-300">
              Astuce : renseignez un email valide pour activer le bouton.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
