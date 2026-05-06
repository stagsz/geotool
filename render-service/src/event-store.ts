const EVENTS_KEY = "bot-events";
const MAX_EVENTS = 10_000;

export interface EventRedis {
  lpush(key: string, ...values: string[]): Promise<number>;
  ltrim(key: string, start: number, stop: number): Promise<string>;
  lrange(key: string, start: number, stop: number): Promise<string[]>;
}

export class EventStore {
  constructor(private readonly redis: EventRedis) {}

  async push(events: unknown[]): Promise<void> {
    if (events.length === 0) return;
    const values = events.map((e) => JSON.stringify(e));
    await this.redis.lpush(EVENTS_KEY, ...values);
    await this.redis.ltrim(EVENTS_KEY, 0, MAX_EVENTS - 1);
  }

  async list(limit: number = MAX_EVENTS): Promise<unknown[]> {
    const values = await this.redis.lrange(EVENTS_KEY, 0, limit - 1);
    return values.map((v) => JSON.parse(v));
  }
}
