interface Props {
  trialEndsAt: string | null;
  tier: string | null;
  status: string | null;
}

export function PlanBadge({ trialEndsAt, tier, status }: Props) {
  if (status === "active" && tier) {
    return <span className="plan-badge">{tier.toUpperCase()}</span>;
  }
  if (trialEndsAt) {
    const daysLeft = Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86400000));
    if (daysLeft > 0) {
      return <span className="plan-badge trial">TRIAL · {daysLeft}d left</span>;
    }
  }
  return <span className="plan-badge expired">TRIAL EXPIRED</span>;
}
