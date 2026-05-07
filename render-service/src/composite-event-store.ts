import type { IEventStore } from "./event-store";
import type { ClickHouseSink } from "./clickhouse-sink";

export class CompositeEventStore implements IEventStore {
  constructor(
    private readonly primary: IEventStore,
    private readonly sink: ClickHouseSink,
  ) {}

  async push(events: unknown[]): Promise<void> {
    await this.primary.push(events);
    try {
      await this.sink.push(events);
    } catch (err) {
      console.error("[composite-event-store] sink error:", err);
    }
  }

  async list(limit: number): Promise<unknown[]> {
    return this.primary.list(limit);
  }
}
