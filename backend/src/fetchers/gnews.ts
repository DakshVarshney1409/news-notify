import type { RawArticle, Topic } from "../types";

interface GNewsArticle {
  title: string;
  description: string;
  content: string;
  url: string;
  source: { name: string };
  publishedAt: string;
}

export async function fetchGNews(
  apiKey: string,
  query: string,
  topic: Topic,
  max = 6
): Promise<RawArticle[]> {
  const url = `https://gnews.io/api/v4/search?q=${encodeURIComponent(
    query
  )}&lang=en&max=${max}&apikey=${apiKey}`;

  const res = await fetch(url);
  if (!res.ok) {
    console.error(`GNews fetch failed for "${query}": ${res.status}`);
    return [];
  }
  const data = (await res.json()) as { articles: GNewsArticle[] };

  return (data.articles ?? []).map((a) => ({
    topic,
    headline: a.title,
    snippet: (a.description || a.content || "").slice(0, 600),
    sourceName: a.source?.name ?? "GNews",
    sourceUrl: a.url,
    publishedAt: a.publishedAt,
  }));
}

export async function fetchGNewsTopHeadlines(
  apiKey: string,
  category: string,
  topic: Topic,
  max = 6
): Promise<RawArticle[]> {
  const url = `https://gnews.io/api/v4/top-headlines?category=${encodeURIComponent(
    category
  )}&lang=en&max=${max}&apikey=${apiKey}`;

  const res = await fetch(url);
  if (!res.ok) {
    console.error(`GNews top-headlines failed for "${category}": ${res.status}`);
    return [];
  }
  const data = (await res.json()) as { articles: GNewsArticle[] };

  return (data.articles ?? []).map((a) => ({
    topic,
    headline: a.title,
    snippet: (a.description || a.content || "").slice(0, 600),
    sourceName: a.source?.name ?? "GNews",
    sourceUrl: a.url,
    publishedAt: a.publishedAt,
  }));
}
