import Link from "next/link";
import { reopenCookieConsent } from "./CookieConsent";

function BadgeStripe() {
  return (
    <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
      <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-[#635bff]" fill="none" aria-hidden>
        <rect x="4" y="9" width="12" height="8" rx="2" fill="currentColor" fillOpacity="0.12" stroke="currentColor" strokeWidth="1.4" />
        <path d="M7 9V7a3 3 0 0 1 6 0v2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        <circle cx="10" cy="13" r="1.2" fill="currentColor" />
      </svg>
      <div className="leading-none">
        <p className="text-[0.6rem] font-bold tracking-wide text-slate-800">PAIEMENT SÉCURISÉ</p>
        <p className="mt-0.5 text-[0.55rem] text-slate-400">par Stripe</p>
      </div>
    </div>
  );
}

function BadgeSources() {
  return (
    <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
      <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-emerald-600" fill="none" aria-hidden>
        <path d="M5 3h10a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" stroke="currentColor" strokeWidth="1.4" />
        <path d="M7 9l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M7 14h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.45" />
      </svg>
      <div className="leading-none">
        <p className="text-[0.6rem] font-bold tracking-wide text-slate-800">SOURCES OFFICIELLES</p>
        <p className="mt-0.5 text-[0.55rem] text-slate-400">Légifrance · Service-Public · INSEE</p>
      </div>
    </div>
  );
}

function BadgeFrance() {
  return (
    <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
      <svg viewBox="0 0 20 14" className="h-3.5 w-5 shrink-0 overflow-hidden rounded-sm" aria-hidden>
        <rect width="7" height="14" fill="#002395" />
        <rect x="7" width="6" height="14" fill="#fff" />
        <rect x="13" width="7" height="14" fill="#ED2939" />
      </svg>
      <div className="leading-none">
        <p className="text-[0.6rem] font-bold tracking-wide text-slate-800">ÉDITEUR FRANÇAIS</p>
        <p className="mt-0.5 text-[0.55rem] text-slate-400">Indépendant</p>
      </div>
    </div>
  );
}

export default function AppFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white py-8 text-center text-xs text-slate-500">
      {/* Badges de confiance */}
      <div className="flex flex-wrap items-center justify-center gap-2 px-4">
        <BadgeStripe />
        <BadgeSources />
        <BadgeFrance />
      </div>

      <div className="mx-auto mt-6 h-px w-full max-w-3xl bg-slate-100" />

      <div className="mt-5">
        <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-slate-400">Ressources</p>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          <Link href="/rendement-locatif" className="underline hover:text-slate-700">
            Rendement locatif par ville
          </Link>
          <Link href="/prix-m2" className="underline hover:text-slate-700">
            Prix au m² par ville
          </Link>
          <Link href="/investissement-locatif" className="underline hover:text-slate-700">
            Investissement locatif
          </Link>
          <Link href="/calculettes" className="underline hover:text-slate-700">
            Calculettes
          </Link>
          <Link href="/comparatif-logiciel-gestion-locative" className="underline hover:text-slate-700">
            Comparatif logiciels
          </Link>
          <Link href="/loky-assistant-ia" className="underline hover:text-slate-700">
            Loky, l’assistant IA
          </Link>
          <Link href="/blog" className="underline hover:text-slate-700">
            Blog immobilier
          </Link>
          <Link href="/guides" className="underline hover:text-slate-700">
            Guides bailleurs
          </Link>
        </div>
      </div>

      <div className="mt-4">
        <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-slate-400">Lokt.fr</p>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          <Link href="/a-propos" className="underline hover:text-slate-700">
            À propos
          </Link>
          <a href="mailto:contact@lokt.fr" className="underline hover:text-slate-700">
            Contact
          </a>
          <Link href="/cgu" className="underline hover:text-slate-700">
            CGU / CGV
          </Link>
          <Link href="/confidentialite" className="underline hover:text-slate-700">
            Confidentialité (RGPD)
          </Link>
          <button type="button" onClick={() => reopenCookieConsent()} className="underline hover:text-slate-700">
            Gérer les cookies
          </button>
        </div>
      </div>

      <p className="mt-5 text-slate-400">© {new Date().getFullYear()} lokt.fr</p>

      <div className="mt-4">
        <a
          href="https://www.outils-immo.fr/outils/lokt-fr/?utm_source=badge&utm_medium=website"
          target="_blank"
          rel="noopener"
          style={{ display: "inline-block", textDecoration: "none", fontFamily: "Inter,-apple-system,BlinkMacSystemFont,sans-serif", background: "linear-gradient(135deg,#4f46e5,#7c3aed)", color: "#fff", padding: "10px 16px", borderRadius: "10px", lineHeight: 1.5, boxShadow: "0 4px 12px rgba(79,70,229,0.3)" }}
        >
          <span style={{ display: "block", fontSize: "11px" }}>
            <strong>lokt.fr</strong> est recommandé par <strong>outils-immo.fr</strong>
          </span>
        </a>
      </div>
    </footer>
  );
}
