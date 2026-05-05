import { describe, it, expect, vi } from "vitest";
import { buildCacheKey, RenderCache, TTL_SECONDS } from "../cache";

const makeRedis = () => ({
  get: vi.fn().mockResolvedValue(null),
  setex: vi.fn().mockResolvedValue("OK"),
  del: vi.fn().mockResolvedValue(1),
});

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
    const cache = new RenderCache(makeRedis());
    expect(await cache.get("https://example.com")).toBeNull();
  });

  it("returns stored HTML on cache hit", async () => {
    const redis = makeRedis();
    redis.get.mockResolvedValue("<html>hi</html>");
    const cache = new RenderCache(redis);
    expect(await cache.get("https://example.com")).toBe("<html>hi</html>");
  });

  it("calls setex with TTL_SECONDS", async () => {
    const redis = makeRedis();
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
      get: vi.fn().mockImplementation((k: string) => { capturedKeys.push(k); return Promise.resolve(null); }),
      setex: vi.fn().mockImplementation((k: string) => { capturedKeys.push(k); return Promise.resolve("OK"); }),
      del: vi.fn().mockResolvedValue(1),
    };
    const cache = new RenderCache(redis);
    await cache.set("https://example.com", "<html></html>");
    await cache.get("https://example.com");
    expect(capturedKeys[0]).toBe(capturedKeys[1]);
  });

  describe("ETag", () => {
    it("getEtag returns null when not stored", async () => {
      const cache = new RenderCache(makeRedis());
      expect(await cache.getEtag("https://example.com")).toBeNull();
    });

    it("setEtag stores with etag: prefix key and TTL_SECONDS", async () => {
      const redis = makeRedis();
      const cache = new RenderCache(redis);
      await cache.setEtag("https://example.com", '"abc123"');
      expect(redis.setex).toHaveBeenCalledWith(
        expect.stringMatching(/^etag:/),
        TTL_SECONDS,
        '"abc123"'
      );
    });

    it("getEtag and setEtag use a different key prefix from get/set", async () => {
      const htmlKey: string[] = [];
      const etagKey: string[] = [];
      const redis = {
        get: vi.fn().mockResolvedValue(null),
        setex: vi.fn().mockImplementation((k: string) => {
          if (k.startsWith("etag:")) etagKey.push(k);
          else htmlKey.push(k);
          return Promise.resolve("OK");
        }),
        del: vi.fn().mockResolvedValue(1),
      };
      const cache = new RenderCache(redis);
      await cache.set("https://example.com", "<html></html>");
      await cache.setEtag("https://example.com", '"v1"');
      expect(htmlKey[0]).not.toBe(etagKey[0]);
      expect(etagKey[0]).toMatch(/^etag:/);
    });

    it("invalidate deletes both html and etag keys", async () => {
      const redis = makeRedis();
      const cache = new RenderCache(redis);
      await cache.invalidate("https://example.com");
      expect(redis.del).toHaveBeenCalledTimes(2);
      const keys = redis.del.mock.calls.map(([k]: [string]) => k);
      const etagKey = keys.find((k: string) => k.startsWith("etag:"));
      const htmlKey = keys.find((k: string) => !k.startsWith("etag:"));
      expect(etagKey).toBeDefined();
      expect(htmlKey).toBeDefined();
    });
  });
});
