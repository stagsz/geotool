import { describe, it, expect, vi, beforeEach } from "vitest";
import { publishBotEvent } from "../index";

const sampleEvent = {
  botId: "gptbot",
  botName: "GPTBot",
  confidence: 70,
  url: "https://example.com/",
  pageType: "product",
  transformationApplied: true,
  timestamp: "2026-01-01T00:00:00Z",
  ip: "1.2.3.4",
  fingerprint: null,
};

describe("publishBotEvent", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("sends Authorization header when apiKey is provided", async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response());
    vi.stubGlobal("fetch", mockFetch);
    await publishBotEvent(sampleEvent, "https://render.example.com", "secret-key");
    expect(mockFetch).toHaveBeenCalledWith(
      "https://render.example.com/events",
      expect.objectContaining({
        headers: expect.objectContaining({ authorization: "Bearer secret-key" }),
      })
    );
  });

  it("sends no Authorization header when apiKey is not provided", async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response());
    vi.stubGlobal("fetch", mockFetch);
    await publishBotEvent(sampleEvent, "https://render.example.com");
    const callHeaders = mockFetch.mock.calls[0][1].headers as Record<string, string>;
    expect(callHeaders).not.toHaveProperty("authorization");
  });

  it("falls back to console.log when eventsUrl is not provided", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await publishBotEvent(sampleEvent);
    expect(consoleSpy).toHaveBeenCalledWith("[BOT_EVENT]", expect.any(String));
  });

  it("falls back to console.log on network error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network error")));
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await publishBotEvent(sampleEvent, "https://render.example.com", "key");
    expect(consoleSpy).toHaveBeenCalledWith("[BOT_EVENT_FALLBACK]", expect.any(String));
  });
});
