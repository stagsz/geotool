import type { IEventStore } from "./event-store";
import type { ClickHouseSink } from "./clickhouse-sink";

export class CompositeEventStore implements IEventStore {
  constructor(
    private readonly primary: IEventStore,
    private readonly sink: ClickHouseSink
  ) {}

  async push(events: unknown[]): Promise<void> {
    await this.primary.push(events);
    this.sink.enqueue(events);
  }

  list(limit: number): Promise<unknown[]> {
    return this.primary.list(limit);
  }
}
