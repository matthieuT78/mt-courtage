import Head from "next/head";
import Link from "next/link";
import { useState } from "react";
import AppHeader from "../components/AppHeader";
import AppFooter from "../components/AppFooter";

interface FaqItem {
  question: string;
  answer: React.ReactNode;
}

const faqSections: { title: string; icon: string; items: FaqItem[] }[] = [
  {
    title: "Démarrage & compte",
    icon: "🚀",
    items: [
      {
        question: "Comment créer mon compte bailleur ?",
        answer: (
          <>
            Rendez-vous sur{" "}
            <a href="https://lokt.fr" className="text-blue-600 underline">
              lokt.fr
            </a>{" "}
            et cliquez sur « Créer un compte ». Renseignez votre adresse e-mail et
            choisissez un mot de passe. Un e-mail de confirmation vous est envoyé :
            cliquez sur le lien pour activer votre compte. L'inscription est gratuite
            et ne nécessite pas de carte bancaire.
          </>
        ),
      },
      {
        question: "Combien de logements puis-je gérer sur le plan Gratuit ?",
        answer:
          "Le plan Gratuit vous permet de gérer 1 logement actif. Pour gérer jusqu'à 2 logements, passez au plan lokt·one (6,90 €/mois). Le plan lokt·plus (11,90 €/mois) permet de gérer jusqu'à 5 logements.",
      },
      {
        question: "Comment changer de plan tarifaire ?",
        answer:
          "Accédez à Paramètres > Abonnement depuis votre espace bailleur. Vous pouvez passer à un plan supérieur à tout moment. Le changement est immédiat et le montant est calculé au prorata de la période restante.",
      },
      {
        question: "Puis-je annuler mon abonnement ?",
        answer:
          "Oui, vous pouvez annuler à tout moment depuis Paramètres > Abonnement > Gérer mon abonnement. Votre abonnement reste actif jusqu'à la fin de la période payée, puis votre compte est rétrogradé vers le plan Gratuit.",
      },
    ],
  },
  {
    title: "Biens & Locataires",
    icon: "🏠",
    items: [
      {
        question: "Comment ajouter un bien ?",
        answer:
          "Depuis votre espace bailleur, cliquez sur « Biens » dans le menu puis sur « Ajouter un bien ». Renseignez l'adresse, la surface, le type de logement, le loyer hors charges et les charges. Le bien est immédiatement disponible pour créer un bail.",
      },
      {
        question: "Comment inviter un locataire au portail ?",
        answer: (
          <>
            Depuis la section Locataires, cliquez sur la fiche du locataire concerné
            puis sur « Inviter au portail ». Un e-mail d'invitation lui est envoyé. Il
            peut alors créer son accès et consulter ses documents (quittances, bail,
            EDL) en autonomie. Cette fonctionnalité est disponible à partir du plan{" "}
            <strong>lokt·one</strong>.
          </>
        ),
      },
      {
        question: "Un locataire peut-il modifier ses informations sur le portail ?",
        answer:
          "Non. Le portail locataire est en lecture seule : il permet de consulter et télécharger les documents, mais pas de modifier les données du bail ou du compte. Toute modification est effectuée par le bailleur depuis son espace.",
      },
    ],
  },
  {
    title: "Loyers & Quittances",
    icon: "🧾",
    items: [
      {
        question: "Les loyers sont-ils générés automatiquement ?",
        answer:
          "Oui. Une fois le bail créé et activé, lokt.fr génère automatiquement un appel de loyer chaque mois à la date d'échéance définie dans le bail. Vous retrouvez ces loyers dans la section Loyers avec le statut « En attente ».",
      },
      {
        question: "Comment confirmer un paiement de loyer ?",
        answer:
          "Depuis la section Loyers, cliquez sur le loyer concerné puis sur « Confirmer le paiement ». Une fois confirmé, la quittance est automatiquement générée et envoyée au locataire (plans lokt·one et lokt·plus). Sur le plan Gratuit, vous pouvez générer et envoyer la quittance manuellement.",
      },
      {
        question: "Que faire si j'ai confirmé un paiement par erreur ?",
        answer:
          "Vous pouvez annuler un paiement confirmé depuis la section Loyers en cliquant sur « Annuler le paiement ». Le loyer repasse au statut « En attente » et la quittance associée est invalidée.",
      },
      {
        question: "Les quittances sont-elles conformes à la loi ?",
        answer:
          "Oui. Les quittances de loyer générées par lokt.fr contiennent toutes les mentions légales obligatoires : identité du bailleur et du locataire, adresse du bien, période, montant du loyer HC, charges et total encaissé.",
      },
      {
        question: "Comment envoyer les rappels de loyer aux locataires ?",
        answer: (
          <>
            Sur les plans <strong>lokt·one</strong> et <strong>lokt·plus</strong>, des
            rappels automatiques sont envoyés au locataire à la date d'échéance, puis
            des relances si le paiement n'est pas confirmé. Vous pouvez configurer la
            fréquence et le message depuis Paramètres &gt; Rappels. Vous pouvez aussi
            envoyer un rappel manuel depuis la fiche du loyer.
          </>
        ),
      },
    ],
  },
  {
    title: "Baux & Documents",
    icon: "📄",
    items: [
      {
        question: "lokt.fr génère-t-il le contrat de bail ?",
        answer:
          "Oui. Après avoir créé un bail et renseigné les conditions (loyer, durée, dépôt de garantie), vous pouvez générer un contrat de bail PDF conforme à la loi ALUR depuis la section Baux > votre bail > Contrat. Ce PDF peut être partagé directement avec votre locataire.",
      },
      {
        question: "Comment générer un courrier de mise en demeure ?",
        answer: (
          <>
            Depuis la section Baux, ouvrez le bail concerné et cliquez sur «
            Modèles courriers ». Choisissez « Mise en demeure ». Le courrier est
            pré-rempli avec les informations du bail et le montant des loyers impayés.
            Il est conforme à l'article 24 de la loi du 6 juillet 1989. Téléchargez-le
            et envoyez-le en recommandé avec accusé de réception.
          </>
        ),
      },
      {
        question: "Quand dois-je envoyer le congé bailleur ?",
        answer:
          "Pour un logement vide, le congé doit être envoyé au moins 6 mois avant la date d'échéance du bail. Pour un logement meublé, le délai est de 3 mois. lokt.fr vous alerte automatiquement 90 jours avant l'échéance pour vous rappeler d'agir à temps.",
      },
    ],
  },
  {
    title: "États des lieux",
    icon: "📋",
    items: [
      {
        question: "Comment créer un état des lieux ?",
        answer:
          "Depuis la section États des lieux, cliquez sur « Nouvel EDL ». Choisissez le bien, le type (entrée ou sortie) et décrivez pièce par pièce l'état du logement. Vous pouvez ajouter des photos depuis votre appareil. Une fois terminé, faites signer l'EDL sur écran ou envoyez un lien de signature au locataire.",
      },
      {
        question: "L'état des lieux est-il juridiquement valable ?",
        answer:
          "L'EDL généré par lokt.fr est horodaté et signé numériquement. Le PDF signé constitue une preuve de l'état du logement à la date indiquée. En cas de litige, ce document peut être utilisé comme pièce justificative.",
      },
      {
        question: "Puis-je importer un EDL signé en dehors de lokt.fr ?",
        answer:
          "Oui. Depuis la section États des lieux, vous pouvez importer un PDF signé existant (EDL réalisé avec un huissier ou un autre outil) pour le conserver dans lokt.fr et le partager avec votre locataire.",
      },
    ],
  },
  {
    title: "Finance & Déclaration",
    icon: "📈",
    items: [
      {
        question: "Que montre la section Finance ?",
        answer:
          "La section Finance affiche un graphique de trésorerie sur 6 mois glissants (encaissements vs dépenses), le cash-flow par bien et le total des dépenses par catégorie. Sur le plan lokt·plus, vous pouvez exporter ces données en CSV ou PDF pour votre comptable.",
      },
      {
        question: "Comment saisir une dépense ?",
        answer:
          "Depuis Finance > Dépenses, cliquez sur « Ajouter une dépense ». Choisissez la catégorie (travaux, charges de copropriété, assurance, taxe foncière, frais divers), le bien concerné et le montant. Ces dépenses alimentent automatiquement la section Déclaration.",
      },
      {
        question: "lokt.fr aide-t-il pour la déclaration fiscale ?",
        answer: (
          <>
            Sur le plan <strong>lokt·plus</strong>, la section Déclaration récapitule
            les loyers encaissés et les charges déductibles pour l'année fiscale. Vous
            pouvez exporter le récapitulatif en PDF pour faciliter votre déclaration de
            revenus fonciers (formulaire 2044). lokt.fr n'est pas un logiciel de
            comptabilité : consultez votre expert-comptable pour votre situation fiscale
            spécifique.
          </>
        ),
      },
    ],
  },
  {
    title: "Alertes & Performance",
    icon: "🔔",
    items: [
      {
        question: "Quelles alertes sont disponibles sur le plan Gratuit ?",
        answer:
          "Sur le plan Gratuit, vous bénéficiez de 4 types d'alertes : loyers en retard, révision IRL disponible, renouvellement de bail imminent, et EDL de sortie à planifier. Les plans lokt·one et lokt·plus débloquent toutes les alertes automatiques.",
      },
      {
        question: "Qu'est-ce que le score bailleur ?",
        answer:
          "Le score bailleur (0 à 100) mesure la qualité de votre gestion locative : régularité des quittances, taux de loyers payés à temps, complétude des documents, utilisation du portail locataire, alertes traitées. Un score élevé indique une gestion rigoureuse.",
      },
      {
        question: "Puis-je reporter une alerte sans la traiter ?",
        answer:
          "Oui. Depuis la section Alertes, vous pouvez « snoozer » une alerte pour la reporter d'une durée choisie (3, 7 ou 14 jours). Elle réapparaîtra automatiquement à la date choisie.",
      },
    ],
  },
];

function FaqSection({
  section,
}: {
  section: { title: string; icon: string; items: FaqItem[] };
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="mb-8">
      <h2 className="flex items-center gap-2 text-base font-bold text-slate-800 mb-3">
        <span>{section.icon}</span>
        {section.title}
      </h2>
      <div className="space-y-2">
        {section.items.map((item, idx) => {
          const isOpen = openIndex === idx;
          return (
            <div
              key={idx}
              className="bg-white border border-slate-200 rounded-xl overflow-hidden"
            >
              <button
                className="w-full flex items-center justify-between px-5 py-4 text-left text-sm font-semibold text-slate-800 hover:bg-slate-50 transition-colors"
                onClick={() => setOpenIndex(isOpen ? null : idx)}
                aria-expanded={isOpen}
              >
                <span>{item.question}</span>
                <svg
                  className={`w-4 h-4 text-slate-400 flex-shrink-0 ml-4 transition-transform duration-200 ${
                    isOpen ? "rotate-180" : ""
                  }`}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
              {isOpen && (
                <div className="px-5 pb-5 text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-4">
                  {item.answer}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const quickGuides = [
  {
    icon: "🏠",
    title: "Ajouter un bien",
    description: "Créez votre premier logement en 2 minutes",
    href: "/espace-bailleur",
    label: "Aller dans Biens",
  },
  {
    icon: "📄",
    title: "Créer un bail",
    description: "Générez votre contrat de bail PDF conforme ALUR",
    href: "/espace-bailleur",
    label: "Aller dans Baux",
  },
  {
    icon: "🧾",
    title: "Envoyer une quittance",
    description: "Confirmez un paiement et envoyez la quittance",
    href: "/espace-bailleur",
    label: "Aller dans Loyers",
  },
  {
    icon: "🔗",
    title: "Inviter votre locataire",
    description: "Donnez accès au portail à votre locataire",
    href: "/espace-locataire",
    label: "Voir le portail",
  },
  {
    icon: "📋",
    title: "Faire un état des lieux",
    description: "EDL d'entrée ou de sortie avec photos et signature",
    href: "/espace-bailleur",
    label: "Aller dans EDL",
  },
  {
    icon: "📈",
    title: "Suivre vos finances",
    description: "Trésorerie 6 mois, cash-flow et exports",
    href: "/espace-bailleur",
    label: "Aller dans Finance",
  },
];

const sections = [
  { icon: "📊", label: "Dashboard", desc: "Vue globale de votre patrimoine" },
  { icon: "🏠", label: "Biens", desc: "Gérez vos logements" },
  { icon: "👥", label: "Locataires", desc: "Fiches et portail locataire" },
  { icon: "📄", label: "Baux", desc: "Contrats et modèles de courriers" },
  { icon: "💰", label: "Loyers", desc: "Suivi et confirmation des paiements" },
  { icon: "🧾", label: "Quittances", desc: "Génération et envoi PDF" },
  { icon: "📋", label: "États des lieux", desc: "EDL entrée / sortie" },
  { icon: "📈", label: "Finance", desc: "Trésorerie et cash-flow" },
  { icon: "🔔", label: "Alertes", desc: "IRL, retards, renouvellements" },
  { icon: "💬", label: "Messagerie", desc: "Échangez avec vos locataires" },
  { icon: "📑", label: "Déclaration", desc: "Aide à la déclaration foncière" },
  { icon: "🏆", label: "Performance", desc: "Score bailleur et actions" },
];

export default function AidePage() {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredFaq = faqSections
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) =>
          !searchQuery ||
          item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (typeof item.answer === "string" &&
            item.answer.toLowerCase().includes(searchQuery.toLowerCase()))
      ),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <div className="min-h-screen flex flex-col bg-[#f6f9fc]">
      <Head>
        <title>Aide & Centre de support — lokt.fr</title>
        <meta
          name="description"
          content="Centre d'aide lokt.fr : FAQ, guides rapides et support pour gérer vos biens locatifs. Trouvez des réponses sur les loyers, quittances, baux et états des lieux."
        />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://lokt.fr/aide" />
        <meta property="og:title" content="Centre d'aide lokt.fr" />
        <meta
          property="og:description"
          content="FAQ et guides pour gérer vos biens locatifs avec lokt.fr"
        />
        <meta property="og:url" content="https://lokt.fr/aide" />
        <meta property="og:type" content="website" />
      </Head>

      <AppHeader staticMode />

      <main className="flex-1 py-10 px-4">
        <div className="max-w-5xl mx-auto">

          {/* Hero */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-4">
              ❓ Centre d'aide
            </div>
            <h1 className="text-3xl font-extrabold text-slate-900 mb-3 tracking-tight">
              Comment pouvons-nous vous aider ?
            </h1>
            <p className="text-slate-500 text-sm max-w-xl mx-auto mb-6">
              Trouvez rapidement une réponse dans notre FAQ ou accédez directement
              aux sections de votre espace bailleur.
            </p>
            {/* Search */}
            <div className="relative max-w-md mx-auto">
              <svg
                className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              <input
                type="search"
                placeholder="Rechercher dans la FAQ…"
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

            {/* FAQ — colonne principale */}
            <div className="lg:col-span-2">
              {filteredFaq.length === 0 ? (
                <div className="text-center py-16 text-slate-400">
                  <div className="text-4xl mb-3">🔍</div>
                  <p className="text-sm">Aucune question ne correspond à votre recherche.</p>
                  <button
                    className="mt-4 text-blue-600 text-sm underline"
                    onClick={() => setSearchQuery("")}
                  >
                    Effacer la recherche
                  </button>
                </div>
              ) : (
                filteredFaq.map((section, i) => (
                  <FaqSection key={i} section={section} />
                ))
              )}
            </div>

            {/* Sidebar droite */}
            <div className="space-y-6">

              {/* Guides rapides */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5">
                <h2 className="text-sm font-bold text-slate-800 mb-4">
                  Guides rapides
                </h2>
                <div className="space-y-2">
                  {quickGuides.map((guide, i) => (
                    <Link
                      key={i}
                      href={guide.href}
                      className="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors group"
                    >
                      <span className="text-xl mt-0.5">{guide.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-slate-800 group-hover:text-blue-700 transition-colors">
                          {guide.title}
                        </div>
                        <div className="text-xs text-slate-500 leading-relaxed">
                          {guide.description}
                        </div>
                      </div>
                      <svg
                        className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-500 flex-shrink-0 mt-1 transition-colors"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2.5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="m9 18 6-6-6-6" />
                      </svg>
                    </Link>
                  ))}
                </div>
              </div>

              {/* Sections bailleur */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5">
                <h2 className="text-sm font-bold text-slate-800 mb-4">
                  Sections de l'espace bailleur
                </h2>
                <div className="grid grid-cols-2 gap-2">
                  {sections.map((s, i) => (
                    <Link
                      key={i}
                      href="/espace-bailleur"
                      className="flex flex-col gap-1 p-2.5 rounded-lg hover:bg-blue-50 transition-colors group"
                    >
                      <span className="text-lg">{s.icon}</span>
                      <span className="text-xs font-semibold text-slate-700 group-hover:text-blue-700 transition-colors leading-tight">
                        {s.label}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>

              {/* Plans tarifaires */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5">
                <h2 className="text-sm font-bold text-slate-800 mb-3">
                  Plans tarifaires
                </h2>
                <div className="space-y-2 text-xs text-slate-600">
                  <div className="flex justify-between items-center py-2 border-b border-slate-100">
                    <span className="font-semibold text-slate-700">Gratuit</span>
                    <span className="text-slate-500">1 logement</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-100">
                    <span className="font-semibold text-blue-700">lokt·one</span>
                    <span className="text-slate-500">2 logements · 6,90 €/mois</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="font-semibold text-violet-700">lokt·plus</span>
                    <span className="text-slate-500">5 logements · 11,90 €/mois</span>
                  </div>
                </div>
                <Link
                  href="/tarifs"
                  className="mt-3 block text-center text-xs text-blue-600 font-semibold hover:underline"
                >
                  Voir tous les détails →
                </Link>
              </div>

              {/* Contact */}
              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5">
                <div className="text-2xl mb-2">💬</div>
                <h2 className="text-sm font-bold text-slate-800 mb-1">
                  Vous n'avez pas trouvé ?
                </h2>
                <p className="text-xs text-slate-600 mb-4 leading-relaxed">
                  Notre équipe répond en moins de 24h les jours ouvrés.
                </p>
                <Link
                  href="/contact"
                  className="block text-center bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-colors"
                >
                  Contacter le support
                </Link>
              </div>

            </div>
          </div>

          {/* Simulateurs */}
          <div className="mt-10 bg-white border border-slate-200 rounded-2xl p-6">
            <h2 className="text-base font-bold text-slate-800 mb-1">
              Simulateurs gratuits lokt.fr
            </h2>
            <p className="text-sm text-slate-500 mb-5">
              Accédez à nos outils de simulation immobilière sans compte.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              {[
                { icon: "🏦", label: "Capacité d'emprunt", href: "/capacite" },
                { icon: "📊", label: "Rentabilité locative", href: "/investissement" },
                { icon: "🔄", label: "Prêt relais", href: "/pret-relais" },
                { icon: "💹", label: "Plus-value", href: "/plus-value-vente-immobiliere" },
                { icon: "🏘️", label: "Parc immobilier", href: "/parc-immobilier" },
              ].map((sim, i) => (
                <Link
                  key={i}
                  href={sim.href}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50 transition-colors text-center group"
                >
                  <span className="text-2xl">{sim.icon}</span>
                  <span className="text-xs font-semibold text-slate-700 group-hover:text-blue-700 leading-tight transition-colors">
                    {sim.label}
                  </span>
                </Link>
              ))}
            </div>
          </div>

        </div>
      </main>

      <AppFooter />
    </div>
  );
}
