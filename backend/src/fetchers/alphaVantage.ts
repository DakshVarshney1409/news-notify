import type { RawArticle } from "../types";

const GLOBAL_INDICES: { symbol: string; label: string }[] = [
  { symbol: "SPY", label: "S&P 500 (SPY)" },
  { symbol: "DIA", label: "Dow Jones (DIA)" },
  { symbol: "QQQ", label: "Nasdaq 100 (QQQ)" },
];

interface GlobalQuote {
  "Global Quote"?: {
    "01. symbol": string;
    "05. price": string;
    "09. change": string;
    "10. change percent": string;
  };
}

export async function fetchAlphaVantageMarkets(apiKey: string): Promise<RawArticle[]> {
  const articles: RawArticle[] = [];

  for (const { symbol, label } of GLOBAL_INDICES) {
    try {
      const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${apiKey}`;
      const res = await fetch(url);
      if (!res.ok) {
        console.error(`Alpha Vantage fetch failed for ${symbol}: ${res.status}`);
        continue;
      }
      const data = (await res.json()) as GlobalQuote;
      const quote = data["Global Quote"];
      if (!quote || !quote["05. price"]) continue;

      const price = quote["05. price"];
      const change = quote["09. change"];
      const changePct = quote["10. change percent"];

      articles.push({
        topic: "markets_global",
        headline: `${label}: ${price} (${changePct})`,
        snippet: `${label} closed at ${price}, a change of ${change} (${changePct}) from the previous session.`,
        sourceName: "Alpha Vantage",
        sourceUrl: `https://www.alphavantage.co`,
        publishedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error(`Alpha Vantage error for ${symbol}`, err);
    }
  }

  return articles;
}
