import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchRendered } from "./render-client";

describe("fetchRendered", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns null when renderServiceUrl is empty string", async () => {
    expect(await fetchRendered("https://example.com", "")).toBeNull();
  });

  it("returns HTML string on 200 response", async () => {
    vi.mocked(fetch).mockResolvedValue({
      status: 200,
      text: () => Promise.resolve("<html>ok</html>"),
    } as Response);
    const result = await fetchRendered(
      "https://example.com",
      "http://render:3001"
    );
    expect(result).toBe("<html>ok</html>");
  });

  it("returns null on non-200 response", async () => {
    vi.mocked(fetch).mockResolvedValue({
      status: 202,
      text: () => Promise.resolve("Accepted"),
    } as Response);
    expect(
      await fetchRendered("https://example.com", "http://render:3001")
    ).toBeNull();
  });

  it("returns null on network error", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("network error"));
    expect(
      await fetchRendered("https://example.com", "http://render:3001")
    ).toBeNull();
  });
});
