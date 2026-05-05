import type { BotHitEvent } from "./events";

type Sink = (events: BotHitEvent[]) => Promise<void>;

export class EventPublisher {
  private buffer: BotHitEvent[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly maxBatchSize = 1000;
  private readonly flushIntervalMs = 100;

  constructor(private readonly sink: Sink) {}

  publish(event: BotHitEvent): void {
    this.buffer.push(event);
    if (this.buffer.length >= this.maxBatchSize) {
      void this.flush();
      return;
    }
    if (!this.timer) {
      this.timer = setTimeout(() => {
        this.timer = null;
        void this.flush();
      }, this.flushIntervalMs);
    }
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;
    const batch = this.buffer.splice(0);
    await this.sink(batch);
  }

  async close(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    await this.flush();
  }
}
