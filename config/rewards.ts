/**
 * EFDAA tunable configuration — the single place to change payout & genuineness rules.
 * See SPEC.md Section 4. Changing these numbers changes app behaviour without touching logic.
 */

/** Maximum token chain depth (0 = originator → 4 = 5th person → chain of 5). */
export const MAX_TOKEN_DEPTH = 4;

/** How long a whole chain stays valid after the originator creates it. */
export const TOKEN_VALIDITY_HOURS = 24;

/** Default offer base reward (0.05 = 5% of purchase amount). Also stored per offer. */
export const DEFAULT_BASE_REWARD_PCT = 0.05;

/**
 * Pilot floor: when genuineness_score is 0 (or the scored pool is 0), still pay this
 * fraction of purchase amount (0.001 = 0.1%). Tunable post-launch.
 */
export const ZERO_SCORE_FLOOR_REWARD_PCT = 0.001;

/** Decimal places for stored/displayed reward amounts (points). Tunable post-launch. */
export const REWARD_DISPLAY_DECIMALS = 2;

/** Genuineness score multipliers (applied to a base of 1.0). */
export const BARCODE_MISS_MULTIPLIER = 0.5;
export const STORE_MISS_MULTIPLIER = 0.7;
export const PROXIMITY_PENALTY_MULTIPLIER = 0.4;

/** Anti-collusion: originator claim ↔ purchaser token claim. Penalty if BOTH
 *  nearer than this AND faster than the time threshold. */
export const MIN_GENUINE_DISTANCE_METERS = 1000;
export const MIN_GENUINE_TIME_MINUTES = 60;

/** Reward split weights by role. The ends of the chain earn the most. */
export const ROLE_WEIGHTS = {
  buyer: 4,
  last_referrer: 3,
  originator: 2,
  forwarder: 1,
} as const;
