import Link from "next/link";
import AppHeader from "../components/AppHeader";

export default function CGUPage() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <AppHeader />
      <main className="flex-1 px-4 py-10">
        <div className="mx-auto max-w-3xl space-y-6">
          <section className="rounded-3xl border border-slate-200 bg-white shadow-sm p-6">
            <h1 className="text-xl font-semibold text-slate-900">Conditions Générales d’Utilisation (CGU)</h1>
            <p className="text-sm text-slate-600 mt-2">
              Cette page décrit les conditions d’utilisation du service Izimo.
            </p>

            <div className="mt-4 space-y-3 text-sm text-slate-700">
              <p><span className="font-semibold">Éditeur :</span> MT Courtage &amp; Investissement</p>
              <p><span className="font-semibold">Contact :</span> mtcourtage@gmail.com</p>
              <p><span className="font-semibold">Objet :</span> mise à disposition de calculettes immobilières et d’un espace bailleur.</p>
              <p><span className="font-semibold">Responsabilité :</span> les simulations sont indicatives et ne constituent pas un conseil financier/juridique.</p>
              <p><span className="font-semibold">Compte :</span> l’utilisateur est responsable de la confidentialité de ses identifiants.</p>
              <p><span className="font-semibold">Abonnement :</span> l’accès aux fonctionnalités premium dépend du plan souscrit.</p>
            </div>

            <p className="mt-6 text-xs text-slate-500">
              Dernière mise à jour : {new Date().toLocaleDateString("fr-FR")}
            </p>

            <div className="mt-6">
              <Link href="/" className="underline text-sm text-slate-700">
                ← Retour à l’accueil
              </Link>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
