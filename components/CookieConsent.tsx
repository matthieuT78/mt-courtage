import { useEffect, useState } from "react";
import Link from "next/link";

const STORAGE_KEY = "lokt:cookie-consent";
const EVENT_NAME = "lokt:cookie-consent-change";

export type CookieConsentValue = "accepted" | "refused";

export function getStoredCookieConsent(): CookieConsentValue | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v === "accepted" || v === "refused" ? v : null;
}

function setStoredCookieConsent(value: CookieConsentValue) {
  window.localStorage.setItem(STORAGE_KEY, value);
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: value }));
}

// Rouvre le bandeau — utilisé par le lien "Gérer les cookies" du footer.
export function reopenCookieConsent() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: null }));
}

export default function CookieConsent() {
  const [choice, setChoice] = useState<CookieConsentValue | null | undefined>(undefined);

  useEffect(() => {
    setChoice(getStoredCookieConsent());
    const onChange = (e: Event) => setChoice((e as CustomEvent).detail);
    window.addEventListener(EVENT_NAME, onChange);
    return () => window.removeEventListener(EVENT_NAME, onChange);
  }, []);

  // undefined = pas encore monté côté client (évite un flash serveur/client) ;
  // une valeur déjà choisie = rien à afficher.
  if (choice === undefined || choice !== null) return null;

  return (
    <div
      role="dialog"
      aria-label="Consentement cookies"
      className="fixed inset-x-0 bottom-0 z-[90] border-t border-slate-200 bg-white/97 px-4 py-4 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-5 text-slate-600 sm:max-w-2xl">
          lokt.fr utilise un cookie de mesure d'audience (Google Analytics) pour comprendre l'usage du site public.
          Aucune donnée n'est utilisée à des fins publicitaires.{" "}
          <Link href="/confidentialite" className="underline underline-offset-2 hover:text-slate-900">
            En savoir plus
          </Link>
          .
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => setStoredCookieConsent("refused")}
            className="inline-flex h-9 items-center justify-center rounded-full border border-slate-300 px-4 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Refuser
          </button>
          <button
            type="button"
            onClick={() => setStoredCookieConsent("accepted")}
            className="inline-flex h-9 items-center justify-center rounded-full bg-slate-950 px-4 text-xs font-semibold text-white hover:bg-slate-800"
          >
            Accepter
          </button>
        </div>
      </div>
    </div>
  );
}
