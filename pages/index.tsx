// pages/capacite.tsx
import AppHeader from "../components/AppHeader";
import CapaciteWizard from "../components/CapaciteWizard";

export default function CapaciteEmpruntPage() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <AppHeader />

      <main className="flex-1 px-4 py-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-2">
            <p className="text-xs uppercase tracking-[0.18em] text-emerald-600">
              Calculette capacité d&apos;emprunt
            </p>
            <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">
              Votre capacité d’emprunt immobilier, avec une logique proche des
              banques
            </h1>
            <p className="text-xs text-slate-600 max-w-2xl">
              Revenus, charges, crédits en cours et loyers locatifs pris à
              70&nbsp;% : vous obtenez une estimation réaliste de votre
              mensualité maximale, du capital empruntable et d&apos;un prix de
              bien indicatif à présenter à votre banque ou à votre courtier.
            </p>
          </section>

          <CapaciteWizard showSaveButton={true} />
        </div>
      </main>

      <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-500 bg-white">
        <p>
          © {new Date().getFullYear()} MT Courtage &amp; Investissement –
          Simulations indicatives.
        </p>
        <p className="mt-1">
          Contact :{" "}
          <a href="mailto:mtcourtage@gmail.com" className="underline">
            mtcourtage@gmail.com
          </a>
        </p>
      </footer>
    </div>
  );
}
