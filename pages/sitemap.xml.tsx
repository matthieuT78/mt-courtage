import type { GetServerSideProps } from "next";
import { getAllPostsMeta } from "../lib/blog";

const SITE_URL = "https://lokt.fr";

const STATIC_PAGES = [
  { loc: "/",                                    priority: "1.0", changefreq: "weekly" },
  { loc: "/calculettes",                         priority: "0.9", changefreq: "weekly" },
  { loc: "/capacite",                            priority: "0.85", changefreq: "monthly" },
  { loc: "/investissement",                      priority: "0.85", changefreq: "monthly" },
  { loc: "/pret-relais",                         priority: "0.85", changefreq: "monthly" },
  { loc: "/plus-value-vente-immobiliere",        priority: "0.85", changefreq: "monthly" },
  { loc: "/acheter-ou-louer",                    priority: "0.85", changefreq: "monthly" },
  { loc: "/parc-immobilier",                     priority: "0.8",  changefreq: "monthly" },
  { loc: "/outil-gestion-locative",              priority: "0.8",  changefreq: "monthly" },
  { loc: "/blog",                                priority: "0.8",  changefreq: "weekly" },
  { loc: "/guides",                              priority: "0.75", changefreq: "monthly" },
  { loc: "/tarifs",                              priority: "0.7",  changefreq: "monthly" },
  { loc: "/comparatif-logiciel-gestion-locative", priority: "0.75", changefreq: "monthly" },
  { loc: "/gestion-locative-lmnp",              priority: "0.7",  changefreq: "monthly" },
  { loc: "/gestion-locative-proprietaire-particulier", priority: "0.7", changefreq: "monthly" },
  { loc: "/modele-quittance-loyer-pdf",          priority: "0.75", changefreq: "monthly" },
  { loc: "/modele-lettre-conge-bailleur",        priority: "0.7",  changefreq: "monthly" },
  { loc: "/modele-mise-en-demeure-loyer-impaye", priority: "0.7",  changefreq: "monthly" },
  { loc: "/modele-notification-revision-loyer",  priority: "0.7",  changefreq: "monthly" },
  { loc: "/modele-restitution-depot-garantie",   priority: "0.7",  changefreq: "monthly" },
  { loc: "/suivi-loyers-impayes",               priority: "0.7",  changefreq: "monthly" },
  { loc: "/inventaire-location-meublee",        priority: "0.65", changefreq: "monthly" },
  { loc: "/revision-loyer-irl",                 priority: "0.65", changefreq: "monthly" },
  { loc: "/depot-garantie-location-meublee",    priority: "0.65", changefreq: "monthly" },
  { loc: "/etats-des-lieux-documents",          priority: "0.65", changefreq: "monthly" },
  { loc: "/cautions-loyers",                    priority: "0.65", changefreq: "monthly" },
  { loc: "/guides/checklist-mise-en-location",         priority: "0.65", changefreq: "monthly" },
  { loc: "/guides/dpe-diagnostics-location",           priority: "0.65", changefreq: "monthly" },
  { loc: "/guides/lmnp-checklist-location-meublee",    priority: "0.65", changefreq: "monthly" },
  { loc: "/guides/choisir-bail-vide-meuble-mobilite",  priority: "0.65", changefreq: "monthly" },
  { loc: "/guides/arrivee-locataire-remise-cles",      priority: "0.65", changefreq: "monthly" },
  { loc: "/guides/travaux-reparations-bailleur-locataire", priority: "0.65", changefreq: "monthly" },
  { loc: "/guides/depart-locataire-etat-des-lieux-sortie", priority: "0.65", changefreq: "monthly" },
  { loc: "/guides/depot-garantie-restitution-retenues", priority: "0.65", changefreq: "monthly" },
  { loc: "/a-propos",      priority: "0.4", changefreq: "yearly" },
  { loc: "/cgu",           priority: "0.3", changefreq: "yearly" },
  { loc: "/confidentialite", priority: "0.3", changefreq: "yearly" },
];

function urlEntry(loc: string, date: string, priority: string, changefreq: string) {
  return `  <url>
    <loc>${SITE_URL}${loc}</loc>
    <lastmod>${date}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

export default function SitemapXml() {
  return null;
}

export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  const now = new Date().toISOString();
  const posts = getAllPostsMeta();

  const staticEntries = STATIC_PAGES.map((p) =>
    urlEntry(p.loc, now, p.priority, p.changefreq)
  );

  const blogEntries = posts.map((p) => {
    const date = p.frontmatter.date
      ? new Date(p.frontmatter.date).toISOString()
      : now;
    return urlEntry(`/blog/${p.slug}`, date, "0.7", "monthly");
  });

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...staticEntries, ...blogEntries].join("\n")}
</urlset>`;

  res.setHeader("Content-Type", "text/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
  res.write(sitemap);
  res.end();

  return { props: {} };
};
