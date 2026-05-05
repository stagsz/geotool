import Redis from "ioredis";
import { RenderCache } from "./cache";
import { PageRenderer } from "./renderer";
import { RenderQueue } from "./queue";
import { createRenderServer } from "./server";

const REDIS_HOST = process.env.REDIS_HOST ?? "localhost";
const REDIS_PORT = parseInt(process.env.REDIS_PORT ?? "6379", 10);
const PORT = parseInt(process.env.PORT ?? "3001", 10);

async function main(): Promise<void> {
  const connection = { host: REDIS_HOST, port: REDIS_PORT };
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
