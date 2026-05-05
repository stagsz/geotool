import { describe, it, expect, vi, afterEach } from "vitest";
import { EventPublisher } from "./publisher";
import type { BotHitEvent } from "./events";

const makeEvent = (): BotHitEvent => ({
  botId: "gptbot",
  botName: "GPTBot",
  confidence: 85,
  url: "https://example.com",
  pageType: "blog",
  transformationApplied: true,
  timestamp: new Date().toISOString(),
  ip: "1.2.3.4",
});

afterEach(() => {
  vi.useRealTimers();
});

describe("EventPublisher", () => {
  it("publish() adds to buffer without immediately flushing", async () => {
    const sink = vi.fn().mockResolvedValue(undefined);
    const publisher = new EventPublisher(sink);
    publisher.publish(makeEvent());
    expect(sink).not.toHaveBeenCalled();
    await publisher.close();
  });

  it("flush() sends buffered events to sink and clears buffer", async () => {
    const sink = vi.fn().mockResolvedValue(undefined);
    const publisher = new EventPublisher(sink);
    const event = makeEvent();
    publisher.publish(event);
    await publisher.flush();
    expect(sink).toHaveBeenCalledWith([event]);
  });

  it("flush() is a no-op when buffer is empty", async () => {
    const sink = vi.fn().mockResolvedValue(undefined);
    const publisher = new EventPublisher(sink);
    await publisher.flush();
    expect(sink).not.toHaveBeenCalled();
  });

  it("auto-flushes when buffer reaches 1000 events", async () => {
    const sink = vi.fn().mockResolvedValue(undefined);
    const publisher = new EventPublisher(sink);
    for (let i = 0; i < 1000; i++) {
      publisher.publish(makeEvent());
    }
    await Promise.resolve();
    await Promise.resolve();
    expect(sink).toHaveBeenCalled();
    expect(sink.mock.calls[0][0]).toHaveLength(1000);
  });

  it("flushes after 100ms timer", async () => {
    vi.useFakeTimers();
    const sink = vi.fn().mockResolvedValue(undefined);
    const publisher = new EventPublisher(sink);
    publisher.publish(makeEvent());
    expect(sink).not.toHaveBeenCalled();
    await vi.runAllTimersAsync();
    expect(sink).toHaveBeenCalled();
  });

  it("close() flushes pending events and stops timer", async () => {
    const sink = vi.fn().mockResolvedValue(undefined);
    const publisher = new EventPublisher(sink);
    publisher.publish(makeEvent());
    await publisher.close();
    expect(sink).toHaveBeenCalled();
  });
});
