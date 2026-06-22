import Head from "next/head";
import Link from "next/link";
import AppHeader from "../components/AppHeader";
import AppFooter from "../components/AppFooter";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      <div className="space-y-2 text-sm leading-6 text-slate-700">{children}</div>
    </section>
  );
}

export default function CGUPage() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <Head>
        <title>Conditions générales d’utilisation et de vente | lokt.fr</title>
        <meta
          name="description"
          content="Conditions générales d’utilisation et de vente de lokt.fr : simulateurs immobiliers, espace bailleur, abonnements, limites et responsabilités."
        />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://lokt.fr/cgu" />
      </Head>

      <AppHeader staticMode />

      <main className="flex-1 px-4 py-10">
        <div className="mx-auto max-w-4xl space-y-6">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-cyan-700">Document contractuel</p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-950">Conditions Générales d’Utilisation et de Vente</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              Les présentes conditions encadrent l’accès et l’utilisation du site <strong>lokt.fr</strong>, des simulateurs immobiliers et de
              l’espace bailleur. Elles s’appliquent à toute personne qui consulte le site, crée un compte ou souscrit une offre payante.
            </p>

            <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
              lokt.fr est un outil d’aide à la gestion et à la décision. Il ne remplace pas un professionnel du droit, du chiffre, de la fiscalité,
              du crédit ou de la gestion immobilière.
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="space-y-6">
              <Section title="1. Éditeur et contact">
                <p>
                  <strong>Éditeur :</strong> lokt.fr, éditeur indépendant. Les informations légales complètes pourront être précisées lors de la
                  finalisation de la mise en production commerciale.
                </p>
                <p>
                  <strong>Contact :</strong>{" "}
                  <a href="mailto:contact@lokt.fr" className="underline">
                    contact@lokt.fr
                  </a>
                </p>
              </Section>

              <Section title="2. Description du service">
                <p>lokt.fr propose notamment :</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>des simulateurs immobiliers : capacité d’emprunt, prêt relais, rentabilité locative, plus-value, analyse de parc ;</li>
                  <li>un espace bailleur pour gérer biens, locataires, baux, quittances, finances, états des lieux, inventaire et documents ;</li>
                  <li>des workflows d’automatisation, d’alertes et d’aide à la déclaration selon l’offre souscrite ;</li>
                  <li>un cockpit de pilotage : score de gestion, alertes météo sur les biens, widget d’actualité immobilière et indicateurs financiers ;</li>
                  <li>un portail locataire permettant d’accéder aux documents partagés par le bailleur.</li>
                </ul>
                <p>
                  Le service peut évoluer régulièrement afin d’améliorer les fonctionnalités, la présentation et les limites d’usage proposées.
                </p>
              </Section>

              <Section title="3. Compte utilisateur">
                <p>
                  La création d’un compte peut être nécessaire pour accéder à l’espace bailleur, sauvegarder des données ou souscrire un abonnement.
                  L’utilisateur s’engage à fournir des informations exactes, à maintenir la confidentialité de ses accès et à signaler toute
                  utilisation non autorisée de son compte.
                </p>
              </Section>

              <Section title="4. Offres, limites et abonnements">
                <p>Le modèle tarifaire en vigueur est le suivant :</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>
                    <strong>Gratuit :</strong> 1 logement actif, avec gestion manuelle des quittances et accès aux fonctions de base (biens, locataires, baux, finances, états des lieux).
                  </li>
                  <li>
                    <strong>Starter — 4,90 € / mois (ou 49 € / an) :</strong> jusqu’à 3 logements actifs, avec automatisation des quittances, envoi email au locataire, validation du paiement, alertes métier et portail locataire.
                  </li>
                  <li>
                    <strong>Essentiel — 9,90 € / mois (ou 99 € / an) :</strong> jusqu’à 10 logements actifs, avec pilotage avancé, boîte à outils bailleur, simulateurs LMNP/IRL, aide à la déclaration et exports.
                  </li>
                  <li>
                    <strong>Pro / agence :</strong> offre en cours de déploiement, non disponible à ce jour. Destinée aux gestionnaires multi-biens et agences avec coffre-fort documentaire et traçabilité équipe.
                  </li>
                </ul>
                <p>
                  Les tarifs applicables sont ceux affichés sur la page{" "}
                  <Link href="/tarifs" className="underline">
                    Tarifs
                  </Link>{" "}
                  au moment de la souscription. lokt.fr peut faire évoluer ses offres, avec information préalable lorsque cela affecte un abonnement en
                  cours.
                </p>
              </Section>

              <Section title="5. Paiement et facturation">
                <p>
                  Les paiements des abonnements sont traités par Stripe. lokt.fr ne conserve pas les numéros complets de carte bancaire. Une
                  souscription payante donne accès aux fonctionnalités comprises dans l’offre tant que l’abonnement est actif et que le paiement est
                  honoré.
                </p>
                <p>
                  En cas d’échec de paiement, d’annulation ou d’expiration de l’abonnement, l’accès aux fonctionnalités payantes peut être suspendu
                  ou limité. Les données existantes restent consultables dans les limites techniques et légales du service.
                </p>
              </Section>

              <Section title="6. Droit de rétractation">
                <p>
                  Pour les utilisateurs consommateurs, un droit de rétractation de 14 jours peut s’appliquer aux achats à distance, conformément au
                  droit de la consommation. Lorsque l’utilisateur demande l’accès immédiat à un service numérique payant avant la fin de ce délai,
                  les modalités de rétractation peuvent dépendre de l’exécution déjà commencée et des choix exprimés lors du paiement.
                </p>
                <p>
                  Toute demande peut être adressée à{" "}
                  <a href="mailto:contact@lokt.fr" className="underline">
                    contact@lokt.fr
                  </a>
                  .
                </p>
              </Section>

              <Section title="7. Quittances, documents et automatisations">
                <p>
                  Les documents générés par lokt.fr sont préparés à partir des informations saisies ou confirmées par l’utilisateur. L’utilisateur reste
                  responsable de vérifier leur exactitude avant utilisation, signature, transmission ou archivage.
                </p>
                <p>
                  Une quittance de loyer ne doit être générée et transmise qu’après paiement effectif du loyer et des charges concernés. Les
                  workflows automatiques, rappels et envois email sont des aides opérationnelles : ils ne dispensent pas le bailleur de contrôler la
                  réalité du paiement.
                </p>
              </Section>

              <Section title="8. Simulations, fiscalité et aide à la déclaration">
                <p>
                  Les résultats de simulation, analyses de rentabilité, calculs fiscaux et aides à la déclaration sont fournis à titre indicatif. Ils
                  peuvent être incomplets, approximatifs ou dépendre de règles qui évoluent. Ils ne constituent ni un conseil juridique, ni un conseil
                  fiscal, ni une recommandation d’investissement.
                </p>
                <p>
                  L’utilisateur reste seul responsable de ses déclarations, décisions financières, arbitrages patrimoniaux et démarches auprès de
                  l’administration ou de ses conseils.
                </p>
              </Section>

              <Section title="9. Responsabilité">
                <p>
                  lokt.fr est fourni « en l’état ». Malgré le soin apporté au service, l’éditeur ne garantit pas l’absence d’erreurs, d’interruptions,
                  de pertes de données, de retards d’email ou d’écarts entre les calculs et la situation réelle de l’utilisateur.
                </p>
                <p>
                  lokt.fr ne pourra être tenu responsable des conséquences liées à une information saisie de manière inexacte, à une mauvaise
                  interprétation des résultats ou à une utilisation des documents sans vérification préalable.
                </p>
              </Section>

              <Section title="10. Usage acceptable">
                <p>
                  L’utilisateur s’engage à ne pas utiliser le service pour porter atteinte aux droits de tiers, contourner les limites d’usage,
                  perturber l’infrastructure, extraire massivement les données ou générer des documents frauduleux.
                </p>
              </Section>

              <Section title="11. Propriété intellectuelle">
                <p>
                  L’interface, les textes, les modèles, les workflows, les calculs, le nom lokt.fr et les éléments graphiques du site sont protégés. Toute
                  reproduction, extraction ou réutilisation non autorisée est interdite, sauf usage strictement personnel des documents générés pour
                  les besoins de gestion de l’utilisateur.
                </p>
              </Section>

              <Section title="12. Données personnelles">
                <p>
                  Les traitements de données personnelles sont décrits dans la{" "}
                  <Link href="/confidentialite" className="underline">
                    Politique de confidentialité
                  </Link>
                  .
                </p>
              </Section>

              <Section title="13. Suspension, résiliation et évolution du service">
                <p>
                  L’utilisateur peut cesser d’utiliser le service ou demander la suppression de son compte. lokt.fr peut suspendre un compte en cas
                  d’usage abusif, de non-paiement ou de violation des présentes conditions. Le service peut évoluer, être suspendu ou interrompu pour
                  maintenance, amélioration ou contrainte technique.
                </p>
              </Section>

              <Section title="14. Droit applicable">
                <p>
                  Les présentes conditions sont soumises au droit français. En cas de difficulté, l’utilisateur est invité à contacter lokt.fr afin de
                  rechercher une solution amiable.
                </p>
              </Section>
            </div>

            <div className="mt-8 flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-slate-500">Dernière mise à jour : 22 juin 2026</p>
              <Link href="/" className="text-sm font-semibold text-slate-700 underline">
                Retour à l’accueil
              </Link>
            </div>
          </section>
        </div>
      </main>

      <AppFooter />
    </div>
  );
}
