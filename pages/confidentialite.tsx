import Link from "next/link";
import AppHeader from "../components/AppHeader";

export default function ConfidentialitePage() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <AppHeader />

      <main className="flex-1 px-4 py-10">
        <div className="mx-auto max-w-3xl space-y-6">
          <section className="rounded-3xl border border-slate-200 bg-white shadow-sm p-6 space-y-4">
            <h1 className="text-xl font-semibold text-slate-900">
              Politique de confidentialité (RGPD)
            </h1>

            <p className="text-sm text-slate-600">
              Cette page explique quelles données sont collectées sur Lokt.fr,
              pourquoi elles le sont, et quels sont vos droits.
            </p>

            <div className="space-y-3 text-sm text-slate-700">
              <p>
                <strong>Responsable de traitement :</strong> Lokt.fr (éditeur indépendant – personne physique)
              </p>

              <p>
                <strong>Contact :</strong>{" "}
                <a href="mailto:contact@lokt.fr" className="underline">
                  contact@lokt.fr
                </a>
              </p>

              <hr className="my-4" />

              <p>
                <strong>Quelles données sont collectées ?</strong>
                <br />
                Lokt.fr collecte uniquement les données que vous saisissez volontairement
                lors de l’utilisation des outils de simulation, notamment :
              </p>

              <ul className="list-disc pl-5">
                <li>Données de simulation (prix, loyers, charges, crédit, etc.)</li>
                <li>Localisation du bien (ville, code postal, surface)</li>
                <li>Adresse e-mail si vous choisissez de la fournir pour débloquer ou sauvegarder une analyse</li>
              </ul>

              <p>
                Aucune donnée sensible n’est demandée ni traitée.
              </p>

              <p>
                <strong>À quoi servent ces données ?</strong>
                <br />
                Les données sont utilisées exclusivement pour :
              </p>

              <ul className="list-disc pl-5">
                <li>Calculer vos résultats (rentabilité, cash-flow, graphiques)</li>
                <li>Afficher vos dashboards et analyses</li>
                <li>Améliorer la qualité et la pertinence des outils Lokt.fr (statistiques anonymisées)</li>
              </ul>

              <p>
                Vos données ne sont jamais revendues, ni partagées à des partenaires commerciaux.
              </p>

              <p>
                <strong>Où sont stockées les données ?</strong>
                <br />
                Les données sont stockées sur des serveurs sécurisés opérés par des prestataires techniques
                (par exemple l’hébergement et la base de données), situés dans l’Union Européenne
                ou offrant des garanties conformes au RGPD.
              </p>

              <p>
                <strong>Combien de temps sont-elles conservées ?</strong>
                <br />
                Les données sont conservées tant qu’elles sont utiles pour :
              </p>

              <ul className="list-disc pl-5">
                <li>vous restituer vos résultats et analyses</li>
                <li>améliorer le service Lokt.fr</li>
              </ul>

              <p>
                Vous pouvez demander leur suppression à tout moment.
              </p>

              <p>
                <strong>Vos droits</strong>
                <br />
                Conformément au RGPD, vous disposez des droits suivants :
              </p>

              <ul className="list-disc pl-5">
                <li>Droit d’accès à vos données</li>
                <li>Droit de rectification</li>
                <li>Droit à l’effacement (suppression)</li>
                <li>Droit à la limitation du traitement</li>
                <li>Droit d’opposition</li>
                <li>Droit à la portabilité</li>
              </ul>

              <p>
                Pour exercer vos droits, il suffit d’écrire à :
                <br />
                <a href="mailto:contact@lokt.fr" className="underline">
                  contact@lokt.fr
                </a>
              </p>

              <p>
                Toute demande de suppression entraîne l’effacement de vos données de simulation
                dans les meilleurs délais, sauf obligation légale contraire.
              </p>

              <p>
                <strong>Cookies</strong>
                <br />
                Lokt.fr utilise uniquement des cookies techniques nécessaires
                au bon fonctionnement du site.
                Aucun cookie publicitaire ou de traçage tiers n’est utilisé.
              </p>

              <p>
                <strong>Évolution de la politique</strong>
                <br />
                Cette politique pourra évoluer en fonction de l’évolution du service.
                La version en vigueur est toujours celle publiée sur cette page.
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
