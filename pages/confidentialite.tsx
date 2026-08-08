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
        <meta name="robots" content="noindex, follow" />
        <link rel="canonical" href="https://lokt.fr/confidentialite" />
      </Head>

      <AppHeader staticMode />

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
                  <li>données de candidature locative : informations déclarées par les candidats à un logement (prénom, nom, email, téléphone, date de naissance, situation professionnelle, revenus nets mensuels) et pièces justificatives jointes (CNI, fiche de paie, avis d’imposition, justificatif de domicile) — collectées uniquement dans le cadre d’une annonce active et transmises au bailleur concerné ;</li>
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
                  <li>permettre aux bailleurs de recevoir et d’analyser les dossiers de candidature locative via un lien dédié, sans conservation prolongée des données des candidats non retenus ;</li>
                  <li>améliorer le produit à partir de statistiques agrégées ou anonymisées lorsque c’est possible.</li>
                </ul>
                <p>
                  Les bases légales principales sont l’exécution du contrat, l’intérêt légitime de lokt.fr à maintenir et améliorer le service, le
                  respect d’obligations légales éventuelles et, lorsque nécessaire, le consentement.
                </p>
              </Section>

              <Section title="4. Destinataires et sous-traitants">
                <p>Les données peuvent être traitées par les prestataires techniques suivants, nécessaires au fonctionnement du service :</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>
                    <strong>Supabase Inc.</strong> (États-Unis) — base de données, authentification et stockage de fichiers. Transfert encadré par les clauses contractuelles types de la Commission européenne.
                  </li>
                  <li>
                    <strong>Vercel Inc.</strong> (États-Unis) — hébergement applicatif et déploiement. Transfert encadré par les clauses contractuelles types.
                  </li>
                  <li>
                    <strong>Stripe, Inc.</strong> (États-Unis) — paiement et facturation. Certifié PCI-DSS. Les numéros complets de carte ne sont pas stockés par lokt.fr.
                  </li>
                  <li>
                    <strong>Resend</strong> — envoi des emails opérationnels (quittances, alertes, rappels, confirmations) à destination des bailleurs et locataires.
                  </li>
                  <li>
                    <strong>Google LLC</strong> via Google Analytics 4 — mesure d’audience anonymisée du site public. Les adresses IP sont masquées côté serveur avant tout traitement. Aucun cookie publicitaire n’est utilisé.
                  </li>
                  <li>
                    <strong>Open-Meteo</strong> — prévisions météorologiques à partir des coordonnées géographiques des communes où se situent vos biens. Seule la localité (ville) est transmise, sans donnée nominative.
                  </li>
                  <li>
                    <strong>API Adresse — data.gouv.fr</strong> — géocodage des villes françaises (localité → coordonnées GPS). API publique gérée par l’État français ; aucune donnée personnelle n’est transmise.
                  </li>
                </ul>
                <p>
                  lokt.fr ne revend pas les données personnelles et ne les partage pas avec des partenaires commerciaux tiers, à l’exception des
                  utilisateurs des simulateurs (calculettes) ayant explicitement et séparément consenti à être mis en relation avec un conseiller
                  partenaire pour leur projet. Ce consentement est optionnel, distinct de l’acceptation des CGU, et n’est jamais requis pour accéder
                  aux résultats de la simulation.
                </p>
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
                  <li>
                    <strong>Données de simulation (leads calculettes) :</strong> les données personnelles (email, résultats de simulation, données financières) sont
                    automatiquement anonymisées selon le consentement donné — 12 mois pour les simulations sans consentement au contact, 36 mois pour celles avec
                    consentement. Les statistiques agrégées (outil utilisé, date, localisation approximative) sont conservées sans limite pour améliorer le service.
                  </li>
                  <li>
                    <strong>Données de compte :</strong> conservées pendant toute la durée d’activité du compte. La suppression du compte, accessible depuis
                    l’espace personnel, efface immédiatement et définitivement le profil, les biens, locataires, baux, quittances, états des lieux et documents
                    associés (base de données et fichiers stockés), à l’exception des données de facturation conservées pour obligation légale (voir ci-dessous).
                  </li>
                  <li>
                    <strong>Données bailleur et documents :</strong> tant que le compte est actif ou jusqu’à suppression demandée par l’utilisateur. Les données
                    relatives aux locataires et baux peuvent être conservées jusqu’à 3 ans après la fin du bail à des fins de preuve.
                  </li>
                  <li>
                    <strong>Données de candidature locative :</strong> les brouillons non soumis sont supprimés automatiquement après 30 jours d’inactivité. Les dossiers refusés, en liste d’attente ou abandonnés sont supprimés par le bailleur à la clôture de l’annonce. Le dossier du candidat retenu est conservé tant que le bail correspondant est actif, puis soumis aux mêmes règles que les données de gestion locative.
                  </li>
                  <li>
                    <strong>Compte jamais confirmé :</strong> si l’adresse email n’est pas confirmée dans les 30 jours suivant l’inscription, un email d’avertissement est envoyé et le compte est supprimé automatiquement 7 jours plus tard si l’adresse n’a toujours pas été confirmée entre-temps.
                  </li>
                  <li>
                    <strong>Données de paiement et facturation :</strong> 10 ans à compter de l’émission de la facture, conformément aux obligations comptables légales
                    (article L. 123-22 du Code de commerce). Seuls les identifiants techniques Stripe sont conservés ; les numéros de carte ne sont jamais stockés.
                  </li>
                  <li>
                    <strong>Logs techniques et sécurité :</strong> 30 jours à 12 mois selon la nature, nécessaires au diagnostic, à la sécurité et à la prévention des abus.
                  </li>
                  <li>
                    <strong>Données anonymisées ou agrégées :</strong> conservées sans limite lorsqu’elles ne permettent plus d’identifier une personne.
                  </li>
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
                <p>lokt.fr utilise des cookies ou stockages locaux dans les catégories suivantes :</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>
                    <strong>Fonctionnement :</strong> session, authentification, préférences d’interface (mode sombre, menu réduit), sauvegarde temporaire de formulaires.
                  </li>
                  <li>
                    <strong>Mesure d’audience :</strong> Google Analytics 4 dépose des cookies pour mesurer la fréquentation du site public (pages vues, source de trafic). Les adresses IP sont anonymisées ; aucune donnée n’est utilisée à des fins publicitaires.
                  </li>
                </ul>
                <p>Aucun cookie publicitaire tiers ou de reciblage n’est utilisé.</p>
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
                  Vous pouvez supprimer votre compte directement depuis vos paramètres (section « Mon compte »). La suppression entraîne :
                </p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>la désactivation immédiate de l'accès ;</li>
                  <li>l'effacement immédiat de votre profil, de vos données bailleur et des documents associés (base de données et fichiers stockés) ;</li>
                  <li>l'anonymisation des simulations liées à votre compte.</li>
                </ul>
                <p>
                  Certaines informations sont conservées malgré la suppression lorsque cela est nécessaire pour respecter une obligation légale
                  (données de facturation — 10 ans), établir une preuve ou gérer un litige.
                </p>
                <p>
                  Vous pouvez également faire une demande de suppression par email à{" "}
                  <a href="mailto:contact@lokt.fr" className="underline">contact@lokt.fr</a>.
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
              <p className="text-xs text-slate-500">Dernière mise à jour : 28 juin 2026</p>
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
