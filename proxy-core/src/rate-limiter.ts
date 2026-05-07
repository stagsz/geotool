const DEFAULT_MAX_REQUESTS = 120;
const DEFAULT_WINDOW_MS = 60_000;

export interface RateLimitConfig {
  maxRequests?: number;
  windowMs?: number;
}

export class RateLimiter {
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(
    private readonly kv: KVNamespace,
    config: RateLimitConfig = {}
  ) {
    this.maxRequests = config.maxRequests ?? DEFAULT_MAX_REQUESTS;
    this.windowMs = config.windowMs ?? DEFAULT_WINDOW_MS;
  }

  async isAllowed(ip: string): Promise<boolean> {
    const window = Math.floor(Date.now() / this.windowMs);
    const key = `rl:${ip}:${window}`;
    const raw = await this.kv.get(key);
    const count = raw ? parseInt(raw, 10) : 0;
    if (count >= this.maxRequests) return false;
    await this.kv.put(key, String(count + 1), {
      expirationTtl: Math.ceil((this.windowMs * 2) / 1000),
    });
    return true;
  }
}
