import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRenderServer } from "../server";
import type { RenderCache } from "../cache";
import type { RenderQueue } from "../queue";
import type { ServerOptions } from "../server";

const makeCache = () => ({
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue(undefined),
  getEtag: vi.fn().mockResolvedValue(null),
  setEtag: vi.fn().mockResolvedValue(undefined),
  invalidate: vi.fn().mockResolvedValue(undefined),
});

const makeFetcher = (etag: string | null, throws = false): typeof fetch =>
  vi.fn().mockImplementation(() => {
    if (throws) return Promise.reject(new Error("network error"));
    return Promise.resolve({
      headers: { get: (h: string) => (h === "etag" ? etag : null) },
    } as unknown as Response);
  }) as unknown as typeof fetch;

describe("createRenderServer", () => {
  let cache: ReturnType<typeof makeCache>;
  let queue: { add: ReturnType<typeof vi.fn> };
  let server: ReturnType<typeof createRenderServer>;
  let port: number;

  const makeEventStore = (events: unknown[] = []) => ({
    push: vi.fn().mockResolvedValue(undefined),
    list: vi.fn().mockResolvedValue(events),
  });

  const startServer = async (fetcher?: typeof fetch, eventStore?: { push: ReturnType<typeof vi.fn>; list?: ReturnType<typeof vi.fn> }, options?: ServerOptions) => {
    server = createRenderServer(
      cache as unknown as RenderCache,
      queue as unknown as RenderQueue,
      fetcher,
      eventStore as never,
      options
    );
    port = await new Promise<number>((resolve) => {
      server.listen(0, () => resolve((server.address() as { port: number }).port));
    });
  };

  beforeEach(() => {
    cache = makeCache();
    queue = { add: vi.fn().mockResolvedValue(undefined) };
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("GET /health returns 200 with {status:ok}", async () => {
    await startServer();
    const res = await fetch(`http://localhost:${port}/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });

  it("GET /render without url returns 400", async () => {
    await startServer();
    const res = await fetch(`http://localhost:${port}/render`);
    expect(res.status).toBe(400);
  });

  it("GET /render?url=... returns 202 and calls queue.add on cache miss", async () => {
    await startServer();
    cache.get.mockResolvedValue(null);
    const res = await fetch(`http://localhost:${port}/render?url=https://example.com`);
    expect(res.status).toBe(202);
    expect(queue.add).toHaveBeenCalledWith("https://example.com");
  });

  describe("cache hit", () => {
    beforeEach(() => {
      cache.get.mockResolvedValue("<html>cached</html>");
    });

    it("returns 200 with cached HTML when no ETag stored", async () => {
      cache.getEtag.mockResolvedValue(null);
      await startServer(makeFetcher(null));
      const res = await fetch(`http://localhost:${port}/render?url=https://example.com`);
      expect(res.status).toBe(200);
      expect(await res.text()).toBe("<html>cached</html>");
    });

    it("returns 200 when stored ETag matches origin", async () => {
      cache.getEtag.mockResolvedValue('"v1"');
      await startServer(makeFetcher('"v1"'));
      const res = await fetch(`http://localhost:${port}/render?url=https://example.com`);
      expect(res.status).toBe(200);
      expect(await res.text()).toBe("<html>cached</html>");
      expect(cache.invalidate).not.toHaveBeenCalled();
    });

    it("returns 202 and invalidates cache when ETag has changed", async () => {
      cache.getEtag.mockResolvedValue('"v1"');
      await startServer(makeFetcher('"v2"'));
      const res = await fetch(`http://localhost:${port}/render?url=https://example.com`);
      expect(res.status).toBe(202);
      expect(cache.invalidate).toHaveBeenCalledWith("https://example.com");
      expect(queue.add).toHaveBeenCalledWith("https://example.com");
    });

    it("returns 200 with cached HTML when HEAD request fails", async () => {
      cache.getEtag.mockResolvedValue('"v1"');
      await startServer(makeFetcher(null, true));
      const res = await fetch(`http://localhost:${port}/render?url=https://example.com`);
      expect(res.status).toBe(200);
      expect(await res.text()).toBe("<html>cached</html>");
      expect(cache.invalidate).not.toHaveBeenCalled();
    });

    it("returns 200 when origin HEAD returns no ETag", async () => {
      cache.getEtag.mockResolvedValue('"v1"');
      await startServer(makeFetcher(null));
      const res = await fetch(`http://localhost:${port}/render?url=https://example.com`);
      expect(res.status).toBe(200);
      expect(await res.text()).toBe("<html>cached</html>");
    });
  });

  describe("GET /stats — CORS", () => {
    it("OPTIONS /stats returns 204 with CORS headers", async () => {
      await startServer(undefined, makeEventStore());
      const res = await fetch(`http://localhost:${port}/stats`, { method: "OPTIONS" });
      expect(res.status).toBe(204);
      expect(res.headers.get("access-control-allow-origin")).toBe("*");
      expect(res.headers.get("access-control-allow-methods")).toContain("GET");
    });

    it("GET /stats includes Access-Control-Allow-Origin: * header", async () => {
      await startServer(undefined, makeEventStore());
      const res = await fetch(`http://localhost:${port}/stats`);
      expect(res.status).toBe(200);
      expect(res.headers.get("access-control-allow-origin")).toBe("*");
    });
  });

  describe("GET /stats", () => {
    const sampleEvents = [
      { botId: "gptbot", botName: "GPTBot", url: "https://example.com/products/a", pageType: "product", timestamp: new Date().toISOString() },
      { botId: "gptbot", botName: "GPTBot", url: "https://example.com/products/b", pageType: "product", timestamp: new Date().toISOString() },
      { botId: "claudebot", botName: "ClaudeBot", url: "https://other.com/about", pageType: "about", timestamp: new Date().toISOString() },
    ];

    it("returns 200 with aggregated stats", async () => {
      await startServer(undefined, makeEventStore(sampleEvents));
      const res = await fetch(`http://localhost:${port}/stats`);
      expect(res.status).toBe(200);
      const body = await res.json() as { total: number; byBot: Record<string, number> };
      expect(body.total).toBe(3);
      expect(body.byBot["gptbot"]).toBe(2);
      expect(body.byBot["claudebot"]).toBe(1);
    });

    it("filters by hostname", async () => {
      await startServer(undefined, makeEventStore(sampleEvents));
      const res = await fetch(`http://localhost:${port}/stats?hostname=example.com`);
      const body = await res.json() as { total: number };
      expect(body.total).toBe(2);
    });

    it("returns 503 when no event store is configured", async () => {
      await startServer();
      const res = await fetch(`http://localhost:${port}/stats`);
      expect(res.status).toBe(503);
    });

    it("returns empty stats when no events match the time window", async () => {
      const oldEvent = { botId: "gptbot", url: "https://example.com/", pageType: "landing", timestamp: "2020-01-01T00:00:00Z" };
      await startServer(undefined, makeEventStore([oldEvent]));
      const res = await fetch(`http://localhost:${port}/stats?days=7`);
      const body = await res.json() as { total: number };
      expect(body.total).toBe(0);
    });
  });

  describe("GET /stats — authentication", () => {
    const KEY = "secret-key-abc";

    it("returns 401 when API key required but Authorization header is missing", async () => {
      await startServer(undefined, makeEventStore(), { statsApiKey: KEY });
      const res = await fetch(`http://localhost:${port}/stats`);
      expect(res.status).toBe(401);
    });

    it("returns 401 when wrong Bearer token is provided", async () => {
      await startServer(undefined, makeEventStore(), { statsApiKey: KEY });
      const res = await fetch(`http://localhost:${port}/stats`, {
        headers: { authorization: "Bearer wrong-key" },
      });
      expect(res.status).toBe(401);
    });

    it("returns 200 with correct Bearer token", async () => {
      await startServer(undefined, makeEventStore(), { statsApiKey: KEY });
      const res = await fetch(`http://localhost:${port}/stats`, {
        headers: { authorization: `Bearer ${KEY}` },
      });
      expect(res.status).toBe(200);
    });

    it("returns 200 with correct X-Api-Key header", async () => {
      await startServer(undefined, makeEventStore(), { statsApiKey: KEY });
      const res = await fetch(`http://localhost:${port}/stats`, {
        headers: { "x-api-key": KEY },
      });
      expect(res.status).toBe(200);
    });

    it("does not require auth when statsApiKey is not configured", async () => {
      await startServer(undefined, makeEventStore());
      const res = await fetch(`http://localhost:${port}/stats`);
      expect(res.status).toBe(200);
    });
  });

  describe("GET /stats — per-client key isolation", () => {
    const ADMIN_KEY = "admin-key";
    const CLIENT_KEY = "client-key-example";
    const clientApiKeys = { "example.com": CLIENT_KEY };

    const mixedEvents = [
      { botId: "gptbot", url: "https://example.com/page", pageType: "product", timestamp: new Date().toISOString() },
      { botId: "claudebot", url: "https://example.com/about", pageType: "about", timestamp: new Date().toISOString() },
      { botId: "gptbot", url: "https://other.com/home", pageType: "landing", timestamp: new Date().toISOString() },
    ];

    it("per-client key returns only events for that hostname", async () => {
      await startServer(undefined, makeEventStore(mixedEvents), {
        statsApiKey: ADMIN_KEY,
        clientApiKeys,
      });
      const res = await fetch(`http://localhost:${port}/stats`, {
        headers: { authorization: `Bearer ${CLIENT_KEY}` },
      });
      expect(res.status).toBe(200);
      const body = await res.json() as { total: number };
      expect(body.total).toBe(2);
    });

    it("global STATS_API_KEY returns all events", async () => {
      await startServer(undefined, makeEventStore(mixedEvents), {
        statsApiKey: ADMIN_KEY,
        clientApiKeys,
      });
      const res = await fetch(`http://localhost:${port}/stats`, {
        headers: { authorization: `Bearer ${ADMIN_KEY}` },
      });
      expect(res.status).toBe(200);
      const body = await res.json() as { total: number };
      expect(body.total).toBe(3);
    });

    it("wrong token returns 401", async () => {
      await startServer(undefined, makeEventStore(mixedEvents), {
        statsApiKey: ADMIN_KEY,
        clientApiKeys,
      });
      const res = await fetch(`http://localhost:${port}/stats`, {
        headers: { authorization: "Bearer wrong-token" },
      });
      expect(res.status).toBe(401);
    });

    it("per-client key + /stats/page for URL on different hostname returns 403", async () => {
      await startServer(undefined, makeEventStore(mixedEvents), {
        statsApiKey: ADMIN_KEY,
        clientApiKeys,
      });
      const res = await fetch(
        `http://localhost:${port}/stats/page?url=${encodeURIComponent("https://other.com/home")}`,
        { headers: { authorization: `Bearer ${CLIENT_KEY}` } }
      );
      expect(res.status).toBe(403);
    });
  });

  describe("GET /stats — rate limiting", () => {
    it("returns 429 after exceeding the request limit", async () => {
      await startServer(
        undefined,
        makeEventStore(),
        { statsRateLimit: { maxRequests: 2, windowMs: 10_000 } }
      );
      const r1 = await fetch(`http://localhost:${port}/stats`);
      const r2 = await fetch(`http://localhost:${port}/stats`);
      const r3 = await fetch(`http://localhost:${port}/stats`);
      expect(r1.status).toBe(200);
      expect(r2.status).toBe(200);
      expect(r3.status).toBe(429);
    });

    it("rate limiter does not affect other endpoints", async () => {
      await startServer(
        undefined,
        undefined,
        { statsRateLimit: { maxRequests: 1, windowMs: 10_000 } }
      );
      const h1 = await fetch(`http://localhost:${port}/health`);
      const h2 = await fetch(`http://localhost:${port}/health`);
      expect(h1.status).toBe(200);
      expect(h2.status).toBe(200);
    });
  });

  describe("POST /events", () => {
    it("returns 204 and calls eventStore.push with parsed events", async () => {
      const eventStore = { push: vi.fn().mockResolvedValue(undefined) };
      await startServer(undefined, eventStore);
      const events = [{ botId: "gptbot", url: "https://example.com" }];
      const res = await fetch(`http://localhost:${port}/events`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(events),
      });
      expect(res.status).toBe(204);
      expect(eventStore.push).toHaveBeenCalledWith(events);
    });

    it("returns 204 without error when no eventStore is provided", async () => {
      await startServer();
      const res = await fetch(`http://localhost:${port}/events`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify([{ botId: "gptbot" }]),
      });
      expect(res.status).toBe(204);
    });

    it("returns 400 for invalid JSON", async () => {
      await startServer();
      const res = await fetch(`http://localhost:${port}/events`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "not-json",
      });
      expect(res.status).toBe(400);
    });
  });

  describe("POST /events — authentication", () => {
    const KEY = "events-secret-key";

    it("returns 401 when eventsApiKey is set and Authorization header is missing", async () => {
      await startServer(undefined, undefined, { eventsApiKey: KEY });
      const res = await fetch(`http://localhost:${port}/events`, {
        method: "POST",
        body: JSON.stringify([]),
      });
      expect(res.status).toBe(401);
    });

    it("returns 401 when wrong Bearer token is provided", async () => {
      await startServer(undefined, undefined, { eventsApiKey: KEY });
      const res = await fetch(`http://localhost:${port}/events`, {
        method: "POST",
        headers: { authorization: "Bearer wrong-key" },
        body: JSON.stringify([]),
      });
      expect(res.status).toBe(401);
    });

    it("returns 204 when correct Bearer token is provided", async () => {
      await startServer(undefined, undefined, { eventsApiKey: KEY });
      const res = await fetch(`http://localhost:${port}/events`, {
        method: "POST",
        headers: { authorization: `Bearer ${KEY}` },
        body: JSON.stringify([]),
      });
      expect(res.status).toBe(204);
    });

    it("returns 204 without auth when eventsApiKey is not configured", async () => {
      await startServer();
      const res = await fetch(`http://localhost:${port}/events`, {
        method: "POST",
        body: JSON.stringify([]),
      });
      expect(res.status).toBe(204);
    });
  });

  describe("POST /events — body size cap", () => {
    it("returns 413 when body exceeds 1 MB", async () => {
      await startServer();
      const oversized = Buffer.alloc(1_048_577, "x");
      const res = await fetch(`http://localhost:${port}/events`, {
        method: "POST",
        body: oversized,
      });
      expect(res.status).toBe(413);
    });

    it("returns 400 for a body exactly at 1 MB (invalid JSON, not over limit)", async () => {
      await startServer();
      const atLimit = Buffer.alloc(1_048_576, "x");
      const res = await fetch(`http://localhost:${port}/events`, {
        method: "POST",
        body: atLimit,
      });
      expect(res.status).toBe(400);
    });
  });
});
