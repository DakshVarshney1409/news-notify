import { buildDigest } from "./digest";
import type { Env } from "./types";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

async function refreshDigest(env: Env): Promise<void> {
  const digest = await buildDigest(env);
  await env.NEWS_DIGEST.put("latest", JSON.stringify(digest));
}

export default {
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(refreshDigest(env));
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    if (pathname === "/digest" && request.method === "GET") {
      const stored = await env.NEWS_DIGEST.get("latest");
      if (!stored) {
        return new Response(JSON.stringify({ error: "No digest generated yet" }), {
          status: 404,
          headers: { "Content-Type": "application/json", ...CORS_HEADERS },
        });
      }
      return new Response(stored, {
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    // Manual trigger for testing without waiting for the cron schedule.
    // Guarded by a secret so random visitors/bots can't burn the free-tier API quotas.
    if (pathname === "/debug/run" && request.method === "GET") {
      const secret = new URL(request.url).searchParams.get("secret");
      if (!env.DEBUG_SECRET || secret !== env.DEBUG_SECRET) {
        return new Response("Forbidden", { status: 403, headers: CORS_HEADERS });
      }
      try {
        await refreshDigest(env);
        return new Response(JSON.stringify({ ok: true }), {
          headers: { "Content-Type": "application/json", ...CORS_HEADERS },
        });
      } catch (err) {
        console.error("refreshDigest failed", err);
        return new Response(
          JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }),
          { status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
        );
      }
    }

    return new Response("Not found", { status: 404, headers: CORS_HEADERS });
  },
};
