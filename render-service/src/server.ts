import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { RenderCache } from "./cache";
import type { RenderQueue } from "./queue";

export function createRenderServer(
  cache: RenderCache,
  queue: RenderQueue
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
        res.writeHead(200, { "content-type": "text/html" });
        res.end(cached);
        return;
      }

      await queue.add(url);
      res.writeHead(202);
      res.end("Accepted");
      return;
    }

    res.writeHead(404);
    res.end("Not found");
  });
}
