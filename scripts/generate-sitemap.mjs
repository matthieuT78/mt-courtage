import fs from "fs";
import path from "path";

// ⚠️ adapte si besoin
const siteUrl = "https://lokt.fr";

const seoLandingSource = fs.readFileSync(path.join(process.cwd(), "lib/seoLandingPages.ts"), "utf8");
const seoLandingPages = Array.from(seoLandingSource.matchAll(/slug:\s*"([^"]+)"/g), (match) => `/${match[1]}`);

// Pages SEO publiques V1 (marketing + calculettes)
const staticPagesV1 = [
  "/",
  "/calculettes",
  "/capacite",
  "/pret-relais",
  "/investissement",
  "/plus-value-vente-immobiliere",
  "/parc-immobilier",
  "/gestion-locative-lmnp",
  "/outil-gestion-locative",
  "/outils-proprietaire",
  "/etats-des-lieux-documents",
  "/cautions-loyers",
  "/blog",
  "/guides",
  "/tarifs",
  "/a-propos",
  "/cgu",
  "/confidentialite",
  ...seoLandingPages,
];

// Pages simulateur générées, mais non poussées dans le sitemap.
const REVENUS = [
  1500, 1800, 2000, 2200, 2500, 2800, 3000, 3200, 3500, 3800, 4000, 4500, 5000, 5500, 6000, 7000, 8000,
];

const VALEURS = [
  150000, 200000, 250000, 300000, 350000, 400000, 450000, 500000, 600000, 700000, 800000,
];

const PRIX = Array.from({ length: 70 }, (_, i) => 100000 + i * 10000);

const GUIDE_SLUGS = [
  "checklist-mise-en-location",
  "dpe-diagnostics-location",
  "lmnp-checklist-location-meublee",
  "choisir-bail-vide-meuble-mobilite",
  "arrivee-locataire-remise-cles",
  "travaux-reparations-bailleur-locataire",
  "depart-locataire-etat-des-lieux-sortie",
  "depot-garantie-restitution-retenues",
];

// Les pages /simulateur/... sont des pages techniques/programmatique noindex.
// On les laisse crawlables si Google les découvre, mais on ne les pousse pas dans le sitemap.
const INCLUDE_SIMULATEUR = false;

const urls = [];

// pages statiques V1
for (const p of staticPagesV1) urls.push(`${siteUrl}${p}`);
for (const slug of GUIDE_SLUGS) urls.push(`${siteUrl}/guides/${slug}`);

if (INCLUDE_SIMULATEUR) {
  for (const r of REVENUS) urls.push(`${siteUrl}/simulateur/capacite-emprunt/${r}`);
  for (const v of VALEURS) urls.push(`${siteUrl}/simulateur/pret-relais/${v}`);
  for (const p of PRIX) urls.push(`${siteUrl}/simulateur/investissement/${p}`);
}

const lastmod = new Date().toISOString();

const xml =
  `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  urls
    .map((u) => `  <url>\n    <loc>${u}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`)
    .join("\n") +
  `\n</urlset>\n`;

const outPath = path.join(process.cwd(), "public", "sitemap.xml");
fs.writeFileSync(outPath, xml, "utf8");

console.log(`✅ sitemap généré: ${outPath}`);
console.log(`✅ ${urls.length} URLs`);
console.log(`ℹ️ simulateur inclus: ${INCLUDE_SIMULATEUR ? "oui" : "non"}`);
