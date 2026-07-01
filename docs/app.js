// Point this at your deployed Cloudflare Worker, e.g. "https://news-notify.<you>.workers.dev"
const WORKER_URL = "https://news-notify.newsnotify.workers.dev";
const DIGEST_ENDPOINT = `${WORKER_URL}/digest`;
const CACHE_KEY = "news-notify:last-digest";

const TOPIC_META = {
  sports_football: { label: "Football", icon: "⚽" },
  sports_cricket: { label: "Cricket", icon: "🏏" },
  sports_f1: { label: "F1", icon: "🏎️" },
  sports_other: { label: "Sports", icon: "🏅" },
  current_affairs: { label: "Current Affairs", icon: "📰" },
  tech_ai: { label: "AI Research", icon: "🤖" },
  tech_general: { label: "Tech", icon: "💻" },
  finance_global: { label: "Global Finance", icon: "💰" },
  finance_india: { label: "Indian Finance", icon: "🪙" },
  politics_global: { label: "Global Politics", icon: "🌍" },
  politics_india: { label: "Indian Politics", icon: "🇮🇳" },
  markets_global: { label: "Global Markets", icon: "📈" },
  markets_india: { label: "Indian Markets", icon: "📊" },
  controversy: { label: "Controversies", icon: "🔥" },
};

const TOPIC_ORDER = Object.keys(TOPIC_META);

// Sample digest used only when no cache exists yet and the network fetch hasn't resolved,
// so the layout is visible immediately during local development.
const SAMPLE_DIGEST = {
  digestDate: "2026-07-01",
  generatedAt: "2026-07-01T00:00:00Z",
  topics: {
    tech_ai: [
      {
        id: "sample-1",
        topic: "tech_ai",
        headline: "New reasoning benchmark shakes up AI leaderboards",
        summary:
          "A newly published benchmark is exposing gaps in how well large models handle multi-step reasoning. Several labs are already citing it in their latest releases. Expect it to come up in any AI water-cooler chat this week.",
        sourceName: "Sample Source",
        sourceUrl: "#",
        publishedAt: "2026-07-01T00:00:00Z",
        importance: 4,
        fetchedAt: "2026-07-01T00:00:00Z",
      },
    ],
    markets_india: [
      {
        id: "sample-2",
        topic: "markets_india",
        headline: "Sensex ticks up in early trade",
        summary: "Indian benchmark indices opened higher, tracking gains in global markets overnight.",
        sourceName: "Sample Source",
        sourceUrl: "#",
        publishedAt: "2026-07-01T00:00:00Z",
        importance: 3,
        fetchedAt: "2026-07-01T00:00:00Z",
      },
    ],
  },
};

let currentDigest = null;
let activeFilter = "all";

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCache(digest) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(digest));
  } catch {
    // ignore quota errors
  }
}

function formatRelativeTime(isoString) {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function renderTopicChips(digest) {
  const container = document.getElementById("topicChips");
  container.innerHTML = "";

  const allChip = makeChip("all", "All");
  container.appendChild(allChip);

  for (const topic of TOPIC_ORDER) {
    if (!digest.topics[topic] || digest.topics[topic].length === 0) continue;
    container.appendChild(makeChip(topic, `${TOPIC_META[topic].icon} ${TOPIC_META[topic].label}`));
  }
}

function makeChip(topic, label) {
  const btn = document.createElement("button");
  btn.className = "chip" + (topic === activeFilter ? " active" : "");
  btn.textContent = label;
  btn.addEventListener("click", () => {
    activeFilter = topic;
    renderFeed(currentDigest);
    renderTopicChips(currentDigest);
  });
  return btn;
}

function renderFeed(digest) {
  const feed = document.getElementById("feed");
  const emptyState = document.getElementById("emptyState");
  feed.querySelectorAll(".topic-section").forEach((el) => el.remove());

  const topicsToRender =
    activeFilter === "all" ? TOPIC_ORDER : [activeFilter];

  let renderedAny = false;

  for (const topic of topicsToRender) {
    const bytes = digest.topics[topic];
    if (!bytes || bytes.length === 0) continue;
    renderedAny = true;

    const section = document.createElement("section");
    section.className = "topic-section";

    const header = document.createElement("div");
    header.className = "topic-section-header";
    header.innerHTML = `<span class="topic-icon">${TOPIC_META[topic].icon}</span><span>${TOPIC_META[topic].label}</span>`;
    section.appendChild(header);

    const row = document.createElement("div");
    row.className = "card-row";

    for (const byte of bytes) {
      row.appendChild(makeCard(byte));
    }

    section.appendChild(row);
    feed.appendChild(section);
  }

  emptyState.hidden = renderedAny;
}

function makeCard(byte) {
  const card = document.createElement("article");
  card.className = "byte-card";
  card.innerHTML = `
    <div class="card-source">${byte.sourceName}</div>
    <h3>${byte.headline}</h3>
    <p>${byte.summary}</p>
  `;
  card.addEventListener("click", () => openDetail(byte));
  return card;
}

function openDetail(byte) {
  const overlay = document.getElementById("detailOverlay");
  const body = document.getElementById("detailBody");
  body.innerHTML = `
    <div class="card-source">${byte.sourceName} · ${formatRelativeTime(byte.publishedAt)}</div>
    <h2>${byte.headline}</h2>
    <p>${byte.summary}</p>
    <a class="read-more" href="${byte.sourceUrl}" target="_blank" rel="noopener noreferrer">Read full article →</a>
  `;
  overlay.hidden = false;
}

function closeDetail() {
  document.getElementById("detailOverlay").hidden = true;
}

function updateLastUpdatedLabel(digest) {
  document.getElementById("lastUpdated").textContent = digest
    ? `Updated ${formatRelativeTime(digest.generatedAt)}`
    : "No data yet";
}

function applyDigest(digest, { persist } = { persist: false }) {
  currentDigest = digest;
  renderTopicChips(digest);
  renderFeed(digest);
  updateLastUpdatedLabel(digest);
  if (persist) writeCache(digest);
}

async function loadFromNetwork() {
  try {
    const res = await fetch(DIGEST_ENDPOINT, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const digest = await res.json();

    if (!currentDigest || digest.generatedAt !== currentDigest.generatedAt) {
      applyDigest(digest, { persist: true });
    }
  } catch (err) {
    console.warn("Network fetch failed, staying on cached/sample digest.", err);
  }
}

function init() {
  const cached = readCache();
  applyDigest(cached ?? SAMPLE_DIGEST);

  loadFromNetwork();

  document.getElementById("refreshBtn").addEventListener("click", loadFromNetwork);
  document.getElementById("detailClose").addEventListener("click", closeDetail);
  document.getElementById("detailOverlay").addEventListener("click", (e) => {
    if (e.target.id === "detailOverlay") closeDetail();
  });
}

init();
