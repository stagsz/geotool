import { describe, it, expect } from "vitest";
import { AnomalyDetector } from "./anomaly-detector";

describe("AnomalyDetector", () => {
  const detector = new AnomalyDetector();

  describe("detectIpRangeChange", () => {
    it("returns true when change exceeds 10%", () => {
      expect(detector.detectIpRangeChange(100, 115)).toBe(true);
    });

    it("returns false when change is exactly 10%", () => {
      expect(detector.detectIpRangeChange(100, 110)).toBe(false);
    });

    it("returns true when decrease exceeds 10%", () => {
      expect(detector.detectIpRangeChange(100, 85)).toBe(true);
    });

    it("returns false when change is within 10%", () => {
      expect(detector.detectIpRangeChange(100, 105)).toBe(false);
    });

    it("returns true when previous is 0 and current is positive", () => {
      expect(detector.detectIpRangeChange(0, 1)).toBe(true);
    });
  });

  describe("detectCitationDrop", () => {
    it("returns true when drop is exactly 20%", () => {
      // (5 - 4) / 5 = 1/5 = 0.2 exactly in IEEE 754
      expect(detector.detectCitationDrop(5, 4)).toBe(true);
    });

    it("returns true when drop exceeds 20%", () => {
      expect(detector.detectCitationDrop(0.5, 0.3)).toBe(true);
    });

    it("returns false when drop is less than 20%", () => {
      expect(detector.detectCitationDrop(0.5, 0.45)).toBe(false);
    });

    it("returns false when previous is 0", () => {
      expect(detector.detectCitationDrop(0, 0)).toBe(false);
    });
  });
});
