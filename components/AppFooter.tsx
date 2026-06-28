import Link from "next/link";

function BadgeGDPR() {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5">
      <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0" aria-hidden>
        <circle cx="10" cy="10" r="9" fill="#003399" />
        {Array.from({ length: 12 }).map((_, i) => {
          const angle = (i * 30 * Math.PI) / 180;
          const x = 10 + 5.5 * Math.sin(angle);
          const y = 10 - 5.5 * Math.cos(angle);
          return <circle key={i} cx={x} cy={y} r="1.1" fill="#FFCC00" />;
        })}
        <path d="M10 6.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zm0 1.5a2 2 0 1 1 0 4 2 2 0 0 1 0-4z" fill="#FFCC00" />
        <path d="M9 9.5h2v3.5H9z" fill="#FFCC00" />
      </svg>
      <div className="leading-none">
        <p className="text-[0.55rem] font-bold tracking-wide text-slate-700">GDPR</p>
        <p className="text-[0.5rem] text-slate-500">COMPLIANT</p>
      </div>
    </div>
  );
}

function BadgeSSL() {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5">
      <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-emerald-600" fill="none" aria-hidden>
        <rect x="4" y="9" width="12" height="8" rx="2" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="1.4" />
        <path d="M7 9V7a3 3 0 0 1 6 0v2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        <circle cx="10" cy="13" r="1.2" fill="currentColor" />
      </svg>
      <div className="leading-none">
        <p className="text-[0.55rem] font-bold tracking-wide text-slate-700">SSL</p>
        <p className="text-[0.5rem] text-slate-500">SECURE</p>
      </div>
    </div>
  );
}

function BadgeFrance() {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5">
      <svg viewBox="0 0 20 14" className="h-3.5 w-5 shrink-0 rounded-sm overflow-hidden" aria-hidden>
        <rect width="7" height="14" fill="#002395" />
        <rect x="7" width="6" height="14" fill="#fff" />
        <rect x="13" width="7" height="14" fill="#ED2939" />
      </svg>
      <div className="leading-none">
        <p className="text-[0.55rem] font-bold tracking-wide text-slate-700">CONÇU EN</p>
        <p className="text-[0.5rem] text-slate-500">FRANCE</p>
      </div>
    </div>
  );
}

function BadgeEU() {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5">
      <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0" aria-hidden>
        <circle cx="10" cy="10" r="9" fill="#003399" />
        {Array.from({ length: 12 }).map((_, i) => {
          const angle = (i * 30 * Math.PI) / 180;
          const x = 10 + 5.5 * Math.sin(angle);
          const y = 10 - 5.5 * Math.cos(angle);
          return <circle key={i} cx={x} cy={y} r="1.1" fill="#FFCC00" />;
        })}
      </svg>
      <div className="leading-none">
        <p className="text-[0.55rem] font-bold tracking-wide text-slate-700">DONNÉES</p>
        <p className="text-[0.5rem] text-slate-500">EN EUROPE</p>
      </div>
    </div>
  );
}

export default function AppFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white py-8 text-center text-xs text-slate-500">
      {/* Badges de confiance */}
      <div className="flex flex-wrap items-center justify-center gap-2 px-4">
        <BadgeSSL />
        <BadgeFrance />
        <BadgeEU />
      </div>

      <p className="mt-5">© {new Date().getFullYear()} lokt.fr</p>

      <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
        <Link href="/rendement-locatif" className="underline hover:text-slate-700">
          Rendement locatif par ville
        </Link>
        <Link href="/investissement-locatif" className="underline hover:text-slate-700">
          Investissement locatif
        </Link>
        <Link href="/calculettes" className="underline hover:text-slate-700">
          Calculettes
        </Link>
        <Link href="/blog" className="underline hover:text-slate-700">
          Blog immobilier
        </Link>
        <Link href="/guides" className="underline hover:text-slate-700">
          Guides bailleurs
        </Link>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
        <Link href="/a-propos" className="underline hover:text-slate-700">
          À propos
        </Link>
        <Link href="/cgu" className="underline hover:text-slate-700">
          CGU / CGV
        </Link>
        <Link href="/confidentialite" className="underline hover:text-slate-700">
          Confidentialité (RGPD)
        </Link>
        <a href="mailto:contact@lokt.fr" className="underline hover:text-slate-700">
          Contact
        </a>
      </div>
    </footer>
  );
}
