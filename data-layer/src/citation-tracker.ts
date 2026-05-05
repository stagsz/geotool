import type { CitationEvent } from "./events";

export class CitationTracker {
  private readonly events: CitationEvent[] = [];

  record(event: CitationEvent): void {
    this.events.push(event);
  }

  getRate(clientId: string): number {
    const clientEvents = this.events.filter((e) => e.clientId === clientId);
    if (clientEvents.length === 0) return 0;
    const cited = clientEvents.filter((e) => e.cited).length;
    return cited / clientEvents.length;
  }
}
