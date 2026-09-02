import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

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
// Fallback pour les entrées qui référencent encore `updatedAt: today` (constante
// partagée) plutôt qu'une date explicite — les entrées avec une vraie date
// littérale (ex: "2026-08-14") priment sur ce fallback, par entrée.
const seoLandingTodayFallback = seoLandingSource.match(/const today\s*=\s*"([^"]+)"/)?.[1] || null;
const seoLandingDates = new Map();
for (const chunk of seoLandingSource.split(/(?=\s{2,4}slug:\s*")/)) {
  const slugMatch = chunk.match(/slug:\s*"([^"]+)"/);
  if (!slugMatch) continue;
  const dateMatch = chunk.match(/updatedAt:\s*"([^"]+)"/);
  seoLandingDates.set(`/${slugMatch[1]}`, dateMatch ? dateMatch[1] : seoLandingTodayFallback);
}

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
  const date = seoLandingPages.includes(p) ? seoLandingDates.get(p) || null : null;
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

// Pages prix au m² par ville (DVF) — seules les communes les plus actives
// sont pré-générées (le reste est en fallback blocking, non inclus ici pour
// ne pas faire exploser le sitemap à 29 000+ URLs).
urls.push({ loc: `${siteUrl}/prix-m2`, pathname: "/prix-m2" });
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (supabaseUrl && supabaseKey) {
  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data: yearRow } = await supabase
    .from("city_market_benchmarks_history")
    .select("year")
    .order("year", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (yearRow?.year) {
    const { data: topCities } = await supabase
      .from("city_market_benchmarks_history")
      .select("insee_code, city_name")
      .eq("year", yearRow.year)
      .order("n_transactions", { ascending: false })
      .limit(300);
    for (const c of topCities || []) {
      if (!c.insee_code || !c.city_name) continue;
      const slug = `${c.city_name
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")}-${c.insee_code}`;
      urls.push({ loc: `${siteUrl}/prix-m2/${slug}`, pathname: `/prix-m2/${slug}` });
    }
  }
} else {
  console.warn("⚠️ SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants : pages /prix-m2/[ville] non incluses dans le sitemap.");
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
