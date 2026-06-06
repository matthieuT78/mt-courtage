import Link from "next/link";

export default function AppFooter() {
  return (
    <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-500 bg-white">
      <p>© {new Date().getFullYear()} lokt.fr</p>

      <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
        <Link href="/a-propos" className="underline hover:text-slate-700">
          À propos
        </Link>
        <Link href="/guides" className="underline hover:text-slate-700">
          Ressources bailleurs
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
