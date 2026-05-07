const DEFAULT_FLUSH_INTERVAL_MS = 500;
const DEFAULT_MAX_BATCH_SIZE = 100;

export interface ClickHouseSinkConfig {
  url: string;
  database: string;
  username: string;
  password: string;
  flushIntervalMs?: number;
  maxBatchSize?: number;
}

type HttpResponse = { ok: boolean; status: number; text(): Promise<string> };
type HttpFetch = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal }
) => Promise<HttpResponse>;

export class ClickHouseSink {
  private readonly buffer: unknown[] = [];
  private timer: NodeJS.Timeout | null = null;
  private readonly flushIntervalMs: number;
  private readonly maxBatchSize: number;
  private readonly fetcher: HttpFetch;

  constructor(private readonly config: ClickHouseSinkConfig, fetcher?: HttpFetch) {
    this.flushIntervalMs = config.flushIntervalMs ?? DEFAULT_FLUSH_INTERVAL_MS;
    this.maxBatchSize = config.maxBatchSize ?? DEFAULT_MAX_BATCH_SIZE;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.fetcher = fetcher ?? ((globalThis as any).fetch as HttpFetch);
  }

  enqueue(events: unknown[]): void {
    this.buffer.push(...events);
    if (this.buffer.length >= this.maxBatchSize) {
      void this.flush();
      return;
    }
    if (!this.timer) {
      this.timer = setTimeout(() => {
        this.timer = null;
        void this.flush();
      }, this.flushIntervalMs);
    }
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;
    const batch = this.buffer.splice(0);
    const { url, database, username, password } = this.config;
    const query = `INSERT INTO ${database}.bot_hits FORMAT JSONEachRow`;
    const body = batch.map((row) => JSON.stringify(row)).join("\n");
    try {
      const res = await this.fetcher(`${url}/?query=${encodeURIComponent(query)}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-ndjson",
          "X-ClickHouse-User": username,
          "X-ClickHouse-Key": password,
        },
        body,
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.error(`[clickhouse-sink] insert failed: ${res.status} ${text}`);
      }
    } catch (err) {
      console.error("[clickhouse-sink] network error:", err);
    }
  }

  async close(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    await this.flush();
  }
}
