import { fetchRss } from "./fetchers/rss";
import { fetchGNews, fetchGNewsTopHeadlines } from "./fetchers/gnews";
import { fetchAlphaVantageMarkets } from "./fetchers/alphaVantage";
import { fetchYahooFinanceIndianMarkets } from "./fetchers/yahooFinance";
import { fetchFootballDataMatches } from "./fetchers/footballData";
import { fetchJolpicaF1Latest } from "./fetchers/jolpicaF1";
import { fetchHackerNewsGeneral, fetchHackerNewsAI } from "./fetchers/hackerNews";
import { fetchArxivAI } from "./fetchers/arxiv";
import { summarizeArticles } from "./summarize";
import type { Digest, Env, NewsByte, RawArticle, Topic } from "./types";

const TOPICS: Topic[] = [
  "sports_football",
  "sports_cricket",
  "sports_f1",
  "sports_other",
  "current_affairs",
  "tech_ai",
  "tech_general",
  "finance_global",
  "finance_india",
  "politics_global",
  "politics_india",
  "markets_global",
  "markets_india",
  "controversy",
];

const CONTROVERSY_KEYWORDS = ["controversy", "backlash", "scandal", "outrage", "row", "slam"];

// Cloudflare Workers' free plan caps a single invocation at 50 subrequests.
// Fetching all sources already burns ~16, plus 1 KV write, so leave headroom
// for Gemini calls (one subrequest each) by capping how many articles per
// topic we bother summarizing.
const MAX_ARTICLES_PER_TOPIC_TO_SUMMARIZE = 2;

async function fetchAllRawArticles(env: Env): Promise<RawArticle[]> {
  const results = await Promise.allSettled([
    fetchRss("https://feeds.bbci.co.uk/sport/football/rss.xml", "sports_football", "BBC Sport"),
    fetchFootballDataMatches(env.FOOTBALL_DATA_API_KEY),
    fetchRss(
      "https://www.espncricinfo.com/rss/content/story/feeds/0.xml",
      "sports_cricket",
      "ESPN Cricinfo"
    ),
    fetchJolpicaF1Latest(),
    fetchRss("https://feeds.bbci.co.uk/sport/rss.xml", "sports_other", "BBC Sport"),
    fetchGNewsTopHeadlines(env.GNEWS_API_KEY, "general", "current_affairs"),
    fetchHackerNewsGeneral(),
    fetchHackerNewsAI(),
    fetchArxivAI(),
    fetchRss("https://feeds.reuters.com/reuters/businessNews", "finance_global", "Reuters"),
    fetchRss(
      "https://www.moneycontrol.com/rss/latestnews.xml",
      "finance_india",
      "Moneycontrol"
    ),
    fetchRss(
      "https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms",
      "finance_india",
      "Economic Times"
    ),
    fetchRss("https://feeds.bbci.co.uk/news/world/rss.xml", "politics_global", "BBC World"),
    fetchRss(
      "https://timesofindia.indiatimes.com/rssfeeds/-2128936835.cms",
      "politics_india",
      "Times of India"
    ),
    fetchAlphaVantageMarkets(env.ALPHA_VANTAGE_API_KEY),
    fetchYahooFinanceIndianMarkets(),
    fetchGNews(env.GNEWS_API_KEY, "controversy OR backlash OR scandal", "controversy"),
  ]);

  const articles: RawArticle[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") articles.push(...r.value);
    else console.error("Fetcher rejected", r.reason);
  }
  return articles;
}

function capArticlesPerTopic(articles: RawArticle[], maxPerTopic: number): RawArticle[] {
  const counts = new Map<Topic, number>();
  return articles.filter((a) => {
    const count = counts.get(a.topic) ?? 0;
    if (count >= maxPerTopic) return false;
    counts.set(a.topic, count + 1);
    return true;
  });
}

// Reuses already-summarized bytes instead of re-running Gemini on duplicate
// copies of the same article, to stay within the subrequest budget.
function deriveControversies(bytes: NewsByte[]): NewsByte[] {
  return bytes
    .filter((b) => b.topic !== "controversy")
    .filter((b) =>
      CONTROVERSY_KEYWORDS.some((kw) => b.headline.toLowerCase().includes(kw))
    )
    .map((b) => ({ ...b, id: crypto.randomUUID(), topic: "controversy" as const }));
}

function groupByTopic(bytes: NewsByte[]): Record<Topic, NewsByte[]> {
  const grouped = Object.fromEntries(TOPICS.map((t) => [t, [] as NewsByte[]])) as Record<
    Topic,
    NewsByte[]
  >;

  for (const byte of bytes) {
    grouped[byte.topic].push(byte);
  }

  for (const topic of TOPICS) {
    grouped[topic].sort((a, b) => b.importance - a.importance);
    grouped[topic] = grouped[topic].slice(0, 5);
  }

  return grouped;
}

export async function buildDigest(env: Env): Promise<Digest> {
  const rawArticles = await fetchAllRawArticles(env);
  const capped = capArticlesPerTopic(rawArticles, MAX_ARTICLES_PER_TOPIC_TO_SUMMARIZE);

  const summarized = await summarizeArticles(env.GEMINI_API_KEY, capped);
  const bytes = [...summarized, ...deriveControversies(summarized)];
  const topics = groupByTopic(bytes);

  const now = new Date();
  return {
    digestDate: now.toISOString().slice(0, 10),
    generatedAt: now.toISOString(),
    topics,
  };
}
