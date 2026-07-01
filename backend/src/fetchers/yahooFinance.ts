import type { RawArticle } from "../types";

const INDIAN_INDICES: { symbol: string; label: string }[] = [
  { symbol: "%5ENSEI", label: "Nifty 50" },
  { symbol: "%5EBSESN", label: "Sensex" },
];

interface YahooChartResponse {
  chart: {
    result: [
      {
        meta: {
          regularMarketPrice: number;
          previousClose: number;
          currency: string;
        };
      }
    ] | null;
  };
}

export async function fetchYahooFinanceIndianMarkets(): Promise<RawArticle[]> {
  const articles: RawArticle[] = [];

  for (const { symbol, label } of INDIAN_INDICES) {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`;
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (news-notify-bot)" },
      });
      if (!res.ok) {
        console.error(`Yahoo Finance fetch failed for ${symbol}: ${res.status}`);
        continue;
      }
      const data = (await res.json()) as YahooChartResponse;
      const meta = data.chart?.result?.[0]?.meta;
      if (!meta) continue;

      const change = meta.regularMarketPrice - meta.previousClose;
      const changePct = (change / meta.previousClose) * 100;

      articles.push({
        topic: "markets_india",
        headline: `${label}: ${meta.regularMarketPrice.toFixed(2)} (${changePct >= 0 ? "+" : ""}${changePct.toFixed(2)}%)`,
        snippet: `${label} is trading at ${meta.regularMarketPrice.toFixed(2)}, a change of ${change.toFixed(2)} (${changePct.toFixed(2)}%) from the previous close of ${meta.previousClose.toFixed(2)}.`,
        sourceName: "Yahoo Finance",
        sourceUrl: `https://finance.yahoo.com/quote/${symbol.replace("%5E", "^")}`,
        publishedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error(`Yahoo Finance error for ${symbol}`, err);
    }
  }

  return articles;
}
