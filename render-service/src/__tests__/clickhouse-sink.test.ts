import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ClickHouseSink } from "../clickhouse-sink";

const baseConfig = {
  url: "http://localhost:8123",
  database: "mydb",
  username: "default",
  password: "secret",
};

const makeResponse = (status: number, body = "") => ({
  ok: status >= 200 && status < 300,
  status,
  text: () => Promise.resolve(body),
});

describe("ClickHouseSink", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("flush is a no-op when buffer is empty", async () => {
    const fetch = vi.fn();
    const sink = new ClickHouseSink(baseConfig, fetch);
    await sink.flush();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("flush POSTs buffered events as NDJSON to ClickHouse", async () => {
    const fetch = vi.fn().mockResolvedValue(makeResponse(200));
    const sink = new ClickHouseSink(baseConfig, fetch);
    sink.enqueue([{ botId: "gptbot" }, { botId: "claudebot" }]);
    await sink.flush();
    expect(fetch).toHaveBeenCalledOnce();
    const [url, opts] = fetch.mock.calls[0];
    expect(url).toContain("bot_hits");
    expect(opts.headers["X-ClickHouse-User"]).toBe("default");
    const lines = (opts.body as string).split("\n");
    expect(lines).toHaveLength(2);
  });

  it("enqueue triggers flush after flushIntervalMs", async () => {
    const fetch = vi.fn().mockResolvedValue(makeResponse(200));
    const sink = new ClickHouseSink({ ...baseConfig, flushIntervalMs: 100 }, fetch);
    sink.enqueue([{ botId: "gptbot" }]);
    expect(fetch).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(100);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("enqueue triggers immediate flush when maxBatchSize is reached", async () => {
    const fetch = vi.fn().mockResolvedValue(makeResponse(200));
    const sink = new ClickHouseSink({ ...baseConfig, maxBatchSize: 2 }, fetch);
    sink.enqueue([{ botId: "a" }, { botId: "b" }]);
    await Promise.resolve();
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("close flushes pending events and clears the timer", async () => {
    const fetch = vi.fn().mockResolvedValue(makeResponse(200));
    const sink = new ClickHouseSink({ ...baseConfig, flushIntervalMs: 10_000 }, fetch);
    sink.enqueue([{ botId: "gptbot" }]);
    await sink.close();
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("logs error but does not throw when ClickHouse returns non-2xx", async () => {
    const fetch = vi.fn().mockResolvedValue(makeResponse(500, "server error"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const sink = new ClickHouseSink(baseConfig, fetch);
    sink.enqueue([{ botId: "gptbot" }]);
    await sink.flush();
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining("insert failed: 500"));
    consoleError.mockRestore();
  });
});
