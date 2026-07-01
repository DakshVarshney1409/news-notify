import type { RawArticle } from "../types";

interface HNHit {
  title: string;
  url: string | null;
  story_text: string | null;
  points: number;
  created_at: string;
  objectID: string;
}

async function searchHN(query: string, limit: number): Promise<HNHit[]> {
  const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(
    query
  )}&tags=story&hitsPerPage=${limit}`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`HN Algolia fetch failed for "${query}": ${res.status}`);
    return [];
  }
  const data = (await res.json()) as { hits: HNHit[] };
  return data.hits ?? [];
}

function toArticle(hit: HNHit, topic: "tech_general" | "tech_ai"): RawArticle {
  return {
    topic,
    headline: hit.title,
    snippet: (hit.story_text ?? "").slice(0, 600) || hit.title,
    sourceName: "Hacker News",
    sourceUrl: hit.url ?? `https://news.ycombinator.com/item?id=${hit.objectID}`,
    publishedAt: hit.created_at,
  };
}

export async function fetchHackerNewsGeneral(limit = 6): Promise<RawArticle[]> {
  const hits = await searchHN("front_page:true", limit);
  return hits.map((h) => toArticle(h, "tech_general"));
}

export async function fetchHackerNewsAI(limit = 5): Promise<RawArticle[]> {
  const hits = await searchHN("AI OR LLM OR machine learning", limit);
  return hits.map((h) => toArticle(h, "tech_ai"));
}
