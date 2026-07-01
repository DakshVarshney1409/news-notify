# News Notify

A personal, zero-cost daily news briefing: a Cloudflare Worker fetches sports/tech/finance/politics/markets news once a day, summarizes it into short "bytes" with Gemini, and a static site (hosted free on GitHub Pages) displays it as a card feed you can add to your iPhone home screen.

Total recurring cost: **$0** (all pieces run on free tiers).

## 1. Get free API keys

| Service | Where to sign up | Used for |
|---|---|---|
| Google AI Studio | https://aistudio.google.com/apikey | Gemini 2.5 Flash-Lite summarization (free tier) |
| GNews.io | https://gnews.io | current affairs + controversy search (100 req/day free) |
| Alpha Vantage | https://www.alphavantage.co/support/#api-key | global market quotes (25 req/day free) |
| football-data.org | https://www.football-data.org/client/register | football match results (free tier) |

No key needed for: RSS feeds, Jolpica F1, Hacker News (Algolia), arXiv, Yahoo Finance's unofficial chart endpoint.

## 2. Deploy the backend (Cloudflare Workers)

```bash
cd backend
npm install
npx wrangler login          # opens a browser to authorize your free Cloudflare account

# Create the KV namespace used to store the daily digest
npx wrangler kv namespace create NEWS_DIGEST
npx wrangler kv namespace create NEWS_DIGEST --preview
```

Copy the `id` and `preview_id` printed by those two commands into `backend/wrangler.toml` (replacing the `REPLACE_WITH_...` placeholders).

```bash
# Set your secrets (paste each key when prompted)
npx wrangler secret put GEMINI_API_KEY
npx wrangler secret put GNEWS_API_KEY
npx wrangler secret put ALPHA_VANTAGE_API_KEY
npx wrangler secret put FOOTBALL_DATA_API_KEY
npx wrangler secret put DEBUG_SECRET     # any random string you make up, protects manual test runs

npx wrangler deploy
```

Wrangler prints your Worker's URL, e.g. `https://news-notify.<your-subdomain>.workers.dev`.

### Test it

```bash
# Manually trigger a digest build (uses the secret you set above)
curl "https://news-notify.<your-subdomain>.workers.dev/debug/run?secret=<your-debug-secret>"

# Then check the result
curl "https://news-notify.<your-subdomain>.workers.dev/digest"
```

The cron trigger in `wrangler.toml` (`0 0 * * *`) runs this automatically once a day at 00:00 UTC (~5:30am IST). Watch a live run with `npx wrangler tail`.

## 3. Point the website at your Worker

Edit `web/app.js` and replace the placeholder:

```js
const WORKER_URL = "https://news-notify.YOUR_SUBDOMAIN.workers.dev";
```

## 4. Deploy the website (GitHub Pages)

```bash
# from the news-notify repo root
git init   # if not already a repo
git add .
git commit -m "Initial commit"
git remote add origin <your-github-repo-url>
git push -u origin main
```

Then in the GitHub repo: **Settings → Pages → Source**, pick the branch and the `/web` folder (or move `web/`'s contents to `/docs` if you'd rather use that convention — either works, just point Pages at the folder containing `index.html`).

GitHub gives you a URL like `https://<username>.github.io/<repo>/`.

## 5. Add it to your iPhone home screen

1. Open the GitHub Pages URL in Safari on your iPhone.
2. Tap the Share icon → **Add to Home Screen**.
3. It launches full-screen (no browser chrome) using the icon in `web/icons/`.

The icons currently in `web/icons/` are simple placeholders generated with ImageMagick — swap in your own 192x192 and 512x512 PNGs whenever you like.

## Local development

```bash
# Backend
cd backend && npm run dev        # wrangler dev, local Worker on http://localhost:8787

# Frontend
cd web && python3 -m http.server 8910   # http://localhost:8910
```

The site works standalone with no backend running — it falls back to a small built-in sample digest (see `SAMPLE_DIGEST` in `app.js`) until it can reach your deployed Worker, and thereafter caches the last successful digest in `localStorage` so it still shows content offline.

## How it fits together

```
Cloudflare Cron (1x/day)
  → Worker: fetch RSS/APIs per topic → Gemini summarizes each article → write digest JSON to KV
  → GET /digest serves the latest digest (CORS-open)
  → Static site (GitHub Pages) fetches /digest, renders topic cards, caches to localStorage
```

See `backend/src/types.ts` for the exact digest/byte JSON shape.
