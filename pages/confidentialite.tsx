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

export default function ConfidentialitePage() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <Head>
        <title>Politique de confidentialité | lokt.fr</title>
        <meta
          name="description"
          content="Politique de confidentialité de lokt.fr : données collectées, finalités, prestataires, durée de conservation et droits RGPD."
        />
      </Head>

      <AppHeader />

      <main className="flex-1 px-4 py-10">
        <div className="mx-auto max-w-4xl space-y-6">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-cyan-700">Données personnelles</p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-950">Politique de confidentialité</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              Cette page explique quelles données sont traitées par lokt.fr, pourquoi elles le sont, combien de temps elles sont conservées et
              comment exercer vos droits.
            </p>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="space-y-6">
              <Section title="1. Responsable de traitement">
                <p>
                  <strong>Responsable :</strong> lokt.fr, éditeur indépendant.
                </p>
                <p>
                  <strong>Contact données personnelles :</strong>{" "}
                  <a href="mailto:contact@lokt.fr" className="underline">
                    contact@lokt.fr
                  </a>
                </p>
              </Section>

              <Section title="2. Données collectées">
                <p>Selon votre usage du service, lokt.fr peut traiter les catégories de données suivantes :</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>données de compte : email, nom, prénom, identifiants techniques, statut d’abonnement ;</li>
                  <li>données de simulation : revenus, charges, montants, hypothèses de financement, prix, loyers, fiscalité estimée ;</li>
                  <li>données bailleur : biens, adresses ou localisations, surfaces, montants de loyers, charges, dépôts de garantie ;</li>
                  <li>données locataires et contacts : noms, emails, téléphones, informations utiles à la gestion locative ;</li>
                  <li>données de documents : quittances, états des lieux, inventaires, fichiers PDF, photos ou notes ajoutées par l’utilisateur ;</li>
                  <li>données financières de gestion : recettes, dépenses, exports, périodes analysées ;</li>
                  <li>données d’emailing opérationnel : destinataires, objet, statut d’envoi, erreurs techniques ;</li>
                  <li>données de paiement : identifiants Stripe, offre souscrite, statut de paiement, facturation. Les numéros complets de carte ne sont pas stockés par lokt.fr ;</li>
                  <li>données techniques : logs, adresse IP, navigateur, erreurs, événements de sécurité et éléments nécessaires au fonctionnement.</li>
                </ul>
              </Section>

              <Section title="3. Finalités et bases légales">
                <p>Les données sont utilisées pour :</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>fournir les simulateurs, l’espace bailleur, les documents et les tableaux de bord ;</li>
                  <li>créer et sécuriser le compte utilisateur ;</li>
                  <li>exécuter les abonnements, paiements, limites d’usage et facturation ;</li>
                  <li>envoyer les emails opérationnels demandés ou configurés : quittances, alertes, rappels, confirmations ;</li>
                  <li>assurer le support, la maintenance, la sécurité et la prévention des abus ;</li>
                  <li>améliorer le produit à partir de statistiques agrégées ou anonymisées lorsque c’est possible.</li>
                </ul>
                <p>
                  Les bases légales principales sont l’exécution du contrat, l’intérêt légitime de lokt.fr à maintenir et améliorer le service, le
                  respect d’obligations légales éventuelles et, lorsque nécessaire, le consentement.
                </p>
              </Section>

              <Section title="4. Destinataires et sous-traitants">
                <p>Les données peuvent être traitées par des prestataires techniques nécessaires au service, notamment :</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>hébergement, base de données et authentification ;</li>
                  <li>hébergement applicatif et déploiement ;</li>
                  <li>paiement et facturation via Stripe ;</li>
                  <li>envoi d’emails opérationnels via un prestataire d’emailing ;</li>
                  <li>outils de journalisation, sécurité ou support lorsque nécessaires.</li>
                </ul>
                <p>lokt.fr ne revend pas les données personnelles et ne les partage pas avec des partenaires commerciaux tiers pour prospection.</p>
              </Section>

              <Section title="5. Transferts hors Union européenne">
                <p>
                  Certains prestataires peuvent traiter des données en dehors de l’Union européenne. Dans ce cas, lokt.fr s’appuie sur les garanties
                  prévues par le RGPD, comme les clauses contractuelles types ou les mécanismes de conformité applicables aux prestataires concernés.
                </p>
              </Section>

              <Section title="6. Durées de conservation">
                <p>Les données sont conservées pendant des durées proportionnées à leur finalité :</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>données de compte : pendant la durée d’existence du compte, puis suppression ou archivage limité ;</li>
                  <li>données bailleur et documents : tant que le compte est actif ou jusqu’à suppression demandée par l’utilisateur ;</li>
                  <li>données de paiement et facturation : pendant les durées nécessaires aux obligations comptables et légales ;</li>
                  <li>logs techniques et sécurité : pendant une durée limitée nécessaire au diagnostic, à la sécurité et à la prévention des abus ;</li>
                  <li>données anonymisées ou agrégées : peuvent être conservées sans limite lorsqu’elles ne permettent plus d’identifier une personne.</li>
                </ul>
              </Section>

              <Section title="7. Sécurité">
                <p>
                  lokt.fr met en œuvre des mesures raisonnables de sécurité : authentification, contrôle d’accès, isolation par utilisateur, stockage
                  chez des prestataires spécialisés et limitation des accès techniques. Aucun système n’étant infaillible, l’utilisateur doit aussi
                  protéger ses identifiants et signaler toute anomalie.
                </p>
              </Section>

              <Section title="8. Cookies et stockage local">
                <p>
                  lokt.fr utilise des cookies ou stockages locaux nécessaires au fonctionnement du site : session, authentification, préférences,
                  sauvegarde temporaire de formulaires ou consentements. Aucun cookie publicitaire tiers n’est prévu dans la version actuelle.
                </p>
              </Section>

              <Section title="9. Vos droits">
                <p>Conformément au RGPD, vous pouvez demander :</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>l’accès à vos données ;</li>
                  <li>leur rectification ;</li>
                  <li>leur suppression ;</li>
                  <li>la limitation du traitement ;</li>
                  <li>votre opposition à certains traitements ;</li>
                  <li>la portabilité des données lorsque ce droit s’applique ;</li>
                  <li>le retrait d’un consentement lorsque le traitement repose sur celui-ci.</li>
                </ul>
                <p>
                  Pour exercer vos droits, écrivez à{" "}
                  <a href="mailto:contact@lokt.fr" className="underline">
                    contact@lokt.fr
                  </a>
                  . Une vérification d’identité peut être demandée en cas de doute raisonnable.
                </p>
                <p>
                  Vous pouvez également introduire une réclamation auprès de la CNIL si vous estimez que vos droits ne sont pas respectés.
                </p>
              </Section>

              <Section title="10. Suppression du compte">
                <p>
                  Vous pouvez demander la suppression de votre compte et des données associées. Certaines informations peuvent être conservées lorsque
                  cela est nécessaire pour respecter une obligation légale, établir une preuve ou gérer un litige.
                </p>
              </Section>

              <Section title="11. Évolution de la politique">
                <p>
                  Cette politique pourra évoluer avec le service, notamment lors de l’ajout de nouveaux prestataires, fonctionnalités ou traitements.
                  La version applicable est celle publiée sur cette page.
                </p>
              </Section>
            </div>

            <div className="mt-8 flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-slate-500">Dernière mise à jour : 21 mai 2026</p>
              <Link href="/cgu" className="text-sm font-semibold text-slate-700 underline">
                Voir les CGU/CGV
              </Link>
            </div>
          </section>
        </div>
      </main>

      <AppFooter />
    </div>
  );
}
