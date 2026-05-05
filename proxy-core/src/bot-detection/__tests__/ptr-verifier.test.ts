import { describe, it, expect, vi } from "vitest";
import { verifyPtr } from "../ptr-verifier";

const mockFetcher = (answer: Array<{ type: number; data: string }>, ok = true): typeof fetch =>
  vi.fn().mockResolvedValue({
    ok,
    json: () => Promise.resolve({ Answer: answer }),
  }) as unknown as typeof fetch;

describe("verifyPtr", () => {
  it("returns true when PTR record matches expected domain", async () => {
    const fetcher = mockFetcher([{ type: 12, data: "crawl-66-249-66-1.googlebot.com." }]);
    expect(await verifyPtr("66.249.66.1", "googlebot.com", fetcher)).toBe(true);
  });

  it("returns true when PTR record equals expected domain exactly", async () => {
    const fetcher = mockFetcher([{ type: 12, data: "googlebot.com." }]);
    expect(await verifyPtr("66.249.66.1", "googlebot.com", fetcher)).toBe(true);
  });

  it("returns false when PTR record does not match expected domain", async () => {
    const fetcher = mockFetcher([{ type: 12, data: "some-other-host.example.com." }]);
    expect(await verifyPtr("66.249.66.1", "googlebot.com", fetcher)).toBe(false);
  });

  it("returns false when Answer contains no PTR records (type != 12)", async () => {
    const fetcher = mockFetcher([{ type: 1, data: "66.249.66.1" }]);
    expect(await verifyPtr("66.249.66.1", "googlebot.com", fetcher)).toBe(false);
  });

  it("returns false when Answer is empty", async () => {
    const fetcher = mockFetcher([]);
    expect(await verifyPtr("66.249.66.1", "googlebot.com", fetcher)).toBe(false);
  });

  it("returns false when response is not ok", async () => {
    const fetcher = mockFetcher([], false);
    expect(await verifyPtr("66.249.66.1", "googlebot.com", fetcher)).toBe(false);
  });

  it("returns false when fetcher throws", async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error("timeout")) as unknown as typeof fetch;
    expect(await verifyPtr("66.249.66.1", "googlebot.com", fetcher)).toBe(false);
  });

  it("returns false for empty IP", async () => {
    const fetcher = mockFetcher([{ type: 12, data: "host.googlebot.com." }]);
    expect(await verifyPtr("", "googlebot.com", fetcher)).toBe(false);
  });

  it("returns false for non-IPv4 input", async () => {
    const fetcher = mockFetcher([{ type: 12, data: "host.googlebot.com." }]);
    expect(await verifyPtr("not-an-ip", "googlebot.com", fetcher)).toBe(false);
  });

  it("sends request with reversed IP in-addr.arpa format", async () => {
    const fetcher = mockFetcher([]) as ReturnType<typeof vi.fn>;
    await verifyPtr("1.2.3.4", "example.com", fetcher as unknown as typeof fetch);
    const calledUrl = (fetcher as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(calledUrl).toContain("4.3.2.1.in-addr.arpa");
  });
});
