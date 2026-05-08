import { describe, it, expect } from "vitest";
import { isAccessGranted } from "./access";

describe("isAccessGranted", () => {
  const FUTURE = new Date(Date.now() + 86400000).toISOString();
  const PAST = new Date(Date.now() - 86400000).toISOString();

  it("grants access when subscription is active", () => {
    expect(isAccessGranted({ trialEndsAt: PAST, subscriptionStatus: "active" })).toBe(true);
  });

  it("grants access when trial has not expired", () => {
    expect(isAccessGranted({ trialEndsAt: FUTURE, subscriptionStatus: null })).toBe(true);
  });

  it("grants access when trial active and subscription cancelled", () => {
    expect(isAccessGranted({ trialEndsAt: FUTURE, subscriptionStatus: "cancelled" })).toBe(true);
  });

  it("denies access when trial expired and no subscription", () => {
    expect(isAccessGranted({ trialEndsAt: PAST, subscriptionStatus: null })).toBe(false);
  });

  it("denies access when trial expired and subscription cancelled", () => {
    expect(isAccessGranted({ trialEndsAt: PAST, subscriptionStatus: "cancelled" })).toBe(false);
  });

  it("denies access when trialEndsAt is null and no subscription", () => {
    expect(isAccessGranted({ trialEndsAt: null, subscriptionStatus: null })).toBe(false);
  });
});
