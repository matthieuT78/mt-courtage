import Link from "next/link";
import AppHeader from "../components/AppHeader";

export default function CGUPage() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <AppHeader />

      <main className="flex-1 px-4 py-10">
        <div className="mx-auto max-w-3xl space-y-6">
          <section className="rounded-3xl border border-slate-200 bg-white shadow-sm p-6 space-y-4">
            <h1 className="text-xl font-semibold text-slate-900">
              Conditions Générales d’Utilisation
            </h1>

            <p className="text-sm text-slate-600">
              Les présentes Conditions Générales d’Utilisation (CGU) encadrent
              l’accès et l’utilisation du site <strong>lokt.fr</strong>.
            </p>

            <div className="space-y-3 text-sm text-slate-700">
              <p>
                <strong>Éditeur :</strong> Lokt.fr (éditeur indépendant – personne
                physique)
              </p>
              <p>
                <strong>Contact :</strong>{" "}
                <a href="mailto:contact@lokt.fr" className="underline">
                  contact@lokt.fr
                </a>
              </p>

              <hr className="my-4" />

              <p>
                <strong>Objet du service</strong>
                <br />
                Lokt.fr est un outil en ligne permettant de réaliser des
                simulations financières et immobilières, notamment :
                capacité d’emprunt, crédit immobilier, rentabilité locative et
                scénarios d’investissement.
              </p>

              <p>
                Le service est accessible librement, sans création de compte et
                sans engagement.
              </p>

              <p>
                <strong>Nature des résultats</strong>
                <br />
                Les résultats fournis sont issus de modèles de calcul
                simplifiés, basés exclusivement sur les informations saisies
                par l’utilisateur.
              </p>

              <p>
                Ils sont fournis à titre strictement indicatif et ne constituent
                en aucun cas :
              </p>

              <ul className="list-disc pl-5">
                <li>un conseil financier,</li>
                <li>un conseil fiscal,</li>
                <li>un conseil juridique,</li>
                <li>ou une recommandation d’investissement.</li>
              </ul>

              <p>
                L’utilisateur reste seul responsable des décisions qu’il prend
                sur la base des simulations.
              </p>

              <p>
                <strong>Absence de relation contractuelle</strong>
                <br />
                L’utilisation de Lokt.fr ne constitue ni un mandat, ni une
                relation de conseil, ni une offre de financement.
                Lokt.fr est un outil de simulation, pas un établissement
                financier, ni un courtier.
              </p>

              <p>
                <strong>Responsabilité</strong>
                <br />
                Lokt.fr ne peut être tenu responsable des écarts entre les
                résultats simulés et la réalité, ni des conséquences financières
                des décisions prises par l’utilisateur.
              </p>

              <p>
                Les données de marché, taux, loyers ou hypothèses peuvent être
                incomplets, approximatifs ou évoluer dans le temps.
              </p>

              <p>
                <strong>Accès au service</strong>
                <br />
                Lokt.fr est fourni « en l’état ». L’éditeur se réserve le droit
                de modifier, suspendre ou interrompre le service à tout moment,
                sans préavis.
              </p>

              <p>
                <strong>Propriété intellectuelle</strong>
                <br />
                L’ensemble du site, des outils, des calculs et de l’interface
                est protégé par le droit de la propriété intellectuelle.
                Toute reproduction non autorisée est interdite.
              </p>

              <p>
                <strong>Données personnelles</strong>
                <br />
                Les règles de traitement des données sont décrites dans la page{" "}
                <Link href="/confidentialite" className="underline">
                  Politique de confidentialité
                </Link>.
              </p>

              <p>
                <strong>Droit applicable</strong>
                <br />
                Le site est soumis au droit français.
              </p>
            </div>

            <p className="mt-6 text-xs text-slate-500">
              Dernière mise à jour : {new Date().toLocaleDateString("fr-FR")}
            </p>

            <div className="pt-4">
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
