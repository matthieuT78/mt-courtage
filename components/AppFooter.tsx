import Link from "next/link";

export default function AppFooter() {
  return (
    <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-500 bg-white">
      <p>© {new Date().getFullYear()} Izimo</p>

      <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
        <Link href="/cgu" className="underline hover:text-slate-700">
          CGU
        </Link>
        <Link href="/confidentialite" className="underline hover:text-slate-700">
          Confidentialité (RGPD)
        </Link>
        <a href="mailto:mtcourtage@gmail.com" className="underline hover:text-slate-700">
          Contact
        </a>
      </div>
    </footer>
  );
}
