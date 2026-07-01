import type { RawArticle } from "../types";

interface JolpicaRaceTable {
  MRData: {
    RaceTable: {
      Races: Array<{
        raceName: string;
        date: string;
        Circuit: { circuitName: string };
        Results?: Array<{
          position: string;
          Driver: { familyName: string; givenName: string };
          Constructor: { name: string };
        }>;
      }>;
    };
  };
}

export async function fetchJolpicaF1Latest(): Promise<RawArticle[]> {
  try {
    const url = "https://api.jolpi.ca/ergast/f1/current/last/results.json";
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`Jolpica F1 fetch failed: ${res.status}`);
      return [];
    }
    const data = (await res.json()) as JolpicaRaceTable;
    const race = data.MRData.RaceTable.Races[0];
    if (!race || !race.Results) return [];

    const podium = race.Results.slice(0, 3)
      .map((r) => `${r.position}. ${r.Driver.givenName} ${r.Driver.familyName} (${r.Constructor.name})`)
      .join(", ");

    return [
      {
        topic: "sports_f1",
        headline: `${race.raceName}: podium result`,
        snippet: `${race.raceName} at ${race.Circuit.circuitName} on ${race.date}. Podium: ${podium}.`,
        sourceName: "Jolpica F1",
        sourceUrl: "https://jolpi.ca",
        publishedAt: new Date(race.date).toISOString(),
      },
    ];
  } catch (err) {
    console.error("Jolpica F1 error", err);
    return [];
  }
}
