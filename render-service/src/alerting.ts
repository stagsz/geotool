const KNOWN_BOTS = new Set(["gptbot", "claudebot", "googlebot", "bingbot", "perplexitybot"]);

interface StoredEvent {
  botId?: string | null;
  timestamp?: string;
}

interface AlertPayload {
  type: "threshold" | "unknown_bot";
  bot: string;
  count: number;
  timestamp: string;
}

export interface AlertingOptions {
  webhookUrl: string;
  botHitsPerHourThreshold?: number;
  fetcher?: typeof fetch;
}

export class AlertingEngine {
  private readonly webhookUrl: string;
  private readonly threshold: number;
  private readonly fetcher: typeof fetch;
  private readonly fired: Set<string> = new Set();

  constructor(options: AlertingOptions) {
    this.webhookUrl = options.webhookUrl;
    this.threshold = options.botHitsPerHourThreshold ?? 100;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.fetcher = options.fetcher ?? (globalThis as any).fetch;
  }

  async check(events: unknown[]): Promise<void> {
    const now = new Date();
    const cutoff = now.getTime() - 60 * 60 * 1000;
    const stored = events as StoredEvent[];

    const recent = stored.filter((e) => {
      if (!e.timestamp) return false;
      return new Date(e.timestamp).getTime() >= cutoff;
    });

    const counts = new Map<string, number>();
    for (const e of recent) {
      const bot = e.botId ?? "";
      if (!bot) continue;
      counts.set(bot, (counts.get(bot) ?? 0) + 1);
    }

    const hourSlot = `${now.getUTCFullYear()}-${now.getUTCMonth()}-${now.getUTCDate()}-${now.getUTCHours()}`;
    const nowIso = now.toISOString();
    const fires: Promise<void>[] = [];

    for (const [bot, count] of counts) {
      if (count > this.threshold) {
        const key = `threshold:${bot}:${hourSlot}`;
        if (!this.fired.has(key)) {
          this.fired.add(key);
          fires.push(this.fire({ type: "threshold", bot, count, timestamp: nowIso }));
        }
      }

      const botLower = bot.toLowerCase();
      if (!KNOWN_BOTS.has(botLower)) {
        const key = `unknown:${bot}`;
        if (!this.fired.has(key)) {
          this.fired.add(key);
          fires.push(this.fire({ type: "unknown_bot", bot, count: 1, timestamp: nowIso }));
        }
      }
    }

    await Promise.all(fires);
  }

  private async fire(payload: AlertPayload): Promise<void> {
    try {
      await this.fetcher(this.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      // swallow all errors
    }
  }
}
