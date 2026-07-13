import fs from "fs";
import path from "path";

// ⚠️ adapte si besoin
const siteUrl = "https://lokt.fr";

// Articles de blog : lecture automatique depuis content/blog/
const BLOG_DIR = path.join(process.cwd(), "content", "blog");
const blogEntries = fs.existsSync(BLOG_DIR)
  ? fs.readdirSync(BLOG_DIR)
      .filter((f) => f.endsWith(".md"))
      .map((f) => {
        const slug = f.replace(/\.md$/, "");
        const content = fs.readFileSync(path.join(BLOG_DIR, f), "utf8");
        const dateMatch = content.match(/^date:\s*"?([^"\n]+)"?/m);
        const date = dateMatch ? dateMatch[1].trim() : null;
        return { slug, date };
      })
  : [];

const seoLandingSource = fs.readFileSync(path.join(process.cwd(), "lib/seoLandingPages.ts"), "utf8");
const seoLandingPages = Array.from(seoLandingSource.matchAll(/slug:\s*"([^"]+)"/g), (match) => `/${match[1]}`);
const seoLandingDate = seoLandingSource.match(/const today\s*=\s*"([^"]+)"/)?.[1] || null;

const guidesSource = fs.readFileSync(path.join(process.cwd(), "lib/guides.ts"), "utf8");
const guideDates = new Map();
for (const chunk of guidesSource.split(/(?=\s{4}slug:)/)) {
  const slugMatch = chunk.match(/slug:\s*"([^"]+)"/);
  const dateMatch = chunk.match(/updatedAt:\s*"([^"]+)"/);
  if (slugMatch && dateMatch) guideDates.set(slugMatch[1], dateMatch[1]);
}

const villesSource = fs.readFileSync(path.join(process.cwd(), "lib/villesRendement.ts"), "utf8");
const villesSlugs = Array.from(villesSource.matchAll(/slug:\s*"([^"]+)"/g), (match) => match[1]);

// Pages SEO publiques V1 (marketing + calculettes)
const staticPagesV1 = [
  "/",
  "/calculettes",
  "/acheter-ou-louer",
  "/capacite",
  "/pret-relais",
  "/investissement",
  "/investissement-locatif",
  "/plus-value-vente-immobiliere",
  "/parc-immobilier",
  "/gestion-locative-lmnp",
  "/outil-gestion-locative",
  "/comparatif-logiciel-gestion-locative",
  "/etats-des-lieux-documents",
  "/cautions-loyers",
  "/blog",
  "/guides",
  "/tarifs",
  "/aide",
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

// Auto-extraits depuis lib/guides.ts (slug: "...")
const GUIDE_SLUGS = Array.from(guidesSource.matchAll(/^\s{2,4}slug:\s*"([^"]+)"/gm), (m) => m[1]);

// Les pages /simulateur/... sont des pages techniques/programmatique noindex.
// On les laisse crawlables si Google les découvre, mais on ne les pousse pas dans le sitemap.
const INCLUDE_SIMULATEUR = false;

const urls = [];

function sitemapMeta(pathname) {
  if (pathname === "/") return { changefreq: "weekly", priority: "1.0" };
  if (pathname === "/outil-gestion-locative" || pathname === "/gestion-locative-lmnp") {
    return { changefreq: "weekly", priority: "0.9" };
  }
  if (pathname === "/tarifs" || pathname === "/calculettes") {
    return { changefreq: "weekly", priority: "0.8" };
  }
  if (pathname === "/cgu" || pathname === "/confidentialite" || pathname === "/a-propos") {
    return { changefreq: "yearly", priority: "0.3" };
  }
  if (pathname.startsWith("/guides/")) return { changefreq: "monthly", priority: "0.7" };
  if (pathname.startsWith("/rendement-locatif")) return { changefreq: "monthly", priority: "0.8" };
  return { changefreq: "monthly", priority: "0.75" };
}

// pages statiques V1
for (const p of staticPagesV1) {
  const date = seoLandingPages.includes(p) && seoLandingDate ? seoLandingDate : null;
  urls.push({ loc: `${siteUrl}${p}`, pathname: p, date });
}
for (const slug of GUIDE_SLUGS) {
  urls.push({ loc: `${siteUrl}/guides/${slug}`, pathname: `/guides/${slug}`, date: guideDates.get(slug) || null });
}

// Pages villes rendement locatif
urls.push({ loc: `${siteUrl}/rendement-locatif`, pathname: "/rendement-locatif" });
for (const slug of villesSlugs) {
  urls.push({ loc: `${siteUrl}/rendement-locatif/${slug}`, pathname: `/rendement-locatif/${slug}` });
}

// Articles de blog (auto-inclus)
for (const { slug, date } of blogEntries) {
  urls.push({ loc: `${siteUrl}/blog/${slug}`, pathname: `/blog/${slug}`, date: date || null });
}

if (INCLUDE_SIMULATEUR) {
  for (const r of REVENUS) urls.push({ loc: `${siteUrl}/simulateur/capacite-emprunt/${r}`, pathname: `/simulateur/capacite-emprunt/${r}` });
  for (const v of VALEURS) urls.push({ loc: `${siteUrl}/simulateur/pret-relais/${v}`, pathname: `/simulateur/pret-relais/${v}` });
  for (const p of PRIX) urls.push({ loc: `${siteUrl}/simulateur/investissement/${p}`, pathname: `/simulateur/investissement/${p}` });
}

const buildDate = new Date().toISOString();

const xml =
  `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  urls
    .map((u) => {
      const meta = sitemapMeta(u.pathname);
      const lastmod = u.date ? new Date(u.date).toISOString() : buildDate;
      return `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${meta.changefreq}</changefreq>\n    <priority>${meta.priority}</priority>\n  </url>`;
    })
    .join("\n") +
  `\n</urlset>\n`;

const outPath = path.join(process.cwd(), "public", "sitemap.xml");
fs.writeFileSync(outPath, xml, "utf8");

console.log(`✅ sitemap généré: ${outPath}`);
console.log(`✅ ${urls.length} URLs (dont ${blogEntries.length} articles de blog)`);
console.log(`ℹ️ simulateur inclus: ${INCLUDE_SIMULATEUR ? "oui" : "non"}`);
