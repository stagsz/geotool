import type { ClickHouseClient } from "./clickhouse";

export interface ClickHouseHttpConfig {
  url: string;
  database: string;
  username?: string;
  password?: string;
}

type HttpResponse = { ok: boolean; status: number; text(): Promise<string> };
type HttpFetch = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string }
) => Promise<HttpResponse>;

export class ClickHouseHttpClient implements ClickHouseClient {
  private readonly fetcher: HttpFetch;

  constructor(private readonly config: ClickHouseHttpConfig, fetcher?: HttpFetch) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.fetcher = fetcher ?? (globalThis as any).fetch;
  }

  async insert(table: string, rows: Record<string, unknown>[]): Promise<void> {
    if (rows.length === 0) return;
    const { url, database, username = "default", password = "" } = this.config;
    const query = `INSERT INTO ${database}.${table} FORMAT JSONEachRow`;
    const body = rows.map((row) => JSON.stringify(row)).join("\n");
    const res = await this.fetcher(`${url}/?query=${encodeURIComponent(query)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-ndjson",
        "X-ClickHouse-User": username,
        "X-ClickHouse-Key": password,
      },
      body,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`ClickHouse insert failed: ${res.status} ${text}`);
    }
  }
}
