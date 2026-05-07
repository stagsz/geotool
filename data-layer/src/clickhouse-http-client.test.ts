import { describe, it, expect, vi } from "vitest";
import { ClickHouseHttpClient } from "./clickhouse-http-client";

const makeResponse = (status: number, body = "") => ({
  ok: status >= 200 && status < 300,
  status,
  text: () => Promise.resolve(body),
});

const makeFetch = (status: number, body = "") =>
  vi.fn().mockResolvedValue(makeResponse(status, body));

const baseConfig = {
  url: "http://localhost:8123",
  database: "mydb",
  username: "default",
  password: "secret",
};

describe("ClickHouseHttpClient", () => {
  it("is a no-op when rows is empty", async () => {
    const fetch = makeFetch(200);
    const client = new ClickHouseHttpClient(baseConfig, fetch);
    await client.insert("bot_hits", []);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("POSTs NDJSON rows to the ClickHouse endpoint", async () => {
    const fetch = makeFetch(200);
    const client = new ClickHouseHttpClient(baseConfig, fetch);
    await client.insert("bot_hits", [{ botId: "gptbot", url: "https://example.com" }]);
    expect(fetch).toHaveBeenCalledOnce();
    const [url, opts] = fetch.mock.calls[0];
    expect(url).toContain("query=");
    expect(url).toContain("bot_hits");
    expect(opts.method).toBe("POST");
    expect(opts.headers["X-ClickHouse-User"]).toBe("default");
    expect(opts.headers["X-ClickHouse-Key"]).toBe("secret");
    expect(opts.body).toContain("gptbot");
  });

  it("sends both rows when inserting multiple", async () => {
    const fetch = makeFetch(200);
    const client = new ClickHouseHttpClient(baseConfig, fetch);
    await client.insert("bot_hits", [{ id: 1 }, { id: 2 }]);
    const [, opts] = fetch.mock.calls[0];
    const lines = (opts.body as string).split("\n");
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0])).toEqual({ id: 1 });
    expect(JSON.parse(lines[1])).toEqual({ id: 2 });
  });

  it("throws when ClickHouse returns non-2xx", async () => {
    const fetch = makeFetch(500, "Code: 47, Type: Exception");
    const client = new ClickHouseHttpClient(baseConfig, fetch);
    await expect(client.insert("bot_hits", [{ x: 1 }])).rejects.toThrow(
      "ClickHouse insert failed: 500"
    );
  });

  it("defaults username to 'default' and password to empty string", async () => {
    const fetch = makeFetch(200);
    const client = new ClickHouseHttpClient({ url: "http://localhost:8123", database: "mydb" }, fetch);
    await client.insert("bot_hits", [{ x: 1 }]);
    const [, opts] = fetch.mock.calls[0];
    expect(opts.headers["X-ClickHouse-User"]).toBe("default");
    expect(opts.headers["X-ClickHouse-Key"]).toBe("");
  });
});
