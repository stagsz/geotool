import { describe, it, expect, vi } from "vitest";
import { EventStore } from "../event-store";

const makeRedis = (stored: string[] = []) => ({
  lpush: vi.fn().mockResolvedValue(stored.length + 1),
  ltrim: vi.fn().mockResolvedValue("OK"),
  lrange: vi.fn().mockResolvedValue(stored),
});

describe("EventStore.push", () => {
  it("serialises events and calls lpush + ltrim", async () => {
    const redis = makeRedis();
    const store = new EventStore(redis);
    await store.push([{ botId: "gptbot" }, { botId: "claudebot" }]);
    expect(redis.lpush).toHaveBeenCalledWith(
      "bot-events",
      JSON.stringify({ botId: "gptbot" }),
      JSON.stringify({ botId: "claudebot" })
    );
    expect(redis.ltrim).toHaveBeenCalled();
  });

  it("does nothing for empty array", async () => {
    const redis = makeRedis();
    const store = new EventStore(redis);
    await store.push([]);
    expect(redis.lpush).not.toHaveBeenCalled();
  });
});

describe("EventStore.list", () => {
  it("deserialises stored JSON strings", async () => {
    const events = [{ botId: "gptbot" }, { botId: "claudebot" }];
    const redis = makeRedis(events.map((e) => JSON.stringify(e)));
    const store = new EventStore(redis);
    expect(await store.list()).toEqual(events);
  });

  it("calls lrange with correct key and limit", async () => {
    const redis = makeRedis();
    const store = new EventStore(redis);
    await store.list(500);
    expect(redis.lrange).toHaveBeenCalledWith("bot-events", 0, 499);
  });

  it("returns empty array when no events stored", async () => {
    const redis = makeRedis([]);
    const store = new EventStore(redis);
    expect(await store.list()).toEqual([]);
  });
});
