import Link from "next/link";
import AppHeader from "../components/AppHeader";

export default function ConfidentialitePage() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <AppHeader />
      <main className="flex-1 px-4 py-10">
        <div className="mx-auto max-w-3xl space-y-6">
          <section className="rounded-3xl border border-slate-200 bg-white shadow-sm p-6">
            <h1 className="text-xl font-semibold text-slate-900">
              Politique de confidentialité (RGPD)
            </h1>
            <p className="text-sm text-slate-600 mt-2">
              Cette page explique quelles données sont collectées, pourquoi, et vos droits.
            </p>

            <div className="mt-4 space-y-3 text-sm text-slate-700">
              <p><span className="font-semibold">Responsable de traitement :</span> MT Courtage &amp; Investissement</p>
              <p><span className="font-semibold">Contact :</span> mtcourtage@gmail.com</p>

              <p><span className="font-semibold">Données collectées :</span> compte (email, nom si fourni), données de simulation et données de gestion locative saisies par l’utilisateur.</p>
              <p><span className="font-semibold">Finalités :</span> fonctionnement du service, sauvegarde, accès sécurisé, support.</p>
              <p><span className="font-semibold">Base légale :</span> exécution du contrat (service), intérêt légitime (sécurité/anti-fraude), consentement si applicable.</p>
              <p><span className="font-semibold">Durées :</span> conservation pendant la durée du compte, puis suppression/archivage selon obligations légales.</p>
              <p><span className="font-semibold">Sous-traitants :</span> hébergement/analytics/auth (ex. Supabase) selon votre configuration.</p>

              <p className="pt-2">
                <span className="font-semibold">Vos droits :</span> accès, rectification, suppression, opposition, limitation, portabilité.
                Pour exercer vos droits :{" "}
                <a href="mailto:mtcourtage@gmail.com" className="underline">
                  mtcourtage@gmail.com
                </a>
              </p>
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
