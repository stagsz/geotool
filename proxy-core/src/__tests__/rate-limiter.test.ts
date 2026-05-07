import { describe, it, expect, vi } from "vitest";
import { RateLimiter } from "../rate-limiter";

const makeKV = (initial: Record<string, string> = {}) => {
  const store = new Map(Object.entries(initial));
  return {
    get: vi.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
    put: vi.fn((key: string, value: string) => {
      store.set(key, value);
      return Promise.resolve();
    }),
  } as unknown as KVNamespace;
};

describe("RateLimiter", () => {
  it("allows requests under the limit", async () => {
    const kv = makeKV();
    const limiter = new RateLimiter(kv, { maxRequests: 3, windowMs: 60_000 });
    expect(await limiter.isAllowed("1.2.3.4")).toBe(true);
    expect(await limiter.isAllowed("1.2.3.4")).toBe(true);
    expect(await limiter.isAllowed("1.2.3.4")).toBe(true);
  });

  it("blocks requests over the limit", async () => {
    const kv = makeKV();
    const limiter = new RateLimiter(kv, { maxRequests: 2, windowMs: 60_000 });
    await limiter.isAllowed("1.2.3.4");
    await limiter.isAllowed("1.2.3.4");
    expect(await limiter.isAllowed("1.2.3.4")).toBe(false);
  });

  it("counts different IPs independently", async () => {
    const kv = makeKV();
    const limiter = new RateLimiter(kv, { maxRequests: 1, windowMs: 60_000 });
    expect(await limiter.isAllowed("1.1.1.1")).toBe(true);
    expect(await limiter.isAllowed("2.2.2.2")).toBe(true);
    expect(await limiter.isAllowed("1.1.1.1")).toBe(false);
  });

  it("resets after window rolls over", async () => {
    const kv = makeKV();
    const limiter = new RateLimiter(kv, { maxRequests: 1, windowMs: 60_000 });
    // Saturate window 0
    const realNow = Date.now;
    vi.spyOn(Date, "now").mockReturnValue(0);
    await limiter.isAllowed("1.2.3.4");
    expect(await limiter.isAllowed("1.2.3.4")).toBe(false);
    // Advance to next window
    vi.spyOn(Date, "now").mockReturnValue(60_001);
    expect(await limiter.isAllowed("1.2.3.4")).toBe(true);
    vi.spyOn(Date, "now").mockImplementation(realNow);
  });

  it("uses defaults when no config provided", async () => {
    const kv = makeKV();
    const limiter = new RateLimiter(kv);
    expect(await limiter.isAllowed("1.2.3.4")).toBe(true);
  });
});
