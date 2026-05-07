import { describe, it, expect } from "vitest";
import { isHoneypotRequest, HONEYPOT_PATHS, HONEYPOT_PREFIXES } from "../honeypot";

describe("HONEYPOT_PATHS", () => {
  it("contains at least 30 trap paths", () => {
    expect(HONEYPOT_PATHS.length).toBeGreaterThanOrEqual(30);
  });
});

describe("HONEYPOT_PREFIXES", () => {
  it("contains at least 4 prefix traps", () => {
    expect(HONEYPOT_PREFIXES.length).toBeGreaterThanOrEqual(4);
  });

  it("all prefixes end with /", () => {
    for (const prefix of HONEYPOT_PREFIXES) {
      expect(prefix.endsWith("/"), `Prefix ${prefix} should end with /`).toBe(true);
    }
  });
});

describe("isHoneypotRequest", () => {
  it("returns true for every path in HONEYPOT_PATHS", () => {
    for (const path of HONEYPOT_PATHS) {
      expect(isHoneypotRequest(path), `Expected ${path} to be a honeypot`).toBe(true);
    }
  });

  it("returns true for sub-paths under each HONEYPOT_PREFIX", () => {
    for (const prefix of HONEYPOT_PREFIXES) {
      const sub = `${prefix}deep/nested/file.txt`;
      expect(isHoneypotRequest(sub), `Expected ${sub} to be a honeypot`).toBe(true);
    }
  });

  it("returns true for /.git/ sub-paths", () => {
    expect(isHoneypotRequest("/.git/HEAD")).toBe(true);
    expect(isHoneypotRequest("/.git/refs/heads/main")).toBe(true);
  });

  it("returns true for /llm-data/ sub-paths", () => {
    expect(isHoneypotRequest("/llm-data/corpus.jsonl")).toBe(true);
    expect(isHoneypotRequest("/llm-data/2024/batch-01.jsonl")).toBe(true);
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

  it("returns false for partial exact-path matches (path continues beyond trap path)", () => {
    expect(isHoneypotRequest("/.env.backup/extra")).toBe(false);
    expect(isHoneypotRequest("/data/export.json/subpath")).toBe(false);
  });

  it("returns false for paths that only share a prefix word but not the honeypot prefix", () => {
    expect(isHoneypotRequest("/llm-dashboard")).toBe(false);
    expect(isHoneypotRequest("/ai-training-results")).toBe(false);
  });
});
