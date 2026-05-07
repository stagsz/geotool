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

function buildEventStore(redis: Redis): { store: IEventStore; sink: ClickHouseSink | null } {
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
    return { store: new CompositeEventStore(base, sink), sink };
  }
  return { store: base, sink: null };
}

async function main(): Promise<void> {
  const connection = getRedisConnection();
  const redis = new Redis(connection);
  const cache = new RenderCache(redis);

  const renderer = new PageRenderer();
  await renderer.init();

  const queue = new RenderQueue(connection);
  queue.startWorker(renderer, cache);

  const { store: eventStore, sink } = buildEventStore(redis);
  const server = createRenderServer(cache, queue, fetch, eventStore, {
    statsApiKey: process.env.STATS_API_KEY,
    eventsApiKey: process.env.EVENTS_API_KEY,
    clientApiKeys: process.env.CLIENT_API_KEYS
      ? JSON.parse(process.env.CLIENT_API_KEYS) as Record<string, string>
      : undefined,
  });
  server.listen(PORT, () => {
    console.log(`[render-service] listening on port ${PORT}`);
  });

  // Alerting
  let alertInterval: ReturnType<typeof setInterval> | undefined;
  const alertWebhookUrl = process.env.ALERT_WEBHOOK_URL;
  if (alertWebhookUrl) {
    const { AlertingEngine } = await import("./alerting");
    const engine = new AlertingEngine({
      webhookUrl: alertWebhookUrl,
      botHitsPerHourThreshold: process.env.ALERT_BOT_HITS_PER_HOUR
        ? parseInt(process.env.ALERT_BOT_HITS_PER_HOUR, 10)
        : undefined,
    });
    alertInterval = setInterval(async () => {
      engine.check(await eventStore.list(10_000)).catch(() => undefined);
    }, 5 * 60 * 1000);
  }

  process.on("SIGTERM", () => {
    if (alertInterval) clearInterval(alertInterval);
    if (sink) {
      sink.close().then(() => process.exit(0)).catch(() => process.exit(1));
    } else {
      process.exit(0);
    }
  });
}

main().catch((err) => {
  console.error("[render-service] fatal:", err);
  process.exit(1);
});
