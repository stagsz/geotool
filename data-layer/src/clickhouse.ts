export interface ClickHouseClient {
  insert(table: string, rows: Record<string, unknown>[]): Promise<void>;
}

export class ClickHouseWriter {
  constructor(private readonly client: ClickHouseClient) {}

  async write(events: Record<string, unknown>[]): Promise<void> {
    if (events.length === 0) return;
    await this.client.insert("bot_hits", events);
  }
}
