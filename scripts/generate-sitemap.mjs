import fs from "fs";
import path from "path";

// ⚠️ adapte si besoin
const siteUrl = "https://lokt.fr";

// Reprends EXACTEMENT les valeurs de tes pages SSG
const REVENUS = [
  1500, 1800, 2000, 2200, 2500, 2800, 3000, 3200, 3500, 3800, 4000, 4500, 5000, 5500, 6000, 7000, 8000,
];

const VALEURS = [
  150000, 200000, 250000, 300000, 350000, 400000, 450000,
  500000, 600000, 700000, 800000,
];

const PRIX = Array.from({ length: 70 }, (_, i) => 100000 + i * 10000); // exemple 100k -> 790k
// 👉 si ton fichier [prix].tsx a une liste différente, remplace PRIX par ta vraie liste.

const staticPages = [
  "/",
  "/capacite",
  "/pret-relais",
  "/investissement",
  "/parc-immobilier",
  "/calculettes",
  "/commencer",
  "/tarifs",
  "/cgu",
  "/confidentialite",
];

const urls = [];

// pages statiques
for (const p of staticPages) urls.push(`${siteUrl}${p}`);

// pages simulateur capacité
for (const r of REVENUS) urls.push(`${siteUrl}/simulateur/capacite-emprunt/${r}`);

// pages simulateur prêt relais
for (const v of VALEURS) urls.push(`${siteUrl}/simulateur/pret-relais/${v}`);

// pages simulateur investissement
for (const p of PRIX) urls.push(`${siteUrl}/simulateur/investissement/${p}`);

const now = new Date().toISOString();

const xml =
  `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  urls
    .map(
      (u) => `  <url>\n    <loc>${u}</loc>\n    <lastmod>${now}</lastmod>\n  </url>`
    )
    .join("\n") +
  `\n</urlset>\n`;

const outPath = path.join(process.cwd(), "public", "sitemap.xml");
fs.writeFileSync(outPath, xml, "utf8");

console.log(`✅ sitemap généré: ${outPath}`);
console.log(`✅ ${urls.length} URLs`);
