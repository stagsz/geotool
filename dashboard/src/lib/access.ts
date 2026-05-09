interface AccessInput {
  trialEndsAt: string | null;
  subscriptionStatus: string | null;
}

export function isAccessGranted({ trialEndsAt, subscriptionStatus }: AccessInput): boolean {
  if (subscriptionStatus === "active") return true;
  if (trialEndsAt && new Date(trialEndsAt) > new Date()) return true;
  return false;
}
