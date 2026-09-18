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

export default function SecuritePage() {
  const siteUrl = "https://lokt.fr";
  const pageUrl = `${siteUrl}/securite`;
  const title = "Sécurité des données | lokt.fr";
  const description =
    "Comment lokt.fr protège les données de gestion locative : hébergement, chiffrement, isolation par utilisateur, sauvegardes et paiement.";

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={pageUrl} />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="lokt.fr" />
        <meta property="og:locale" content="fr_FR" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={pageUrl} />
      </Head>

      <AppHeader staticMode />

      <main className="flex-1 px-4 py-10">
        <div className="mx-auto max-w-4xl space-y-6">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-cyan-700">Sécurité</p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-950">Sécurité des données</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              lokt.fr héberge des données sensibles pour un bailleur : loyers, locataires, baux, documents. Cette page explique concrètement
              comment ces données sont hébergées, protégées et cloisonnées — sans promesse d'infaillibilité qu'aucun outil ne peut tenir.
            </p>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="space-y-6">
              <Section title="1. Hébergement et infrastructure">
                <p>
                  La base de données, l'authentification et le stockage des fichiers (documents, photos, PDF) sont confiés à{" "}
                  <strong>Supabase</strong>, construit sur une infrastructure PostgreSQL. L'hébergement applicatif et le déploiement du site
                  sont assurés par <strong>Vercel</strong>. Les deux sont des prestataires établis aux États-Unis ; les transferts de données
                  hors Union européenne sont encadrés par les clauses contractuelles types de la Commission européenne, comme détaillé dans
                  notre <Link href="/confidentialite" className="underline">politique de confidentialité</Link>.
                </p>
                <p>Les données transitent chiffrées (TLS) entre votre navigateur et nos serveurs, et sont chiffrées au repos chez l'hébergeur.</p>
              </Section>

              <Section title="2. Isolation des données par utilisateur">
                <p>
                  Chaque bailleur n'accède qu'à ses propres données. Ce cloisonnement n'est pas qu'une règle appliquée par l'interface : il est
                  imposé directement au niveau de la base de données via des règles d'accès (Row Level Security), de sorte qu'une requête ne
                  peut techniquement pas retourner les biens, locataires ou documents d'un autre compte.
                </p>
              </Section>

              <Section title="3. Paiement">
                <p>
                  Les paiements sont traités par <strong>Stripe</strong>, certifié PCI-DSS. lokt.fr ne stocke jamais les numéros de carte
                  bancaire : seuls des identifiants techniques Stripe (statut d'abonnement, historique de facturation) sont conservés de
                  notre côté.
                </p>
              </Section>

              <Section title="4. Sauvegardes">
                <p>
                  La base de données bénéficie des mécanismes de sauvegarde de l'infrastructure Supabase. Par ailleurs, la suppression d'une
                  donnée dans votre espace (bien, locataire, document) est immédiate et définitive — voir la section suivante.
                </p>
              </Section>

              <Section title="5. Suppression de vos données">
                <p>
                  Depuis votre espace personnel, la suppression du compte efface immédiatement le profil, les biens, locataires, baux,
                  quittances, états des lieux et documents associés (base de données et fichiers stockés) — à l'exception des données de
                  facturation, conservées 10 ans pour obligation légale comptable. Le détail complet des durées de conservation par type de
                  donnée est dans la <Link href="/confidentialite" className="underline">politique de confidentialité</Link>.
                </p>
              </Section>

              <Section title="6. Ce que lokt.fr ne fait pas (encore)">
                <p>
                  Par souci de clarté plutôt que de survendre : lokt.fr ne propose pas aujourd'hui d'authentification à deux facteurs (2FA)
                  ni de journal d'audit consultable par l'utilisateur. Ce sont des évolutions identifiées, pas des fonctionnalités existantes.
                </p>
              </Section>

              <Section title="7. Signaler un problème de sécurité">
                <p>
                  Si vous identifiez une faille ou un comportement suspect, écrivez-nous directement à{" "}
                  <a href="mailto:contact@lokt.fr" className="underline">
                    contact@lokt.fr
                  </a>
                  . Nous traitons ces signalements en priorité.
                </p>
              </Section>
            </div>

            <div className="mt-8 flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-slate-500">Dernière mise à jour : 18 septembre 2026</p>
              <Link href="/confidentialite" className="text-sm font-semibold text-slate-700 underline">
                Voir la politique de confidentialité (RGPD)
              </Link>
            </div>
          </section>
        </div>
      </main>

      <AppFooter />
    </div>
  );
}
