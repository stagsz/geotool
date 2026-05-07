import Redis from "ioredis";
import { RenderCache } from "./cache";
import { PageRenderer } from "./renderer";
import { RenderQueue } from "./queue";
import { createRenderServer } from "./server";
import { EventStore } from "./event-store";

const PORT = parseInt(process.env.PORT ?? "3001", 10);

interface RedisConnection {
  host: string;
  port: number;
  password?: string;
}

function getRedisConnection(): RedisConnection {
  const url = process.env.REDIS_URL;
  if (url) {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: parseInt(parsed.port || "6379", 10),
      ...(parsed.password ? { password: decodeURIComponent(parsed.password) } : {}),
    };
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

  const eventStore = new EventStore(redis);
  const server = createRenderServer(cache, queue, fetch, eventStore);
  server.listen(PORT, () => {
    console.log(`[render-service] listening on port ${PORT}`);
  });
}

main().catch((err) => {
  console.error("[render-service] fatal:", err);
  process.exit(1);
});
