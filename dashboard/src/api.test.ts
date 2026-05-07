import { describe, it, expect, vi, beforeEach } from "vitest";
import { formatBotName, fetchStats } from "./api";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
});

describe("formatBotName", () => {
  it("returns display name for known bot IDs", () => {
    expect(formatBotName("gptbot")).toBe("GPTBot");
    expect(formatBotName("claudebot")).toBe("ClaudeBot");
    expect(formatBotName("googlebot")).toBe("Googlebot");
    expect(formatBotName("perplexitybot")).toBe("PerplexityBot");
  });

  it("is case-insensitive for known IDs", () => {
    expect(formatBotName("GPTBot")).toBe("GPTBot");
    expect(formatBotName("CLAUDEBOT")).toBe("ClaudeBot");
  });

  it("capitalises hyphen-separated words for unknown IDs", () => {
    expect(formatBotName("unknown-bot")).toBe("Unknown Bot");
    expect(formatBotName("my-crawler-v2")).toBe("My Crawler V2");
  });

  it("capitalises underscore-separated words for unknown IDs", () => {
    expect(formatBotName("my_crawler")).toBe("My Crawler");
  });
});

describe("fetchStats", () => {
  const payload = {
    total: 42,
    since: "2026-01-01T00:00:00Z",
    byBot: { gptbot: 42 },
    byPageType: { product: 42 },
    topPages: [{ url: "https://example.com", count: 42 }],
    byDay: [{ date: "2026-01-01", count: 42 }],
  };

  it("resolves with parsed JSON on 200", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(payload) });
    const result = await fetchStats(30, "");
    expect(result).toEqual(payload);
  });

  it("includes days param in the request URL", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(payload) });
    await fetchStats(7, "");
    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toContain("days=7");
  });

  it("includes hostname param when non-empty", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(payload) });
    await fetchStats(30, "example.com");
    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toContain("hostname=example.com");
  });

  it("omits hostname param when empty string", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(payload) });
    await fetchStats(30, "");
    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).not.toContain("hostname");
  });

  it("rejects with an error message on non-2xx", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve("Unauthorized"),
      statusText: "Unauthorized",
    });
    await expect(fetchStats(30, "")).rejects.toThrow("API error 401");
  });

  it("includes status text in error when text() resolves", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 503,
      text: () => Promise.resolve("Service Unavailable"),
      statusText: "Service Unavailable",
    });
    await expect(fetchStats(30, "")).rejects.toThrow("503: Service Unavailable");
  });
});
