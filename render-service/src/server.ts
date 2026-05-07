import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { RenderCache } from "./cache";
import type { RenderQueue } from "./queue";
import type { IEventStore } from "./event-store";

const MAX_EVENTS_BODY = 1_048_576;

export interface ServerOptions {
  statsApiKey?: string;
  eventsApiKey?: string;
  statsRateLimit?: {
    maxRequests: number;
    windowMs: number;
  };
}

class RateLimiter {
  private readonly hits = new Map<string, number[]>();

  isAllowed(key: string, maxRequests: number, windowMs: number): boolean {
    const now = Date.now();
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= maxRequests) return false;
    recent.push(now);
    this.hits.set(key, recent);
    return true;
  }
}

interface StoredEvent {
  botId?: string | null;
  botName?: string | null;
  url?: string;
  pageType?: string;
  timestamp?: string;
  responseStatus?: number;
}

interface StatsResponse {
  total: number;
  since: string;
  byBot: Record<string, number>;
  byPageType: Record<string, number>;
  byBotAndPageType: Record<string, Record<string, number>>;
  byHour: Array<{ hour: number; count: number }>;
  byStatus: Record<string, number>;
  topPages: Array<{ url: string; count: number }>;
  byDay: Array<{ date: string; count: number }>;
}

function computeStats(
  raw: unknown[],
  days: number,
  hostname?: string
): StatsResponse {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  let events = (raw as StoredEvent[]).filter(
    (e) => typeof e.timestamp === "string" && e.timestamp >= since
  );
  if (hostname) {
    events = events.filter((e) => {
      try {
        return new URL(e.url ?? "").hostname === hostname;
      } catch {
        return false;
      }
    });
  }

  const byBot: Record<string, number> = {};
  const byPageType: Record<string, number> = {};
  const byBotAndPageType: Record<string, Record<string, number>> = {};
  const hourCount: Record<number, number> = {};
  const byStatus: Record<string, number> = {};
  const pageCount: Record<string, number> = {};
  const dayCount: Record<string, number> = {};

  for (const e of events) {
    const bot = e.botId ?? "unknown";
    byBot[bot] = (byBot[bot] ?? 0) + 1;

    const pt = e.pageType ?? "unknown";
    byPageType[pt] = (byPageType[pt] ?? 0) + 1;

    if (!byBotAndPageType[bot]) byBotAndPageType[bot] = {};
    byBotAndPageType[bot][pt] = (byBotAndPageType[bot][pt] ?? 0) + 1;

    if (e.timestamp) {
      const hour = new Date(e.timestamp).getUTCHours();
      hourCount[hour] = (hourCount[hour] ?? 0) + 1;
    }

    const status = String(e.responseStatus ?? 0);
    byStatus[status] = (byStatus[status] ?? 0) + 1;

    if (e.url) pageCount[e.url] = (pageCount[e.url] ?? 0) + 1;
    const day = (e.timestamp ?? "").slice(0, 10);
    if (day) dayCount[day] = (dayCount[day] ?? 0) + 1;
  }

  return {
    total: events.length,
    since,
    byBot,
    byPageType,
    byBotAndPageType,
    byHour: Array.from({ length: 24 }, (_, h) => ({ hour: h, count: hourCount[h] ?? 0 })),
    byStatus,
    topPages: Object.entries(pageCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([url, count]) => ({ url, count })),
    byDay: Object.entries(dayCount)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count })),
  };
}

async function checkEtagStale(
  url: string,
  cache: RenderCache,
  fetcher: typeof fetch
): Promise<boolean> {
  const storedEtag = await cache.getEtag(url);
  if (!storedEtag) return false;
  try {
    const res = await fetcher(url, { method: "HEAD", signal: AbortSignal.timeout(2000) });
    const currentEtag = res.headers.get("etag");
    if (!currentEtag) return false;
    return currentEtag !== storedEtag;
  } catch {
    return false;
  }
}

export function createRenderServer(
  cache: RenderCache,
  queue: RenderQueue,
  fetcher: typeof fetch = fetch,
  eventStore?: IEventStore,
  options: ServerOptions = {}
): ReturnType<typeof createServer> {
  const rateLimiter = new RateLimiter();
  const rateLimit = options.statsRateLimit ?? { maxRequests: 60, windowMs: 60_000 };

  return createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const parsed = new URL(req.url ?? "/", "http://localhost");

    if (parsed.pathname === "/health") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ status: "ok" }));
      return;
    }

    if (parsed.pathname === "/render") {
      const url = parsed.searchParams.get("url");
      if (!url) {
        res.writeHead(400);
        res.end("Missing url parameter");
        return;
      }

      const cached = await cache.get(url);
      if (cached !== null) {
        const stale = await checkEtagStale(url, cache, fetcher);
        if (stale) {
          await cache.invalidate(url);
          await queue.add(url);
          res.writeHead(202);
          res.end("Accepted");
          return;
        }
        res.writeHead(200, { "content-type": "text/html" });
        res.end(cached);
        return;
      }

      await queue.add(url);
      res.writeHead(202);
      res.end("Accepted");
      return;
    }

    if (parsed.pathname === "/stats" && req.method === "OPTIONS") {
      res.writeHead(204, {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET, OPTIONS",
        "access-control-allow-headers": "authorization, x-api-key",
      });
      res.end();
      return;
    }

    if (parsed.pathname === "/stats" && req.method === "GET") {
      if (options.statsApiKey) {
        const auth = req.headers["authorization"] ?? "";
        const apiKeyHeader = req.headers["x-api-key"] ?? "";
        const bearerToken = auth.startsWith("Bearer ") ? auth.slice(7) : "";
        if (bearerToken !== options.statsApiKey && apiKeyHeader !== options.statsApiKey) {
          res.writeHead(401, { "content-type": "application/json", "access-control-allow-origin": "*" });
          res.end(JSON.stringify({ error: "Unauthorized" }));
          return;
        }
      }

      const clientIp =
        (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0].trim() ??
        req.socket.remoteAddress ??
        "unknown";
      if (!rateLimiter.isAllowed(clientIp, rateLimit.maxRequests, rateLimit.windowMs)) {
        res.writeHead(429, { "content-type": "application/json", "access-control-allow-origin": "*" });
        res.end(JSON.stringify({ error: "Too Many Requests" }));
        return;
      }

      if (!eventStore) {
        res.writeHead(503, { "content-type": "application/json", "access-control-allow-origin": "*" });
        res.end(JSON.stringify({ error: "Event store not available" }));
        return;
      }
      const days = Math.max(1, parseInt(parsed.searchParams.get("days") ?? "30", 10));
      const hostname = parsed.searchParams.get("hostname") ?? undefined;
      const events = await eventStore.list(10_000);
      const stats = computeStats(events, days, hostname);
      res.writeHead(200, { "content-type": "application/json", "access-control-allow-origin": "*" });
      res.end(JSON.stringify(stats));
      return;
    }

    if (parsed.pathname === "/events" && req.method === "POST") {
      if (options.eventsApiKey) {
        const auth = req.headers["authorization"] ?? "";
        const bearerToken = auth.startsWith("Bearer ") ? auth.slice(7) : "";
        if (bearerToken !== options.eventsApiKey) {
          res.writeHead(401, { "content-type": "application/json" });
          res.end(JSON.stringify({ error: "Unauthorized" }));
          return;
        }
      }

      const body = await new Promise<string | null>((resolve, reject) => {
        const chunks: Buffer[] = [];
        let totalBytes = 0;
        req.on("data", (c: Buffer) => {
          totalBytes += c.length;
          if (totalBytes > MAX_EVENTS_BODY) {
            resolve(null);
            return;
          }
          chunks.push(c);
        });
        req.on("end", () => resolve(Buffer.concat(chunks).toString()));
        req.on("error", reject);
      });

      if (body === null) {
        res.writeHead(413, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "Payload Too Large" }));
        return;
      }

      try {
        const events = JSON.parse(body);
        if (Array.isArray(events) && eventStore) {
          await eventStore.push(events);
        }
        res.writeHead(204);
        res.end();
      } catch {
        res.writeHead(400);
        res.end("Invalid JSON");
      }
      return;
    }

    if (parsed.pathname === "/hostnames" && req.method === "OPTIONS") {
      res.writeHead(204, {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET, OPTIONS",
        "access-control-allow-headers": "authorization, x-api-key",
      });
      res.end();
      return;
    }

    if (parsed.pathname === "/hostnames" && req.method === "GET") {
      if (options.statsApiKey) {
        const auth = req.headers["authorization"] ?? "";
        const apiKeyHeader = req.headers["x-api-key"] ?? "";
        const bearerToken = auth.startsWith("Bearer ") ? auth.slice(7) : "";
        if (bearerToken !== options.statsApiKey && apiKeyHeader !== options.statsApiKey) {
          res.writeHead(401, { "content-type": "application/json", "access-control-allow-origin": "*" });
          res.end(JSON.stringify({ error: "Unauthorized" }));
          return;
        }
      }
      if (!eventStore) {
        res.writeHead(503, { "content-type": "application/json", "access-control-allow-origin": "*" });
        res.end(JSON.stringify({ error: "Event store not available" }));
        return;
      }
      const allEvents = await eventStore.list(10_000);
      const hostnames = [...new Set(
        (allEvents as StoredEvent[]).flatMap((e) => {
          try { return [new URL(e.url ?? "").hostname]; } catch { return []; }
        })
      )].sort();
      res.writeHead(200, { "content-type": "application/json", "access-control-allow-origin": "*" });
      res.end(JSON.stringify({ hostnames }));
      return;
    }

    if (parsed.pathname === "/stats/page" && req.method === "OPTIONS") {
      res.writeHead(204, {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET, OPTIONS",
        "access-control-allow-headers": "authorization, x-api-key",
      });
      res.end();
      return;
    }

    if (parsed.pathname === "/stats/page" && req.method === "GET") {
      if (options.statsApiKey) {
        const auth = req.headers["authorization"] ?? "";
        const apiKeyHeader = req.headers["x-api-key"] ?? "";
        const bearerToken = auth.startsWith("Bearer ") ? auth.slice(7) : "";
        if (bearerToken !== options.statsApiKey && apiKeyHeader !== options.statsApiKey) {
          res.writeHead(401, { "content-type": "application/json", "access-control-allow-origin": "*" });
          res.end(JSON.stringify({ error: "Unauthorized" }));
          return;
        }
      }
      if (!eventStore) {
        res.writeHead(503, { "content-type": "application/json", "access-control-allow-origin": "*" });
        res.end(JSON.stringify({ error: "Event store not available" }));
        return;
      }
      const pageUrl = parsed.searchParams.get("url");
      if (!pageUrl) {
        res.writeHead(400, { "content-type": "application/json", "access-control-allow-origin": "*" });
        res.end(JSON.stringify({ error: "Missing url parameter" }));
        return;
      }
      const pageDays = Math.max(1, parseInt(parsed.searchParams.get("days") ?? "30", 10));
      const pageSince = new Date(Date.now() - pageDays * 24 * 60 * 60 * 1000).toISOString();
      const rawPage = (await eventStore.list(10_000)) as StoredEvent[];
      const filtered = rawPage.filter(
        (e) => e.url === pageUrl && typeof e.timestamp === "string" && e.timestamp >= pageSince
      );
      const pdByBot: Record<string, number> = {};
      const pdByStatus: Record<string, number> = {};
      const pdHourCount: Record<number, number> = {};
      const pdDayCount: Record<string, number> = {};
      for (const e of filtered) {
        const bot = e.botId ?? "unknown";
        pdByBot[bot] = (pdByBot[bot] ?? 0) + 1;
        const status = String(e.responseStatus ?? 0);
        pdByStatus[status] = (pdByStatus[status] ?? 0) + 1;
        if (e.timestamp) {
          const hour = new Date(e.timestamp).getUTCHours();
          pdHourCount[hour] = (pdHourCount[hour] ?? 0) + 1;
          const day = e.timestamp.slice(0, 10);
          if (day) pdDayCount[day] = (pdDayCount[day] ?? 0) + 1;
        }
      }
      const detail = {
        url: pageUrl,
        total: filtered.length,
        byBot: pdByBot,
        byStatus: pdByStatus,
        byHour: Array.from({ length: 24 }, (_, h) => ({ hour: h, count: pdHourCount[h] ?? 0 })),
        byDay: Object.entries(pdDayCount)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, count]) => ({ date, count })),
      };
      res.writeHead(200, { "content-type": "application/json", "access-control-allow-origin": "*" });
      res.end(JSON.stringify(detail));
      return;
    }

    res.writeHead(404);
    res.end("Not found");
  });
}
