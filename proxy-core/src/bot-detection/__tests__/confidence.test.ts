import { describe, it, expect } from "vitest";
import { calculateConfidence } from "../confidence-scorer";

describe("calculateConfidence", () => {
  it("scores 100 when all factors are true", () => {
    const result = calculateConfidence({
      uaMatch: true,
      ipInRange: true,
      ptrVerified: true,
      behaviorNormal: true,
    });
    expect(result.score).toBe(100);
    expect(result.verified).toBe(true);
  });

  it("scores 70 with UA + IP match — exactly at verified threshold", () => {
    const result = calculateConfidence({
      uaMatch: true,
      ipInRange: true,
      ptrVerified: false,
      behaviorNormal: false,
    });
    expect(result.score).toBe(70);
    expect(result.verified).toBe(true);
  });

  it("scores 30 with UA match only — below threshold", () => {
    const result = calculateConfidence({
      uaMatch: true,
      ipInRange: false,
      ptrVerified: false,
      behaviorNormal: false,
    });
    expect(result.score).toBe(30);
    expect(result.verified).toBe(false);
  });

  it("scores 0 for no factors — unverified", () => {
    const result = calculateConfidence({
      uaMatch: false,
      ipInRange: false,
      ptrVerified: false,
      behaviorNormal: false,
    });
    expect(result.score).toBe(0);
    expect(result.verified).toBe(false);
  });

  it("scores 40 for IP only (spoofed UA)", () => {
    const result = calculateConfidence({
      uaMatch: false,
      ipInRange: true,
      ptrVerified: false,
      behaviorNormal: false,
    });
    expect(result.score).toBe(40);
    expect(result.verified).toBe(false);
  });

  it("scores 80 with UA + IP + PTR", () => {
    const result = calculateConfidence({
      uaMatch: true,
      ipInRange: true,
      ptrVerified: true,
      behaviorNormal: false,
    });
    expect(result.score).toBe(90);
    expect(result.verified).toBe(true);
  });

  it("returns factors unchanged in result", () => {
    const factors = {
      uaMatch: true,
      ipInRange: false,
      ptrVerified: true,
      behaviorNormal: false,
    };
    const result = calculateConfidence(factors);
    expect(result.factors).toEqual(factors);
  });
});
