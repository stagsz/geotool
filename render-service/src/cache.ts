import { createHash } from "node:crypto";

export const TTL_SECONDS = 14400;

export interface RedisLike {
  get(key: string): Promise<string | null>;
  setex(key: string, ttl: number, value: string): Promise<unknown>;
  del(key: string): Promise<unknown>;
}

export function buildCacheKey(rawUrl: string): string {
  const url = new URL(rawUrl);
  const sorted = [...url.searchParams.entries()].sort(([a], [b]) =>
    a.localeCompare(b)
  );
  url.search = new URLSearchParams(sorted).toString();
  return createHash("sha256").update(url.toString()).digest("hex");
}

export class RenderCache {
  constructor(private readonly redis: RedisLike) {}

  async get(url: string): Promise<string | null> {
    return this.redis.get(buildCacheKey(url));
  }

  async set(url: string, html: string): Promise<void> {
    await this.redis.setex(buildCacheKey(url), TTL_SECONDS, html);
  }

  async getEtag(url: string): Promise<string | null> {
    return this.redis.get(`etag:${buildCacheKey(url)}`);
  }

  async setEtag(url: string, etag: string): Promise<void> {
    await this.redis.setex(`etag:${buildCacheKey(url)}`, TTL_SECONDS, etag);
  }

  async invalidate(url: string): Promise<void> {
    const key = buildCacheKey(url);
    await Promise.all([this.redis.del(key), this.redis.del(`etag:${key}`)]);
  }
}
