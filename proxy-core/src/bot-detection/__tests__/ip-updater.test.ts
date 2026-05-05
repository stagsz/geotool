import { describe, it, expect } from "vitest";
import { isIpInCidr } from "../ip-updater";

describe("isIpInCidr", () => {
  it("returns true when IP is in a /24 range", () => {
    expect(isIpInCidr("192.168.1.5", "192.168.1.0/24")).toBe(true);
    expect(isIpInCidr("192.168.1.254", "192.168.1.0/24")).toBe(true);
    expect(isIpInCidr("192.168.1.0", "192.168.1.0/24")).toBe(true);
  });

  it("returns false when IP is outside a /24 range", () => {
    expect(isIpInCidr("10.0.0.1", "192.168.1.0/24")).toBe(false);
    expect(isIpInCidr("192.168.2.1", "192.168.1.0/24")).toBe(false);
  });

  it("handles high-value IPs (192.x.x.x range) without overflow", () => {
    expect(isIpInCidr("192.168.1.100", "192.168.0.0/16")).toBe(true);
    expect(isIpInCidr("192.168.255.255", "192.168.0.0/16")).toBe(true);
    expect(isIpInCidr("192.169.0.1", "192.168.0.0/16")).toBe(false);
  });

  it("handles /8 ranges", () => {
    expect(isIpInCidr("10.0.0.1", "10.0.0.0/8")).toBe(true);
    expect(isIpInCidr("10.255.255.255", "10.0.0.0/8")).toBe(true);
    expect(isIpInCidr("11.0.0.1", "10.0.0.0/8")).toBe(false);
  });

  it("handles /32 exact-match CIDR", () => {
    expect(isIpInCidr("192.168.1.0", "192.168.1.0/32")).toBe(true);
    expect(isIpInCidr("192.168.1.1", "192.168.1.0/32")).toBe(false);
  });

  it("handles /0 (matches everything)", () => {
    expect(isIpInCidr("1.2.3.4", "0.0.0.0/0")).toBe(true);
    expect(isIpInCidr("255.255.255.255", "0.0.0.0/0")).toBe(true);
  });
});
