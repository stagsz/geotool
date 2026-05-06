import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { RenderCache } from "./cache";
import type { RenderQueue } from "./queue";
import type { EventStore } from "./event-store";

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
  eventStore?: EventStore
): ReturnType<typeof createServer> {
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

    if (parsed.pathname === "/events" && req.method === "POST") {
      const body = await new Promise<string>((resolve, reject) => {
        const chunks: Buffer[] = [];
        req.on("data", (c: Buffer) => chunks.push(c));
        req.on("end", () => resolve(Buffer.concat(chunks).toString()));
        req.on("error", reject);
      });
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

    res.writeHead(404);
    res.end("Not found");
  });
}
