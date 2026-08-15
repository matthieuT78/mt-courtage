import { useEffect, useState } from "react";
import Link from "next/link";

const STORAGE_KEY = "lokt:cookie-consent";
const EVENT_NAME = "lokt:cookie-consent-change";

export type CookiePreferences = { analytics: boolean };

export function getStoredCookieConsent(): CookiePreferences | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed?.analytics === "boolean" ? { analytics: parsed.analytics } : null;
  } catch {
    return null;
  }
}

function setStoredCookieConsent(prefs: CookiePreferences) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: prefs }));
}

// Rouvre le bandeau — utilisé par le lien "Gérer les cookies" du footer.
export function reopenCookieConsent() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: null }));
}

function MiniToggle({ checked, disabled, onChange, label }: { checked: boolean; disabled?: boolean; onChange?: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={`relative h-6 w-10 shrink-0 rounded-full border transition ${
        checked ? "border-[#635bff] bg-[#635bff]" : "border-slate-300 bg-slate-200"
      } ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
    >
      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition ${checked ? "left-[1.15rem]" : "left-0.5"}`} />
    </button>
  );
}

export default function CookieConsent() {
  const [stored, setStored] = useState<CookiePreferences | null | undefined>(undefined);
  const [expanded, setExpanded] = useState(false);
  const [analyticsChoice, setAnalyticsChoice] = useState(true);

  useEffect(() => {
    setStored(getStoredCookieConsent());
    const onChange = (e: Event) => {
      setStored((e as CustomEvent).detail);
      setExpanded(false);
    };
    window.addEventListener(EVENT_NAME, onChange);
    return () => window.removeEventListener(EVENT_NAME, onChange);
  }, []);

  // undefined = pas encore monté côté client (évite un flash serveur/client) ;
  // une valeur déjà choisie = rien à afficher.
  if (stored === undefined || stored !== null) return null;

  return (
    <div role="dialog" aria-label="Préférences de cookies" className="fixed inset-x-0 bottom-0 z-[90] flex justify-center px-3 pb-3 sm:px-6 sm:pb-6">
      <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/15">
        <div className="p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#635bff]/10">
              <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-[#635bff] stroke-[1.6]" aria-hidden>
                <circle cx="12" cy="12" r="9" strokeLinejoin="round" />
                <circle cx="9" cy="10" r="1.1" fill="currentColor" stroke="none" />
                <circle cx="14" cy="8.5" r="1" fill="currentColor" stroke="none" />
                <circle cx="15" cy="13.5" r="1.1" fill="currentColor" stroke="none" />
                <circle cx="10" cy="15" r="1" fill="currentColor" stroke="none" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-950">Gestion des cookies</p>
              <p className="mt-1 text-xs leading-5 text-slate-600">
                lokt.fr utilise des cookies essentiels au fonctionnement du site et, avec votre accord, des cookies de mesure d’audience
                pour comprendre l’usage du site et l’améliorer. Aucune donnée n’est utilisée à des fins publicitaires.{" "}
                <Link href="/confidentialite" className="underline underline-offset-2 hover:text-slate-900">
                  En savoir plus
                </Link>
                .
              </p>
            </div>
          </div>

          {expanded && (
            <div className="mt-4 space-y-2.5 border-t border-slate-100 pt-4">
              <div className="flex items-start justify-between gap-4 rounded-2xl bg-slate-50 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-900">Cookies essentiels</p>
                  <p className="mt-0.5 text-[0.7rem] leading-4 text-slate-500">
                    Connexion, session, préférences d’affichage. Nécessaires au fonctionnement du site, toujours actifs.
                  </p>
                </div>
                <MiniToggle checked disabled label="Cookies essentiels (toujours actifs)" />
              </div>
              <div className="flex items-start justify-between gap-4 rounded-2xl bg-slate-50 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-900">Mesure d’audience</p>
                  <p className="mt-0.5 text-[0.7rem] leading-4 text-slate-500">
                    Google Analytics et Microsoft Clarity — pages vues, parcours, points de blocage. Données anonymisées, jamais utilisées à des fins publicitaires.
                  </p>
                </div>
                <MiniToggle
                  checked={analyticsChoice}
                  onChange={() => setAnalyticsChoice((v) => !v)}
                  label="Mesure d’audience"
                />
              </div>
            </div>
          )}

          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
            {!expanded ? (
              <>
                <button
                  type="button"
                  onClick={() => setStoredCookieConsent({ analytics: false })}
                  className="inline-flex h-9 items-center justify-center rounded-full border border-slate-300 px-4 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Tout refuser
                </button>
                <button
                  type="button"
                  onClick={() => setExpanded(true)}
                  className="inline-flex h-9 items-center justify-center rounded-full border border-slate-300 px-4 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Personnaliser
                </button>
                <button
                  type="button"
                  onClick={() => setStoredCookieConsent({ analytics: true })}
                  className="inline-flex h-9 items-center justify-center rounded-full bg-slate-950 px-4 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  Tout accepter
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setStoredCookieConsent({ analytics: analyticsChoice })}
                className="inline-flex h-9 items-center justify-center rounded-full bg-slate-950 px-5 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Enregistrer mes choix
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
