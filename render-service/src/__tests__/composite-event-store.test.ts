import { describe, it, expect, vi } from "vitest";
import { CompositeEventStore } from "../composite-event-store";

const makePrimary = () => ({
  push: vi.fn().mockResolvedValue(undefined),
  list: vi.fn().mockResolvedValue([]),
});

const makeSink = () => ({
  enqueue: vi.fn(),
});

describe("CompositeEventStore", () => {
  it("push calls primary.push and sink.enqueue with the same events", async () => {
    const primary = makePrimary();
    const sink = makeSink();
    const store = new CompositeEventStore(primary, sink as never);
    const events = [{ botId: "gptbot", url: "https://example.com" }];
    await store.push(events);
    expect(primary.push).toHaveBeenCalledWith(events);
    expect(sink.enqueue).toHaveBeenCalledWith(events);
  });

  it("list delegates to primary.list", async () => {
    const primary = makePrimary();
    primary.list.mockResolvedValue([{ botId: "gptbot" }]);
    const sink = makeSink();
    const store = new CompositeEventStore(primary, sink as never);
    const result = await store.list(100);
    expect(primary.list).toHaveBeenCalledWith(100);
    expect(result).toEqual([{ botId: "gptbot" }]);
  });

  it("propagates primary.push errors and does not enqueue to sink", async () => {
    const primary = makePrimary();
    primary.push.mockRejectedValue(new Error("Redis unavailable"));
    const sink = makeSink();
    const store = new CompositeEventStore(primary, sink as never);
    await expect(store.push([{ botId: "gptbot" }])).rejects.toThrow("Redis unavailable");
    expect(sink.enqueue).not.toHaveBeenCalled();
  });

  it("push forwards empty events array to both primary and sink", async () => {
    const primary = makePrimary();
    const sink = makeSink();
    const store = new CompositeEventStore(primary, sink as never);
    await store.push([]);
    expect(primary.push).toHaveBeenCalledWith([]);
    expect(sink.enqueue).toHaveBeenCalledWith([]);
  });
});
