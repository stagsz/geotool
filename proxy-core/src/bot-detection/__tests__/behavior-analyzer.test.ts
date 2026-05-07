import { describe, it, expect } from "vitest";
import { analyzeBehavior } from "../behavior-analyzer";

const makeRequest = (headers: Record<string, string>) =>
  new Request("https://example.com/page", { headers });

describe("analyzeBehavior", () => {
  it("returns behaviorNormal=true for a clean crawler request", () => {
    const result = analyzeBehavior(
      makeRequest({
        "user-agent": "GPTBot/1.0",
        accept: "*/*",
      })
    );
    expect(result.behaviorNormal).toBe(true);
    expect(result.signals).toHaveLength(0);
  });

  it("detects sec-fetch-mode as a browser-headers-present signal", () => {
    const result = analyzeBehavior(
      makeRequest({
        "user-agent": "GPTBot/1.0",
        "sec-fetch-mode": "navigate",
        "sec-fetch-site": "none",
      })
    );
    expect(result.behaviorNormal).toBe(false);
    expect(result.signals).toContain("browser-headers-present");
  });

  it("detects sec-fetch-site alone as browser-headers-present", () => {
    const result = analyzeBehavior(
      makeRequest({ "sec-fetch-site": "same-origin" })
    );
    expect(result.behaviorNormal).toBe(false);
    expect(result.signals).toContain("browser-headers-present");
  });

  it("detects image/webp in Accept as full-browser-accept", () => {
    const result = analyzeBehavior(
      makeRequest({
        "user-agent": "GPTBot/1.0",
        accept: "text/html,application/xhtml+xml,image/webp,*/*;q=0.8",
      })
    );
    expect(result.behaviorNormal).toBe(false);
    expect(result.signals).toContain("full-browser-accept");
  });

  it("detects image/avif in Accept as full-browser-accept", () => {
    const result = analyzeBehavior(
      makeRequest({ accept: "text/html,image/avif,*/*" })
    );
    expect(result.behaviorNormal).toBe(false);
    expect(result.signals).toContain("full-browser-accept");
  });

  it("detects regional Accept-Language as a soft signal but does not fail behaviorNormal alone", () => {
    const result = analyzeBehavior(
      makeRequest({ "accept-language": "en-US,en;q=0.9" })
    );
    expect(result.signals).toContain("regional-accept-language");
    // regional-accept-language is not a strong browser signal on its own
    expect(result.behaviorNormal).toBe(true);
  });

  it("detects referer as a soft signal but does not fail behaviorNormal alone", () => {
    const result = analyzeBehavior(
      makeRequest({ referer: "https://example.com/" })
    );
    expect(result.signals).toContain("referer-present");
    expect(result.behaviorNormal).toBe(true);
  });

  it("returns behaviorNormal=false when both sec-fetch and regional Accept-Language present", () => {
    const result = analyzeBehavior(
      makeRequest({
        "sec-fetch-mode": "navigate",
        "accept-language": "en-US,en;q=0.9",
        referer: "https://google.com/",
        accept: "text/html,image/webp,*/*",
      })
    );
    expect(result.behaviorNormal).toBe(false);
    expect(result.signals).toContain("browser-headers-present");
    expect(result.signals).toContain("regional-accept-language");
    expect(result.signals).toContain("referer-present");
    expect(result.signals).toContain("full-browser-accept");
  });

  it("accepts plain Accept header without browser image formats", () => {
    const result = analyzeBehavior(
      makeRequest({ accept: "text/html,application/xhtml+xml,*/*;q=0.8" })
    );
    expect(result.signals).not.toContain("full-browser-accept");
    expect(result.behaviorNormal).toBe(true);
  });
});
