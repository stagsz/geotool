import Redis from "ioredis";
import { RenderCache } from "./cache";
import { PageRenderer } from "./renderer";
import { RenderQueue } from "./queue";
import { createRenderServer } from "./server";
import { EventStore, type IEventStore } from "./event-store";
import { ClickHouseSink } from "./clickhouse-sink";
import { CompositeEventStore } from "./composite-event-store";

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

function buildEventStore(redis: Redis): IEventStore {
  const base = new EventStore(redis);
  const chUrl = process.env.CLICKHOUSE_URL;
  const chDb = process.env.CLICKHOUSE_DATABASE;
  if (chUrl && chDb) {
    const sink = new ClickHouseSink({
      url: chUrl,
      database: chDb,
      username: process.env.CLICKHOUSE_USER ?? "default",
      password: process.env.CLICKHOUSE_PASSWORD ?? "",
    });
    process.on("SIGTERM", () => {
      sink.close().then(() => process.exit(0)).catch(() => process.exit(1));
    });
    return new CompositeEventStore(base, sink);
  }
  return base;
}

async function main(): Promise<void> {
  const connection = getRedisConnection();
  const redis = new Redis(connection);
  const cache = new RenderCache(redis);

  const renderer = new PageRenderer();
  await renderer.init();

  const queue = new RenderQueue(connection);
  queue.startWorker(renderer, cache);

  const eventStore = buildEventStore(redis);
  const server = createRenderServer(cache, queue, fetch, eventStore, {
    statsApiKey: process.env.STATS_API_KEY,
    eventsApiKey: process.env.EVENTS_API_KEY,
  });
  server.listen(PORT, () => {
    console.log(`[render-service] listening on port ${PORT}`);
  });
}

main().catch((err) => {
  console.error("[render-service] fatal:", err);
  process.exit(1);
});
