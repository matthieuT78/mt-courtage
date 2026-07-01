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

    ];
  },
};

module.exports = nextConfig;
