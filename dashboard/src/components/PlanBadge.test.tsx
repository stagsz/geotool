import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PlanBadge } from "./PlanBadge";

const FUTURE = new Date(Date.now() + 5 * 86400000).toISOString();
const PAST = new Date(Date.now() - 86400000).toISOString();

describe("PlanBadge", () => {
  it("shows tier name when subscription is active", () => {
    render(<PlanBadge trialEndsAt={PAST} tier="growth" status="active" />);
    expect(screen.getByText("GROWTH")).toBeInTheDocument();
  });

  it("shows trial countdown when trial is active", () => {
    render(<PlanBadge trialEndsAt={FUTURE} tier={null} status={null} />);
    expect(screen.getByText(/TRIAL/)).toBeInTheDocument();
    expect(screen.getByText(/5d left/)).toBeInTheDocument();
  });

  it("shows TRIAL EXPIRED when trial ended and no subscription", () => {
    render(<PlanBadge trialEndsAt={PAST} tier={null} status={null} />);
    expect(screen.getByText("TRIAL EXPIRED")).toBeInTheDocument();
  });
});
