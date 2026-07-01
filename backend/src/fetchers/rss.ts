import type { RawArticle, Topic } from "../types";

function extractTag(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  if (!match) return "";
  return match[1]
    .replace(/^<!\[CDATA\[([\s\S]*?)\]\]>$/, "$1")
    .replace(/<[^>]+>/g, "")
    .trim();
}

export async function fetchRss(
  url: string,
  topic: Topic,
  sourceName: string,
  limit = 8
): Promise<RawArticle[]> {
  const res = await fetch(url, {
    headers: { "User-Agent": "news-notify-bot/1.0" },
  });
  if (!res.ok) {
    console.error(`RSS fetch failed for ${sourceName}: ${res.status}`);
    return [];
  }
  const xml = await res.text();
  const items = xml.match(/<item[\s\S]*?<\/item>/gi) ?? xml.match(/<entry[\s\S]*?<\/entry>/gi) ?? [];

  return items.slice(0, limit).map((item) => {
    const headline = extractTag(item, "title");
    const link = extractTag(item, "link") || (item.match(/<link[^>]*href="([^"]+)"/i)?.[1] ?? "");
    const description = extractTag(item, "description") || extractTag(item, "summary");
    const pubDate =
      extractTag(item, "pubDate") || extractTag(item, "published") || extractTag(item, "updated");

    return {
      topic,
      headline,
      snippet: description.slice(0, 600),
      sourceName,
      sourceUrl: link,
      publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
    };
  });
}
