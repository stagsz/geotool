export interface ClickHouseSinkOptions {
  url: string;
  database: string;
  username: string;
  password: string;
}

export class ClickHouseSink {
  private readonly url: string;
  private readonly database: string;
  private readonly username: string;
  private readonly password: string;
  private buffer: unknown[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private closed = false;

  constructor(options: ClickHouseSinkOptions) {
    this.url = options.url;
    this.database = options.database;
    this.username = options.username;
    this.password = options.password;
    this.timer = setInterval(() => this.flush(), 5_000);
  }

  async push(events: unknown[]): Promise<void> {
    if (this.closed || events.length === 0) return;
    this.buffer.push(...events);
    if (this.buffer.length >= 100) await this.flush();
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;
    const batch = this.buffer.splice(0);
    const body = batch.map((row) => JSON.stringify(row)).join("\n");
    try {
      const res = await fetch(
        `${this.url}/?database=${encodeURIComponent(this.database)}&query=${encodeURIComponent("INSERT INTO bot_hits FORMAT JSONEachRow")}`,
        {
          method: "POST",
          headers: {
            "X-ClickHouse-User": this.username,
            "X-ClickHouse-Key": this.password,
          },
          body,
        },
      );
      if (!res.ok) {
        console.error(`[clickhouse-sink] insert failed: ${res.status} ${await res.text()}`);
      }
    } catch (err) {
      console.error("[clickhouse-sink] insert error:", err);
    }
  }

  async close(): Promise<void> {
    this.closed = true;
    if (this.timer) clearInterval(this.timer);
    await this.flush();
  }
}
