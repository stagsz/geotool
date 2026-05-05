import { describe, it, expect, vi } from "vitest";
import { ClickHouseWriter } from "./clickhouse";

describe("ClickHouseWriter", () => {
  it("write() calls client.insert with table and events", async () => {
    const client = { insert: vi.fn().mockResolvedValue(undefined) };
    const writer = new ClickHouseWriter(client);
    const events = [{ botId: "gptbot", url: "https://example.com" }];
    await writer.write(events);
    expect(client.insert).toHaveBeenCalledWith("bot_hits", events);
  });

  it("write([]) does not call client.insert", async () => {
    const client = { insert: vi.fn() };
    const writer = new ClickHouseWriter(client);
    await writer.write([]);
    expect(client.insert).not.toHaveBeenCalled();
  });
});
