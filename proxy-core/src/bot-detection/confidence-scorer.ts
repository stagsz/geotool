export interface ConfidenceFactors {
  uaMatch: boolean;
  ipInRange: boolean;
  ptrVerified: boolean;
  behaviorNormal: boolean;
}

export interface ConfidenceResult {
  score: number;
  verified: boolean;
  factors: ConfidenceFactors;
}

const WEIGHTS = {
  uaMatch: 30,
  ipInRange: 40,
  ptrVerified: 20,
  behaviorNormal: 10,
} as const;

const VERIFIED_THRESHOLD = 70;

export function calculateConfidence(
  factors: ConfidenceFactors
): ConfidenceResult {
  const score =
    (factors.uaMatch ? WEIGHTS.uaMatch : 0) +
    (factors.ipInRange ? WEIGHTS.ipInRange : 0) +
    (factors.ptrVerified ? WEIGHTS.ptrVerified : 0) +
    (factors.behaviorNormal ? WEIGHTS.behaviorNormal : 0);

  return {
    score,
    verified: score >= VERIFIED_THRESHOLD,
    factors,
  };
}
