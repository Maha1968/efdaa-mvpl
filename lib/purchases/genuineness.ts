import type { Purchase, Token } from "@/types/database";
import {
  BARCODE_MISS_MULTIPLIER,
  MIN_GENUINE_DISTANCE_METERS,
  MIN_GENUINE_TIME_MINUTES,
  PROXIMITY_PENALTY_MULTIPLIER,
  STORE_MISS_MULTIPLIER,
} from "@/config/rewards";
import {
  chainPointsWithPurchase,
  type ChainPoint,
} from "@/lib/purchases/chain";
import { haversineMeters } from "@/lib/geo/haversine";
import type { SignalFlags } from "@/lib/purchases/validation";

export type HopDetail = {
  index: number;
  fromLabel: string;
  toLabel: string;
  distance_m: number | null;
  time_minutes: number | null;
  tooNear: boolean;
  tooFast: boolean;
  /** True only when this is the scoring hop and both thresholds trip. */
  suspicious: boolean;
  /** Originator claim ↔ purchaser token claim — drives proximity score. */
  scoresProximity: boolean;
};

export type GenuinenessResult = {
  genuineness_score: number;
  proximityPenaltyApplied: boolean;
  reasons: string[];
  hops: HopDetail[];
  scoringGap: {
    distance_m: number | null;
    time_minutes: number | null;
  };
};

function hopLabel(index: number, totalChainTokens: number) {
  if (index === 0) return "Originator";
  if (index === totalChainTokens) return "Buyer (purchase)";
  if (index === totalChainTokens - 1) return `Token holder ${index}`;
  return `Person ${index}`;
}

function gapBetween(prev: ChainPoint, next: ChainPoint) {
  let distance_m: number | null = null;
  if (
    prev.lat != null &&
    prev.lng != null &&
    next.lat != null &&
    next.lng != null
  ) {
    distance_m = Number(
      haversineMeters(prev.lat, prev.lng, next.lat, next.lng).toFixed(2),
    );
  }

  const rawMinutes =
    (new Date(next.at).getTime() - new Date(prev.at).getTime()) / 60_000;
  const time_minutes = Number(rawMinutes.toFixed(2));

  const tooNear =
    distance_m != null && distance_m < MIN_GENUINE_DISTANCE_METERS;
  const tooFast = time_minutes >= 0 && time_minutes < MIN_GENUINE_TIME_MINUTES;

  return {
    distance_m,
    time_minutes: time_minutes >= 0 ? time_minutes : null,
    tooNear,
    tooFast,
  };
}

/** Distance/time from originator claim to the redeemed token's claim. */
export function computeOriginatorToBuyerClaimGap(chain: Token[]) {
  if (chain.length === 0) {
    return {
      distance_m: null as number | null,
      time_minutes: null as number | null,
      tooNear: false,
      tooFast: false,
      suspicious: false,
    };
  }

  const originator = chain[0];
  const buyerToken = chain[chain.length - 1];
  const gap = gapBetween(
    {
      lat: originator.claim_lat,
      lng: originator.claim_lng,
      at: originator.created_at,
    },
    {
      lat: buyerToken.claim_lat,
      lng: buyerToken.claim_lng,
      at: buyerToken.created_at,
    },
  );

  return {
    ...gap,
    suspicious: gap.tooNear && gap.tooFast,
  };
}

/**
 * Consecutive claim→claim→purchase hops for display, plus the scoring hop
 * (originator ↔ buyer claim) used for the proximity–time penalty.
 */
export function computeHopDetails(
  points: ChainPoint[],
  chainTokenCount: number,
  scoring?: ReturnType<typeof computeOriginatorToBuyerClaimGap>,
): HopDetail[] {
  const hops: HopDetail[] = [];

  for (let i = 1; i < points.length; i++) {
    const gap = gapBetween(points[i - 1], points[i]);
    hops.push({
      index: i,
      fromLabel: hopLabel(i - 1, chainTokenCount),
      toLabel: hopLabel(i, chainTokenCount),
      distance_m: gap.distance_m,
      time_minutes: gap.time_minutes,
      tooNear: gap.tooNear,
      tooFast: gap.tooFast,
      suspicious: false,
      scoresProximity: false,
    });
  }

  if (scoring) {
    hops.push({
      index: hops.length + 1,
      fromLabel: "Originator",
      toLabel: "Buyer claim (scores)",
      distance_m: scoring.distance_m,
      time_minutes: scoring.time_minutes,
      tooNear: scoring.tooNear,
      tooFast: scoring.tooFast,
      suspicious: scoring.suspicious,
      scoresProximity: true,
    });
  }

  return hops;
}

export function buildDisplayHops(
  chain: Token[],
  purchase: Pick<
    Purchase,
    "purchase_lat" | "purchase_lng" | "created_at" | "receipt_purchased_at"
  >,
  scoring: ReturnType<typeof computeOriginatorToBuyerClaimGap>,
): HopDetail[] {
  return computeHopDetails(
    chainPointsWithPurchase(chain, purchase),
    chain.length,
    scoring,
  );
}

/** SPEC Section 4 Step A — deterministic genuineness score. */
export function computeGenuinenessScore(
  flags: Pick<SignalFlags, "within_window" | "barcode_match" | "store_match">,
  chain: Token[],
  purchase: Pick<
    Purchase,
    "purchase_lat" | "purchase_lng" | "created_at" | "receipt_purchased_at"
  >,
): GenuinenessResult {
  const scoring = computeOriginatorToBuyerClaimGap(chain);
  const hops = buildDisplayHops(chain, purchase, scoring);
  const reasons: string[] = [];
  const scoringGap = {
    distance_m: scoring.distance_m,
    time_minutes: scoring.time_minutes,
  };

  if (!flags.within_window) {
    reasons.push("Outside validity window → score set to 0");
    return {
      genuineness_score: 0,
      proximityPenaltyApplied: false,
      reasons,
      hops,
      scoringGap,
    };
  }

  let score = 1.0;
  reasons.push("Started at 1.0 (within window)");

  if (!flags.barcode_match) {
    score *= BARCODE_MISS_MULTIPLIER;
    reasons.push(
      `Barcode miss × ${BARCODE_MISS_MULTIPLIER} → ${score.toFixed(3)}`,
    );
  } else {
    reasons.push("Barcode matched");
  }

  if (!flags.store_match) {
    score *= STORE_MISS_MULTIPLIER;
    reasons.push(
      `Store miss × ${STORE_MISS_MULTIPLIER} (purchase GPS not within range of originator store) → ${score.toFixed(3)}`,
    );
  } else {
    reasons.push("Store matched (purchase GPS at originator store)");
  }

  if (scoring.suspicious) {
    score *= PROXIMITY_PENALTY_MULTIPLIER;
    reasons.push(
      `Proximity-time penalty × ${PROXIMITY_PENALTY_MULTIPLIER} (originator claim ↔ buyer claim was both <${MIN_GENUINE_DISTANCE_METERS}m and <${MIN_GENUINE_TIME_MINUTES} min) → ${score.toFixed(3)}`,
    );
  } else {
    reasons.push(
      "No proximity-time penalty (originator claim ↔ buyer claim cleared)",
    );
  }

  return {
    genuineness_score: Number(score.toFixed(3)),
    proximityPenaltyApplied: scoring.suspicious,
    reasons,
    hops,
    scoringGap,
  };
}
