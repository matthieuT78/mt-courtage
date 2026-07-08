import type { NextApiRequest, NextApiResponse } from "next";
import { getAllPostsMeta } from "../../../lib/blog";
import { GUIDES } from "../../../lib/guides";

export type LoktFeedItem = {
  type: "blog" | "guide";
  title: string;
  description: string;
  url: string;
  category: string;
  date: string;
};

const PHASE_LABEL: Record<string, string> = {
  preparer: "Préparer",
  arrivee: "Accueillir",
  gestion: "Gestion",
  depart: "Départ",
};

export default function handler(_req: NextApiRequest, res: NextApiResponse<LoktFeedItem[]>) {
  const posts = getAllPostsMeta()
    .sort((a: any, b: any) => new Date(b.frontmatter.date || 0).getTime() - new Date(a.frontmatter.date || 0).getTime())
    .slice(0, 5)
    .map((p: any) => ({
      type: "blog" as const,
      title: p.frontmatter.title,
      description: p.frontmatter.description || "",
      url: `/blog/${p.slug}`,
      category: p.frontmatter.category || "Blog",
      date: p.frontmatter.date || "",
    }));

  const guides = [...GUIDES]
    .sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime())
    .slice(0, 4)
    .map((g) => ({
      type: "guide" as const,
      title: g.shortTitle,
      description: g.description,
      url: `/guides/${g.slug}`,
      category: PHASE_LABEL[g.category] ?? g.category,
      date: g.updatedAt || "",
    }));

  const feed = [...posts.slice(0, 4), ...guides.slice(0, 3)]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 6);

  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=600");
  res.status(200).json(feed);
}
