# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

LLM Proxy Agency Platform — an edge-deployed middleware that intercepts AI crawler traffic, transforms web content for AI consumption, and tracks LLM citation performance. Built as an npm workspace monorepo.

## Packages

| Package | Runtime | Purpose |
|---------|---------|---------|
| `proxy-core` | Cloudflare Workers | Bot detection + content transformation at the edge |
| `render-service` | Node.js | JS pre-renderer (Puppeteer + BullMQ + Redis) |
| `data-layer` | Node.js | Analytics pipeline (events, ClickHouse, citation tracking) |
| `dashboard` | React/Node | Client-facing analytics UI (scaffold) |
| `evals` | Node.js | Evaluation suite |

## Commands

### Root (all workspaces)
```bash
npm test        # run all workspace tests
npm run lint    # tsc --noEmit across all workspaces
```

### Per-package
```bash
# From package directory or with --workspace flag
npm test                    # vitest run
npm run lint                # tsc --noEmit
npm run build               # tsc (render-service, data-layer only)

# proxy-core only
npm run dev                 # wrangler dev
npm run deploy              # wrangler deploy

# render-service only
npm start                   # node dist/index.js (requires prior build)
```

### Run a single test file
```bash
npx vitest run src/path/to/file.test.ts
```

## Architecture

### Request flow
```
Internet → Cloudflare Worker (proxy-core)
              ├─ BotDetectionEngine: UA parse → IP range check → confidence score
              │    Threshold: 70/100 to be "verified" (UA=30pts, IP=40pts)
              │    Honeypot: 10 trap paths → 200 OK response, logs hit
              ├─ If verified bot + cache hit → fetchRendered() from render-service
              ├─ If verified bot + cache miss → ContentTransformEngine → origin
              └─ If human → pass-through fetch(request)

render-service: HTTP server (:3001) + BullMQ worker (concurrency=4)
  /render?url= → checks Redis cache → queues Puppeteer job → returns HTML
  Cache key: SHA256(normalised URL), TTL: 4h (14400s)
  Env: REDIS_HOST, REDIS_PORT, PORT, CHROME_PATH (required in prod)

data-layer: consumed by proxy-core or external services
  EventPublisher → buffers BotHitEvents → flushes at 1000 events OR 100ms
  ClickHouseWriter → batch inserts via injected ClickHouseClient interface
  CitationTracker → tracks citations per clientId, computes rate
  AnomalyDetector → detectIpRangeChange (>10% threshold), detectCitationDrop (≥20%)
```

### Key type relationships
`BotEvent` (proxy-core `src/index.ts`) and `BotHitEvent` (data-layer `src/events.ts`) are structurally identical — no conversion needed when wiring them together.

`publishBotEvent` in proxy-core accepts an optional `sink` parameter; falls back to `console.log` when omitted.

### Cloudflare Workers specifics
- `KVNamespace` is a global type from `@cloudflare/workers-types` — do not import it
- `Env` interface in `proxy-core/src/index.ts` declares `BOT_REGISTRY: KVNamespace`, `RENDER_CACHE: KVNamespace`, `RENDER_SERVICE_URL: string`
- Unit tests run with vitest (no Workers runtime needed — all logic is pure functions)

## Testing Notes

- Use `vi.hoisted()` when a mock factory needs to reference a variable declared outside it — `vi.mock` factories are hoisted above `const` declarations
- Floating-point boundary tests: avoid `(0.5 - 0.4) / 0.5`; use integer arithmetic like `(5-4)/5` for exact IEEE 754 results
- HTTP server tests: `server.listen(0)` to bind a random port, then `server.address().port`
- `puppeteer-core` does not auto-download Chrome; production deployments require `CHROME_PATH` env var
