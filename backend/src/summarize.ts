import type { NewsByte, RawArticle } from "./types";

const GEMINI_MODEL = "gemini-2.5-flash-lite";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const SYSTEM_PROMPT = `You are a news summarizer for a personal daily briefing app. You will be given a raw news article (headline + snippet + source). Produce a short, punchy, discussion-ready summary written so the reader could casually mention it to a colleague at the office. Do not editorialize beyond what the source supports.`;

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    headline: { type: "STRING", description: "Punchy rewritten headline, 12 words or fewer" },
    summary: { type: "STRING", description: "2-4 sentence casual, discussion-ready summary" },
    importance: { type: "INTEGER", description: "1-5, how significant/discussion-worthy this is" },
  },
  required: ["headline", "summary", "importance"],
};

interface GeminiCandidate {
  content?: { parts?: Array<{ text?: string }> };
}

interface GeminiResponse {
  candidates?: GeminiCandidate[];
}

async function summarizeOne(
  apiKey: string,
  article: RawArticle
): Promise<{ headline: string; summary: string; importance: number } | null> {
  const body = {
    system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `Headline: ${article.headline}\nSource: ${article.sourceName}\nSnippet: ${article.snippet}`,
          },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
    },
  };

  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    console.error(`Gemini call failed for "${article.headline}": ${res.status}`);
    return null;
  }

  const data = (await res.json()) as GeminiResponse;
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return null;

  try {
    const parsed = JSON.parse(text);
    return {
      headline: parsed.headline ?? article.headline,
      summary: parsed.summary ?? article.snippet,
      importance: Math.min(5, Math.max(1, Number(parsed.importance) || 3)),
    };
  } catch (err) {
    console.error(`Failed to parse Gemini JSON for "${article.headline}"`, err);
    return null;
  }
}

export async function summarizeArticles(
  apiKey: string,
  articles: RawArticle[]
): Promise<NewsByte[]> {
  const results: NewsByte[] = [];

  // Sequential to stay well under Gemini's free-tier per-minute rate limit.
  for (const article of articles) {
    const summarized = await summarizeOne(apiKey, article);
    const now = new Date().toISOString();

    results.push({
      id: crypto.randomUUID(),
      topic: article.topic,
      headline: summarized?.headline ?? article.headline,
      summary: summarized?.summary ?? article.snippet,
      sourceName: article.sourceName,
      sourceUrl: article.sourceUrl,
      publishedAt: article.publishedAt,
      importance: summarized?.importance ?? 3,
      fetchedAt: now,
    });
  }

  return results;
}
