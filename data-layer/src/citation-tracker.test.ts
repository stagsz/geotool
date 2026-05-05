import { describe, it, expect } from "vitest";
import { CitationTracker } from "./citation-tracker";

describe("CitationTracker", () => {
  it("getRate returns 0 when no events exist for clientId", () => {
    const tracker = new CitationTracker();
    expect(tracker.getRate("client-1")).toBe(0);
  });

  it("getRate returns 1 when all events are cited", () => {
    const tracker = new CitationTracker();
    tracker.record({ clientId: "c1", query: "q1", llm: "gpt", cited: true, detectedAt: "2026-05-05" });
    tracker.record({ clientId: "c1", query: "q2", llm: "gpt", cited: true, detectedAt: "2026-05-05" });
    expect(tracker.getRate("c1")).toBe(1);
  });

  it("getRate returns 0.5 when half events are cited", () => {
    const tracker = new CitationTracker();
    tracker.record({ clientId: "c1", query: "q1", llm: "gpt", cited: true, detectedAt: "2026-05-05" });
    tracker.record({ clientId: "c1", query: "q2", llm: "gpt", cited: false, detectedAt: "2026-05-05" });
    expect(tracker.getRate("c1")).toBe(0.5);
  });

  it("isolates events by clientId", () => {
    const tracker = new CitationTracker();
    tracker.record({ clientId: "c1", query: "q", llm: "gpt", cited: true, detectedAt: "2026-05-05" });
    tracker.record({ clientId: "c2", query: "q", llm: "gpt", cited: false, detectedAt: "2026-05-05" });
    expect(tracker.getRate("c1")).toBe(1);
    expect(tracker.getRate("c2")).toBe(0);
  });
});
