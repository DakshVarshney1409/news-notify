export type Topic =
  | "sports_football"
  | "sports_cricket"
  | "sports_f1"
  | "sports_other"
  | "current_affairs"
  | "tech_ai"
  | "tech_general"
  | "finance_global"
  | "finance_india"
  | "politics_global"
  | "politics_india"
  | "markets_global"
  | "markets_india"
  | "controversy";

export interface RawArticle {
  topic: Topic;
  headline: string;
  snippet: string;
  sourceName: string;
  sourceUrl: string;
  publishedAt: string;
}

export interface NewsByte {
  id: string;
  topic: Topic;
  headline: string;
  summary: string;
  sourceName: string;
  sourceUrl: string;
  publishedAt: string;
  importance: number;
  fetchedAt: string;
}

export type Digest = {
  digestDate: string;
  generatedAt: string;
  topics: Record<Topic, NewsByte[]>;
};

export interface Env {
  NEWS_DIGEST: KVNamespace;
  GEMINI_API_KEY: string;
  GNEWS_API_KEY: string;
  ALPHA_VANTAGE_API_KEY: string;
  FOOTBALL_DATA_API_KEY: string;
  DEBUG_SECRET: string;
}
