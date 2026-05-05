# LLM Proxy Agency Platform

Edge-deployed middleware that intercepts AI crawler traffic, transforms web content for optimal AI consumption, and tracks LLM citation performance across major platforms (GPTBot, ClaudeBot, PerplexityBot, Google-Extended, CCBot).

## How It Works

```
AI Crawler → Cloudflare Worker
               ├─ Identify bot (UA + IP range, confidence ≥70/100)
               ├─ Honeypot check (10 trap paths → log + 200 OK)
               ├─ Cache hit → return pre-rendered HTML immediately
               └─ Cache miss → fetch origin → inject schema + Q&A markup → return
                                    ↓
                             Queue Puppeteer render for next request
```

Human visitors are passed through with zero modification.

## Packages

| Package | Description |
|---------|-------------|
| `proxy-core` | Cloudflare Worker — bot detection and content transformation at the edge |
| `render-service` | Node.js service — JavaScript pre-rendering via Puppeteer + BullMQ + Redis |
| `data-layer` | Analytics pipeline — event batching, ClickHouse writes, citation tracking, anomaly detection |
| `dashboard` | React client dashboard — real-time crawler feed and citation analytics |
| `evals` | Evaluation suite — binary pass/fail criteria across all platform phases |

## Getting Started

### Prerequisites

- Node.js 20+
- Redis running locally (render-service uses it for job queue and cache)
- Cloudflare account with Workers enabled (deployment only — not needed for local dev)
- Chrome/Chromium binary (render-service production only)

### Install

```bash
npm install
```

### Local development

Three services need to run together. Start them in order:

**1. Redis** (required by render-service)
```bash
redis-server
```

**2. render-service** — JS pre-renderer on port 3001
```bash
cd render-service
npm run build
npm start
```

**3. proxy-core** — Cloudflare Worker dev server
```bash
cd proxy-core
npm run dev
```

The Worker starts on `http://localhost:8787` and proxies to `https://baraband.se` by default (configured in `wrangler.toml`). To point it at a different origin:

```bash
npx wrangler dev --var UPSTREAM_URL:https://other-origin.se
```

> Note: `--upstream` is not a valid wrangler flag — use `--var UPSTREAM_URL:...` instead.

### Tests and type-checking

```bash
# All workspaces
npm test
npm run lint

# Single package (run from the package directory)
npm test
npm run lint

# Single test file
npx vitest run src/path/to/file.test.ts
```

### Environment variables

**render-service:**
| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_HOST` | `localhost` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |
| `PORT` | `3001` | HTTP server port |
| `CHROME_PATH` | — | Path to Chrome binary (required in production) |

**proxy-core (`wrangler.toml` `[vars]`):**
| Variable | Default | Description |
|----------|---------|-------------|
| `RENDER_SERVICE_URL` | `http://localhost:3001` | URL of the render-service instance |
| `UPSTREAM_URL` | `https://baraband.se` | Origin to proxy human traffic to |

KV namespace bindings (`BOT_REGISTRY`, `RENDER_CACHE`) use placeholder IDs locally — replace with real IDs before deploying.

## Architecture

### Bot Detection

Multi-factor confidence scoring (0–100 scale):
- **User-Agent match** (+30 points) — validated against known bot profiles
- **IP range verification** (+40 points) — checked against live registry data (auto-updated every 6 hours)
- **Verified threshold:** ≥70 points

### Content Transformation

Applied to verified bots on cache miss:
1. HTML parsed into a content tree
2. Page type classified (Blog, Product, Service, FAQ, etc.)
3. Schema.org markup injected (Article / Product / FAQ / Organization)
4. Question-pattern headings atomized into Q&A pairs
5. Entities extracted and tagged

Response headers carry `x-llm-proxy-page-type`, `x-llm-proxy-entities`, `x-llm-proxy-cache`.

### Pre-Rendering

- BullMQ job queue with concurrency of 4 Puppeteer workers
- 15-second render timeout, waits for `domcontentloaded`
- Cache key: SHA256 of normalised URL, TTL: 4 hours
- `GET /render?url=<url>` — returns cached or freshly rendered HTML
- `GET /health` — readiness check

### Data Pipeline

- `EventPublisher` — buffers events and flushes at 1,000 events or 100ms (whichever comes first)
- `ClickHouseWriter` — batch inserts via an injectable `ClickHouseClient` interface
- `CitationTracker` — records citation events per client, computes citation rate
- `AnomalyDetector` — flags IP range changes >10% and citation rate drops ≥20%

## Deployment

```bash
# Deploy Cloudflare Worker
cd proxy-core && npm run deploy

# render-service — build and run on a VPS
cd render-service && npm run build && CHROME_PATH=/usr/bin/chromium npm start
```

## Performance Targets

| Metric | Target |
|--------|--------|
| Edge latency (cached) | p95 < 150ms |
| Cache hit rate | > 85% after 24h warm-up |
| Bot detection accuracy | ≥ 97% |
| Event publication latency | < 5ms (non-blocking) |
| Uptime SLA | 99.9% |


## Local Testing

### Populate KV with real IP ranges

In local dev, the Worker extracts the request IP from `cf-connecting-ip` or `x-forwarded-for`. Neither is set automatically by wrangler, so `127.0.0.1/32` placeholder ranges do not work — the IP resolves to an empty string and never matches. Use real published ranges instead.

```bash
cd proxy-core

# GPTBot (OpenAI) — from https://openai.com/gptbot-ranges.txt
npx wrangler kv key put --namespace-id=placeholder_bot_registry_preview --local "ip-ranges:gptbot" \
  '["132.196.86.0/24","172.182.202.0/25","172.182.204.0/24","172.182.207.0/25","172.182.214.0/24","172.182.215.0/24","20.125.66.80/28","20.171.206.0/24","20.171.207.0/24","4.227.36.0/25","52.230.152.0/24","74.7.175.128/25","74.7.227.0/25","74.7.227.128/25","74.7.228.0/25","74.7.230.0/25","74.7.241.0/25","74.7.241.128/25","74.7.242.0/25","74.7.243.128/25","74.7.244.0/25"]'
```

Replace `placeholder_bot_registry_preview` with the real `preview_id` from `wrangler.toml` once you have a Cloudflare account.

### Test bot detection and content transform

Spoof an IP that falls within the seeded CIDR range so the confidence score reaches the ≥70 threshold (UA match = 30 pts, IP match = 40 pts):

```bash
# Verified bot → content transform path (render-service down or cache miss)
curl.exe -s http://127.0.0.1:8787 \ -H "User-Agent: GPTBot/1.0" \ -H "x-forwarded-for: 74.7.175.130" \ -D - -o response.html

# Verify transform headers in the response
grep "x-llm-proxy" <<< "$(cat -)"
```

Expected response headers on a cache miss:
```
x-llm-proxy-processed: true
x-llm-proxy-page-type: <blog|product|service|faq|landing|unknown>
x-llm-proxy-entities: <count>
```

Expected on a render-service cache hit:
```
x-llm-proxy-cache: HIT
```

A request without the `x-forwarded-for` header scores 30/100 (UA only) and is treated as an unverified bot — it will pass through to the origin unmodified.