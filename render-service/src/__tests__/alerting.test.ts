import { describe, it, expect, vi, beforeEach } from "vitest";
import { AlertingEngine } from "../alerting";

function makeEvents(botId: string, count: number): { botId: string; timestamp: string }[] {
  const ts = new Date(Date.now() - 10 * 60 * 1000).toISOString(); // 10 minutes ago
  return Array.from({ length: count }, () => ({ botId, timestamp: ts }));
}

describe("AlertingEngine", () => {
  let fetcher: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetcher = vi.fn().mockResolvedValue({ ok: true });
  });

  it("does not call fetch when threshold is not reached", async () => {
    const engine = new AlertingEngine({
      webhookUrl: "https://example.com/webhook",
      botHitsPerHourThreshold: 100,
      fetcher,
    });
    const events = makeEvents("gptbot", 50);
    await engine.check(events);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("calls fetch with threshold payload when threshold is exceeded", async () => {
    const engine = new AlertingEngine({
      webhookUrl: "https://example.com/webhook",
      botHitsPerHourThreshold: 10,
      fetcher,
    });
    const events = makeEvents("gptbot", 15);
    await engine.check(events);
    expect(fetcher).toHaveBeenCalledOnce();
    const [url, opts] = fetcher.mock.calls[0];
    expect(url).toBe("https://example.com/webhook");
    const body = JSON.parse(opts.body as string);
    expect(body.type).toBe("threshold");
    expect(body.bot).toBe("gptbot");
    expect(body.count).toBe(15);
  });

  it("calls fetch with unknown_bot payload for unrecognised bot", async () => {
    const engine = new AlertingEngine({
      webhookUrl: "https://example.com/webhook",
      botHitsPerHourThreshold: 100,
      fetcher,
    });
    const events = makeEvents("novelbot", 1);
    await engine.check(events);
    expect(fetcher).toHaveBeenCalledOnce();
    const body = JSON.parse(fetcher.mock.calls[0][1].body as string);
    expect(body.type).toBe("unknown_bot");
    expect(body.bot).toBe("novelbot");
  });

  it("fires each alert only once (cooldown suppression)", async () => {
    const engine = new AlertingEngine({
      webhookUrl: "https://example.com/webhook",
      botHitsPerHourThreshold: 10,
      fetcher,
    });
    const events = makeEvents("gptbot", 15);
    await engine.check(events);
    await engine.check(events);
    // threshold key is per-hour-slot so fired only once
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("resolves without throwing when fetch throws", async () => {
    fetcher.mockRejectedValue(new Error("network failure"));
    const engine = new AlertingEngine({
      webhookUrl: "https://example.com/webhook",
      botHitsPerHourThreshold: 10,
      fetcher,
    });
    const events = makeEvents("gptbot", 15);
    await expect(engine.check(events)).resolves.toBeUndefined();
  });
});
