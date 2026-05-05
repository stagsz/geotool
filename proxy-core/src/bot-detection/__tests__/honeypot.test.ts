import { describe, it, expect } from "vitest";
import { isHoneypotRequest, HONEYPOT_PATHS } from "../honeypot";

describe("HONEYPOT_PATHS", () => {
  it("contains at least 10 trap paths", () => {
    expect(HONEYPOT_PATHS.length).toBeGreaterThanOrEqual(10);
  });
});

describe("isHoneypotRequest", () => {
  it("returns true for every path in HONEYPOT_PATHS", () => {
    for (const path of HONEYPOT_PATHS) {
      expect(isHoneypotRequest(path), `Expected ${path} to be a honeypot`).toBe(
        true
      );
    }
  });

  it("returns false for the root path", () => {
    expect(isHoneypotRequest("/")).toBe(false);
  });

  it("returns false for normal content paths", () => {
    expect(isHoneypotRequest("/about")).toBe(false);
    expect(isHoneypotRequest("/blog/my-post")).toBe(false);
    expect(isHoneypotRequest("/products/widget")).toBe(false);
    expect(isHoneypotRequest("/contact")).toBe(false);
  });

  it("returns false for partial matches (not exact path)", () => {
    expect(isHoneypotRequest("/.env.backup/extra")).toBe(false);
    expect(isHoneypotRequest("/data/export.json/subpath")).toBe(false);
  });
});
