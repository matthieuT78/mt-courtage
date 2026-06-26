import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { remark } from "remark";
import html from "remark-html";
import remarkGfm from "remark-gfm";

export type BlogFrontmatter = {
  title: string;
  description?: string;
  date?: string;
  category?: string;
  tags?: string[];
  relatedCalculators?: string[]; // e.g. ["capacite", "investissement"]
  coverImage?: string;
};

export type TocEntry = { id: string; text: string; level: number };

export type BlogPost = {
  slug: string;
  frontmatter: BlogFrontmatter;
  contentHtml: string;
  readingTime: number; // minutes
  toc: TocEntry[];
};

const BLOG_DIR = path.join(process.cwd(), "content", "blog");

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

export function getAllPostsMeta(): Array<{ slug: string; frontmatter: BlogFrontmatter; readingTime: number }> {
  const slugs = getAllBlogSlugs();
  return slugs
    .map((slug) => {
      const filePath = path.join(BLOG_DIR, `${slug}.md`);
      const file = fs.readFileSync(filePath, "utf8");
      const { data, content } = matter(file);
      return { slug, frontmatter: data as BlogFrontmatter, readingTime: computeReadingTime(content) };
    })
    .sort((a, b) => (b.frontmatter.date || "").localeCompare(a.frontmatter.date || ""));
}

export async function getPostBySlug(slug: string): Promise<BlogPost> {
  const filePath = path.join(BLOG_DIR, `${slug}.md`);
  const file = fs.readFileSync(filePath, "utf8");
  const { data, content } = matter(file);

  const processed = await remark().use(remarkGfm).use(html, { sanitize: false }).process(content);
  const rawHtml = processed.toString();
  const contentHtml = addHeadingIds(rawHtml);
  const toc = extractToc(contentHtml);
  const readingTime = computeReadingTime(content);

  return {
    slug,
    frontmatter: (data || {}) as BlogFrontmatter,
    contentHtml,
    readingTime,
    toc,
  };
}
