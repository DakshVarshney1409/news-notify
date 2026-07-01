import type { RawArticle } from "../types";

function extractAll(xml: string, tag: string): string[] {
  const matches = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "gi")) ?? [];
  return matches.map((m) =>
    m
      .replace(new RegExp(`^<${tag}[^>]*>`, "i"), "")
      .replace(new RegExp(`</${tag}>$`, "i"), "")
      .trim()
  );
}

export async function fetchArxivAI(limit = 5): Promise<RawArticle[]> {
  try {
    const url = `http://export.arxiv.org/api/query?search_query=cat:cs.AI+OR+cat:cs.LG&sortBy=submittedDate&sortOrder=descending&max_results=${limit}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`arXiv fetch failed: ${res.status}`);
      return [];
    }
    const xml = await res.text();
    const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) ?? [];

    return entries.slice(0, limit).map((entry) => {
      const title = extractAll(entry, "title")[0]?.replace(/\s+/g, " ").trim() ?? "";
      const summary = extractAll(entry, "summary")[0]?.replace(/\s+/g, " ").trim() ?? "";
      const id = extractAll(entry, "id")[0] ?? "";
      const published = extractAll(entry, "published")[0] ?? new Date().toISOString();

      return {
        topic: "tech_ai" as const,
        headline: title,
        snippet: summary.slice(0, 600),
        sourceName: "arXiv",
        sourceUrl: id,
        publishedAt: published,
      };
    });
  } catch (err) {
    console.error("arXiv error", err);
    return [];
  }
}
