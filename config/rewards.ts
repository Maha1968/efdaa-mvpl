/**
 * Reward pool configuration — tune payouts here without touching app logic.
 * See SPEC.md Section 4.
 */
export const REWARD_CONFIG = {
  /** Default offer base reward (e.g. 0.05 = 5% of purchase amount) */
  defaultBaseRewardPct: 0.05,
  roleWeights: {
    buyer: 4,
    last_referrer: 3,
    originator: 2,
    forwarder: 1,
  },
} as const;

/** Maximum token chain depth (0 = originator → 4 = 5th person). */
export const MAX_TOKEN_DEPTH = 4;
