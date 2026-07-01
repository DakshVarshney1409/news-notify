import type { RawArticle } from "../types";

interface FootballMatch {
  utcDate: string;
  status: string;
  homeTeam: { name: string };
  awayTeam: { name: string };
  score: {
    fullTime: { home: number | null; away: number | null };
  };
  competition: { name: string };
}

export async function fetchFootballDataMatches(apiKey: string): Promise<RawArticle[]> {
  try {
    const url = "https://api.football-data.org/v4/matches";
    const res = await fetch(url, {
      headers: { "X-Auth-Token": apiKey },
    });
    if (!res.ok) {
      console.error(`football-data.org fetch failed: ${res.status}`);
      return [];
    }
    const data = (await res.json()) as { matches: FootballMatch[] };
    const relevant = (data.matches ?? []).filter(
      (m) => m.status === "FINISHED" || m.status === "IN_PLAY" || m.status === "LIVE"
    );

    return relevant.slice(0, 8).map((m) => {
      const scoreStr =
        m.score.fullTime.home !== null && m.score.fullTime.away !== null
          ? `${m.score.fullTime.home}-${m.score.fullTime.away}`
          : "TBD";
      return {
        topic: "sports_football" as const,
        headline: `${m.homeTeam.name} ${scoreStr} ${m.awayTeam.name}`,
        snippet: `${m.competition.name}: ${m.homeTeam.name} vs ${m.awayTeam.name}, final score ${scoreStr}.`,
        sourceName: "football-data.org",
        sourceUrl: "https://www.football-data.org",
        publishedAt: new Date(m.utcDate).toISOString(),
      };
    });
  } catch (err) {
    console.error("football-data.org error", err);
    return [];
  }
}
