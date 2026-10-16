/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  async redirects() {
    return [
      {
        source: "/quittances-loyer",
        destination: "/modele-quittance-loyer-pdf",
        permanent: true,
      },
      {
        source: "/guides/revision-loyer-irl",
        destination: "/revision-loyer-irl",
        permanent: true,
      },
      {
        source: "/guides/loyers-quittances-charges-suivi",
        destination: "/modele-quittance-loyer-pdf",
        permanent: true,
      },
      {
        source: "/logiciel-gestion-locative-lmnp",
        destination: "/gestion-locative-lmnp",
        permanent: true,
      },
      {
        source: "/commencer",
        destination: "/outil-gestion-locative",
        permanent: true,
      },
      {
        source: "/gestion-locative",
        destination: "/outil-gestion-locative",
        permanent: true,
      },
      {
        source: "/simulateur/capacite-emprunt/:revenu",
        destination: "/capacite",
        permanent: true,
      },
      {
        source: "/simulateur/capacite-emprunt-3000",
        destination: "/capacite",
        permanent: true,
      },
      {
        source: "/simulateur/investissement/:prix",
        destination: "/investissement",
        permanent: true,
      },
      {
        source: "/simulateur/pret-relais/:valeur",
        destination: "/pret-relais",
        permanent: true,
      },
      {
        // Même positionnement ("gestion locative sans agence, propriétaire
        // particulier") que l'article de blog, qui lui a de vraies
        // impressions/clics — cette page n'en a eu aucun en 4 mois malgré
        // l'indexation. Consolide plutôt que de laisser 2 pages mortes.
        source: "/gestion-locative-proprietaire-particulier",
        destination: "/blog/gestion-locative-sans-agence",
        permanent: true,
      },
    ];
  },
  async rewrites() {
    return [
      // Sert llms.txt dynamiquement (données mises à jour hebdomadairement)
      { source: "/llms.txt", destination: "/api/llms-txt" },
    ];
  },
};

module.exports = nextConfig;
