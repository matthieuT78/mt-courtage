import type { NextApiRequest, NextApiResponse } from "next";

export type NewsItem = {
  title: string;
  url: string;
  image: string | null;
  source: string;
  publishedAt: string;
};

let cache: { ts: number; items: NewsItem[] } | null = null;
const CACHE_TTL = 20 * 60 * 1000;

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

type FeedDef = { url: string; source: string; isGoogleNews?: boolean };

const FEEDS: FeedDef[] = [
  { url: "https://www.lefigaro.fr/rss/figaro_immobilier.xml",                                    source: "Le Figaro" },
  { url: "https://www.lemonde.fr/immobilier/rss_full.xml",                                       source: "Le Monde" },
  { url: "https://news.google.com/rss/search?q=immobilier+location+lmnp&hl=fr&gl=FR&ceid=FR:fr", source: "", isGoogleNews: true },
];

function extractText(xml: string, tag: string): string {
  const m =
    xml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, "i")) ??
    xml.match(new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`, "i"));
  return (m?.[1] ?? "")
    .trim()
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&quot;/g, '"');
}

function extractImage(item: string): string | null {
  return (
    item.match(/<enclosure[^>]+url="([^"]+\.(jpg|jpeg|png|webp)[^"]*)"/i)?.[1] ??
    item.match(/<media:content[^>]+url="([^"]+)"/i)?.[1] ??
    item.match(/<media:thumbnail[^>]+url="([^"]+)"/i)?.[1] ??
    null
  );
}

async function fetchFeed({ url, source, isGoogleNews }: FeedDef): Promise<NewsItem[]> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/rss+xml, application/xml, text/xml, */*" },
    signal: AbortSignal.timeout(7000),
  });
  if (!res.ok) return [];
  const xml = await res.text();

  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)]
    .slice(0, isGoogleNews ? 8 : 5)
    .map(([, item]) => {
      // Google News: title = "Real title - Source Name", <source>Source Name</source>
      let title = extractText(item, "title");
      let itemSource = source;
      if (isGoogleNews) {
        const gnSource = extractText(item, "source");
        if (gnSource) {
          itemSource = gnSource;
          // Strip " - Source Name" suffix added by Google News
          const suffix = ` - ${gnSource}`;
          if (title.endsWith(suffix)) title = title.slice(0, -suffix.length);
        }
      }
      return {
        title,
        url: extractText(item, "link") || extractText(item, "guid"),
        image: extractImage(item),
        source: itemSource,
        publishedAt: extractText(item, "pubDate"),
      };
    })
    .filter((i) => i.title && i.url);
}

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "s-maxage=1200, stale-while-revalidate=300");

  if (cache && Date.now() - cache.ts < CACHE_TTL) {
    return res.status(200).json(cache.items);
  }

  try {
    const results = await Promise.allSettled(FEEDS.map((f) => fetchFeed(f)));
    const seen = new Set<string>();
    const items = results
      .flatMap((r) => (r.status === "fulfilled" ? r.value : []))
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
      .filter((i) => {
        if (seen.has(i.url)) return false;
        seen.add(i.url);
        return true;
      })
      .slice(0, 8);

    if (items.length > 0) cache = { ts: Date.now(), items };
    return res.status(200).json(items);
  } catch {
    return res.status(200).json([]);
  }
}
