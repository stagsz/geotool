import { describe, it, expect, vi } from "vitest";
import { buildCacheKey, RenderCache, TTL_SECONDS } from "../cache";

describe("buildCacheKey", () => {
  it("returns a 64-char lowercase hex string", () => {
    const key = buildCacheKey("https://example.com");
    expect(key).toHaveLength(64);
    expect(key).toMatch(/^[0-9a-f]{64}$/);
  });

  it("normalizes query param order", () => {
    const a = buildCacheKey("https://example.com?b=2&a=1");
    const b = buildCacheKey("https://example.com?a=1&b=2");
    expect(a).toBe(b);
  });

  it("differentiates different URLs", () => {
    expect(buildCacheKey("https://a.com")).not.toBe(
      buildCacheKey("https://b.com")
    );
  });
});

describe("TTL_SECONDS", () => {
  it("equals 14400", () => {
    expect(TTL_SECONDS).toBe(14400);
  });
});

describe("RenderCache", () => {
  it("returns null on cache miss", async () => {
    const redis = { get: vi.fn().mockResolvedValue(null), setex: vi.fn() };
    const cache = new RenderCache(redis);
    expect(await cache.get("https://example.com")).toBeNull();
  });

  it("returns stored HTML on cache hit", async () => {
    const redis = {
      get: vi.fn().mockResolvedValue("<html>hi</html>"),
      setex: vi.fn(),
    };
    const cache = new RenderCache(redis);
    expect(await cache.get("https://example.com")).toBe("<html>hi</html>");
  });

  it("calls setex with TTL_SECONDS", async () => {
    const redis = { get: vi.fn(), setex: vi.fn().mockResolvedValue("OK") };
    const cache = new RenderCache(redis);
    await cache.set("https://example.com", "<html>test</html>");
    expect(redis.setex).toHaveBeenCalledWith(
      expect.any(String),
      TTL_SECONDS,
      "<html>test</html>"
    );
  });

  it("uses the same cache key for get and set", async () => {
    const capturedKeys: string[] = [];
    const redis = {
      get: vi.fn().mockImplementation((k: string) => {
        capturedKeys.push(k);
        return Promise.resolve(null);
      }),
      setex: vi.fn().mockImplementation((k: string) => {
        capturedKeys.push(k);
        return Promise.resolve("OK");
      }),
    };
    const cache = new RenderCache(redis);
    await cache.set("https://example.com", "<html></html>");
    await cache.get("https://example.com");
    expect(capturedKeys[0]).toBe(capturedKeys[1]);
  });
});
