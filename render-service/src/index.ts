import Redis from "ioredis";
import { RenderCache } from "./cache";
import { PageRenderer } from "./renderer";
import { RenderQueue } from "./queue";
import { createRenderServer } from "./server";

const PORT = parseInt(process.env.PORT ?? "3001", 10);

function getRedisConnection(): { host: string; port: number } {
  const url = process.env.REDIS_URL;
  if (url) {
    const parsed = new URL(url);
    return { host: parsed.hostname, port: parseInt(parsed.port || "6379", 10) };
  }
  return {
    host: process.env.REDIS_HOST ?? "localhost",
    port: parseInt(process.env.REDIS_PORT ?? "6379", 10),
  };
}

async function main(): Promise<void> {
  const connection = getRedisConnection();
  const redis = new Redis(connection);
  const cache = new RenderCache(redis);

  const renderer = new PageRenderer();
  await renderer.init();

  const queue = new RenderQueue(connection);
  queue.startWorker(renderer, cache);

  const server = createRenderServer(cache, queue);
  server.listen(PORT, () => {
    console.log(`[render-service] listening on port ${PORT}`);
  });
}

main().catch((err) => {
  console.error("[render-service] fatal:", err);
  process.exit(1);
});
