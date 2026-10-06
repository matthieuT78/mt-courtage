import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { remark } from "remark";
import html from "remark-html";
import remarkGfm from "remark-gfm";
import { getDonneesImmo, computeCapaciteEmpruntPourSalaire } from "./donnees-service";
import { getIrlTokenData } from "./irl-service";

export type BlogFrontmatter = {
  title: string;
  h1?: string;
  description?: string;
  date?: string;
  updatedAt?: string;
  category?: string;
  tags?: string[];
  relatedCalculators?: string[]; // e.g. ["capacite", "investissement"]
  coverImage?: string | null;
  faq?: Array<{ q: string; a: string }>;
  // Si renseigné, {{TOKENS}} dans le corps, la description et la FAQ sont
  // remplacés au build par les vrais chiffres de capacité d'emprunt pour ce
  // salaire (mêmes taux live que /donnees, cf. lib/donnees-service.ts) —
  // évite que ces pages se désynchronisent de la donnée officielle au
  // prochain changement de taux trimestriel. Voir combien-emprunter-3000.md
  // pour la liste des tokens disponibles.
  capaciteEmpruntSalaire?: number;
  // Variante multi-tranches pour une page pilier qui couvre plusieurs
  // salaires (cf. combien-emprunter-salaire.md) : génère des tokens suffixés
  // par salaire, ex. {{CAPITAL_20_1500}}, {{BUDGET_25_3000}}.
  capaciteEmpruntSalaires?: number[];
  // Si true, les tokens {{IRL_LATEST_VALUE}}, {{IRL_Q1_LABEL}}..{{IRL_Q6_EVOL}}
  // etc. sont résolus contre la table irl_values (source INSEE, cf.
  // lib/irl-service.ts) — même logique que capaciteEmpruntSalaire, pour que
  // la page ne fige jamais une valeur IRL devenue fausse au trimestre suivant.
  irlLiveData?: boolean;
};

function fmtEuro(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function tokensForSalaire(
  cap: ReturnType<typeof computeCapaciteEmpruntPourSalaire>,
  suffix: string
): Record<string, string> {
  return {
    [`MENSUALITE${suffix}`]: fmtEuro(cap.mensualite),
    [`CAPITAL_15${suffix}`]: fmtEuro(cap.capital15),
    [`CAPITAL_20${suffix}`]: fmtEuro(cap.capital20),
    [`CAPITAL_25${suffix}`]: fmtEuro(cap.capital25),
    [`BUDGET_20${suffix}`]: fmtEuro(cap.budget20),
    [`APPORT_20${suffix}`]: fmtEuro(cap.apport20),
    [`BUDGET_25${suffix}`]: fmtEuro(cap.budget25),
    [`APPORT_25${suffix}`]: fmtEuro(cap.apport25),
    [`TAUX_15${suffix}`]: cap.taux15.toLocaleString("fr-FR", { minimumFractionDigits: 2 }),
    [`TAUX_20${suffix}`]: cap.taux20.toLocaleString("fr-FR", { minimumFractionDigits: 2 }),
    [`TAUX_25${suffix}`]: cap.taux25.toLocaleString("fr-FR", { minimumFractionDigits: 2 }),
    [`CREDIT150_DISPO${suffix}`]: fmtEuro(Math.max(cap.mensualite - 150, 0)),
    [`CREDIT300_DISPO${suffix}`]: fmtEuro(Math.max(cap.mensualite - 300, 0)),
    [`CREDIT500_DISPO${suffix}`]: fmtEuro(Math.max(cap.mensualite - 500, 0)),
    [`CREDIT150_CAPITAL${suffix}`]: fmtEuro(cap.capitalApresCredit20(150)),
    [`CREDIT300_CAPITAL${suffix}`]: fmtEuro(cap.capitalApresCredit20(300)),
    [`CREDIT500_CAPITAL${suffix}`]: fmtEuro(cap.capitalApresCredit20(500)),
    [`INTERETS_15${suffix}`]: fmtEuro(cap.mensualite * 15 * 12 - cap.capital15),
    [`INTERETS_20${suffix}`]: fmtEuro(cap.mensualite * 20 * 12 - cap.capital20),
    [`INTERETS_25${suffix}`]: fmtEuro(cap.mensualite * 25 * 12 - cap.capital25),
  };
}

function fmtPct(n: number): string {
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtIrl(n: number): string {
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function buildIrlTokens(): Promise<Record<string, string>> {
  const irl = await getIrlTokenData();
  if (!irl) return {};
  const tokens: Record<string, string> = {
    IRL_LATEST_LABEL: irl.latest.label,
    IRL_LATEST_VALUE: fmtIrl(irl.latest.value),
  };
  if (irl.yearAgo) tokens.IRL_YEARAGO_LABEL = irl.yearAgo.label;
  if (irl.yearAgo) tokens.IRL_YEARAGO_VALUE = fmtIrl(irl.yearAgo.value);
  if (irl.evolutionPct != null) {
    tokens.IRL_EVOLUTION_PCT = (irl.evolutionPct >= 0 ? "+" : "") + fmtPct(irl.evolutionPct);
  }
  irl.rows.forEach((row, i) => {
    const n = i + 1;
    tokens[`IRL_Q${n}_LABEL`] = row.label;
    tokens[`IRL_Q${n}_VALUE`] = fmtIrl(row.value);
    tokens[`IRL_Q${n}_EVOL`] = row.evolutionPct != null ? (row.evolutionPct >= 0 ? "+" : "") + fmtPct(row.evolutionPct) : "—";
  });
  return tokens;
}

async function applyCapaciteEmpruntTokens<T>(
  value: T,
  salaire: number | undefined,
  salaires: number[] | undefined,
  irlLiveData?: boolean
): Promise<T> {
  if (!salaire && !salaires?.length && !irlLiveData) return value;

  let tokens: Record<string, string> = {};

  if (salaire || salaires?.length) {
    const donnees = await getDonneesImmo();
    if (salaire) {
      const cap = computeCapaciteEmpruntPourSalaire(salaire, donnees.taux_credit_immobilier);
      tokens = { ...tokens, ...tokensForSalaire(cap, "") };
    }
    for (const s of salaires || []) {
      const cap = computeCapaciteEmpruntPourSalaire(s, donnees.taux_credit_immobilier);
      tokens = { ...tokens, ...tokensForSalaire(cap, `_${s}`) };
    }
  }

  if (irlLiveData) {
    tokens = { ...tokens, ...(await buildIrlTokens()) };
  }

  const replaceTokens = (s: string) =>
    s.replace(/\{\{(\w+)\}\}/g, (match, key) => (key in tokens ? tokens[key] : match));

  const walk = (v: any): any => {
    if (typeof v === "string") return replaceTokens(v);
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") {
      const out: any = {};
      for (const k of Object.keys(v)) out[k] = walk(v[k]);
      return out;
    }
    return v;
  };

  return walk(value);
}

export type TocEntry = { id: string; text: string; level: number };

export type BlogPost = {
  slug: string;
  frontmatter: BlogFrontmatter;
  contentHtml: string;
  readingTime: number; // minutes
  toc: TocEntry[];
};

const BLOG_DIR = path.join(process.cwd(), "content", "blog");
const PUBLIC_DIR = path.join(process.cwd(), "public");

// Un article peut être écrit avant que son image de couverture ne soit
// uploadée (cf. workflow de rédaction) — on ne renvoie coverImage que si le
// fichier existe réellement, pour retomber sur le dégradé placeholder côté
// UI plutôt qu'une icône d'image cassée.
function resolveFrontmatter(data: BlogFrontmatter): BlogFrontmatter {
  if (!data.coverImage) return data;
  const filePath = path.join(PUBLIC_DIR, data.coverImage);
  return fs.existsSync(filePath) ? data : { ...data, coverImage: null };
}

function computeReadingTime(rawContent: string): number {
  const words = rawContent.trim().split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 200));
}

function addHeadingIds(html: string): string {
  return html.replace(/<h([23])([^>]*)>(.*?)<\/h\1>/gi, (_, level, attrs, inner) => {
    const text = inner.replace(/<[^>]+>/g, "");
    const id = text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    return `<h${level}${attrs} id="${id}">${inner}</h${level}>`;
  });
}

function extractToc(htmlWithIds: string): TocEntry[] {
  const matches = [...htmlWithIds.matchAll(/<h([23])[^>]*id="([^"]*)"[^>]*>(.*?)<\/h[23]>/gi)];
  return matches.map((m) => ({
    level: parseInt(m[1]),
    id: m[2],
    text: m[3].replace(/<[^>]+>/g, ""),
  }));
}

export function getAllBlogSlugs(): string[] {
  if (!fs.existsSync(BLOG_DIR)) return [];
  return fs
    .readdirSync(BLOG_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((f) => f.replace(/\.md$/, ""));
}

// Async car certains articles (cf. capaciteEmpruntSalaire(s) en frontmatter)
// ont une description générée avec des {{TOKENS}} à résoudre contre la
// donnée live — sans ça, les cartes "à lire aussi", l'index /blog et le flux
// /api/content/lokt-feed afficheraient les tokens bruts au lieu du chiffre.
export async function getAllPostsMeta(): Promise<Array<{ slug: string; frontmatter: BlogFrontmatter; readingTime: number }>> {
  const slugs = getAllBlogSlugs();
  const posts = await Promise.all(
    slugs.map(async (slug) => {
      const filePath = path.join(BLOG_DIR, `${slug}.md`);
      const file = fs.readFileSync(filePath, "utf8");
      const { data, content } = matter(file);
      const fm = data as BlogFrontmatter;
      const frontmatter = await applyCapaciteEmpruntTokens(
        resolveFrontmatter(fm),
        fm.capaciteEmpruntSalaire,
        fm.capaciteEmpruntSalaires,
        fm.irlLiveData
      );
      return { slug, frontmatter, readingTime: computeReadingTime(content) };
    })
  );
  return posts.sort((a, b) => (b.frontmatter.date || "").localeCompare(a.frontmatter.date || ""));
}

export async function getPostBySlug(slug: string): Promise<BlogPost> {
  const filePath = path.join(BLOG_DIR, `${slug}.md`);
  const file = fs.readFileSync(filePath, "utf8");
  const { data, content: rawContent } = matter(file);

  const salaire = (data as BlogFrontmatter).capaciteEmpruntSalaire;
  const salaires = (data as BlogFrontmatter).capaciteEmpruntSalaires;
  const irlLiveData = (data as BlogFrontmatter).irlLiveData;
  const content = await applyCapaciteEmpruntTokens(rawContent, salaire, salaires, irlLiveData);
  const frontmatterResolved = await applyCapaciteEmpruntTokens(
    resolveFrontmatter((data || {}) as BlogFrontmatter),
    salaire,
    salaires,
    irlLiveData
  );

  const processed = await remark().use(remarkGfm).use(html, { sanitize: false }).process(content);
  const rawHtml = processed.toString().replace(/^<h1[^>]*>.*?<\/h1>\s*/i, "");
  const contentHtml = addHeadingIds(rawHtml);
  const toc = extractToc(contentHtml);
  const readingTime = computeReadingTime(content);

  return {
    slug,
    frontmatter: frontmatterResolved,
    contentHtml,
    readingTime,
    toc,
  };
}
