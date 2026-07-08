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
  // Index du jour UTC — change chaque jour à minuit
  const dayIndex = Math.floor(Date.now() / 86_400_000);

  // Pool complet trié par date (tous les articles, pas juste les récents)
  const allPosts = getAllPostsMeta()
    .sort((a: any, b: any) => new Date(b.frontmatter.date || 0).getTime() - new Date(a.frontmatter.date || 0).getTime())
    .map((p: any) => ({
      type: "blog" as const,
      title: p.frontmatter.title,
      description: p.frontmatter.description || "",
      url: `/blog/${p.slug}`,
      category: p.frontmatter.category || "Blog",
      date: p.frontmatter.date || "",
    }));

  const allGuides = [...GUIDES]
    .sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime())
    .map((g) => ({
      type: "guide" as const,
      title: g.shortTitle,
      description: g.description,
      url: `/guides/${g.slug}`,
      category: PHASE_LABEL[g.category] ?? g.category,
      date: g.updatedAt || "",
    }));

  // Rotation quotidienne : 2 articles + 2 guides, décalés chaque jour
  const pick = <T>(pool: T[], offset: number): [T, T] => [
    pool[offset % pool.length],
    pool[(offset + 1) % pool.length],
  ];

  const feed = [
    ...pick(allPosts, dayIndex * 2),
    ...pick(allGuides, dayIndex * 2),
  ];

  // Cache expirant à minuit UTC pour que le changement soit instantané
  const secondsUntilMidnight = 86_400 - (Math.floor(Date.now() / 1000) % 86_400);
  res.setHeader("Cache-Control", `s-maxage=${secondsUntilMidnight}, stale-while-revalidate=60`);
  res.status(200).json(feed);
}
