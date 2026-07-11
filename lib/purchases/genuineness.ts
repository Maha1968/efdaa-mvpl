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
  suspicious: boolean;
};

export type GenuinenessResult = {
  genuineness_score: number;
  proximityPenaltyApplied: boolean;
  reasons: string[];
  hops: HopDetail[];
};

function hopLabel(index: number, totalChainTokens: number) {
  if (index === 0) return "Originator";
  if (index === totalChainTokens) return "Buyer (purchase)";
  if (index === totalChainTokens - 1) return `Token holder ${index}`;
  return `Person ${index}`;
}

export function computeHopDetails(
  points: ChainPoint[],
  chainTokenCount: number,
): HopDetail[] {
  const hops: HopDetail[] = [];

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const next = points[i];

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

    const time_minutes = Number(
      (
        (new Date(next.at).getTime() - new Date(prev.at).getTime()) /
        60_000
      ).toFixed(2),
    );

    const tooNear =
      distance_m != null && distance_m < MIN_GENUINE_DISTANCE_METERS;
    const tooFast = time_minutes >= 0 && time_minutes < MIN_GENUINE_TIME_MINUTES;
    const suspicious = tooNear && tooFast;

    hops.push({
      index: i,
      fromLabel: hopLabel(i - 1, chainTokenCount),
      toLabel: hopLabel(i, chainTokenCount),
      distance_m,
      time_minutes: time_minutes >= 0 ? time_minutes : null,
      tooNear,
      tooFast,
      suspicious,
    });
  }

  return hops;
}

/** SPEC Section 4 Step A — deterministic genuineness score. */
export function computeGenuinenessScore(
  flags: Pick<SignalFlags, "within_window" | "barcode_match" | "store_match">,
  chain: Token[],
  purchase: Pick<Purchase, "purchase_lat" | "purchase_lng" | "created_at">,
): GenuinenessResult {
  const points = chainPointsWithPurchase(chain, purchase);
  const hops = computeHopDetails(points, chain.length);
  const reasons: string[] = [];

  if (!flags.within_window) {
    reasons.push("Outside validity window → score set to 0");
    return {
      genuineness_score: 0,
      proximityPenaltyApplied: false,
      reasons,
      hops,
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
      `Store miss × ${STORE_MISS_MULTIPLIER} → ${score.toFixed(3)}`,
    );
  } else {
    reasons.push("Store matched (within range)");
  }

  const proximityPenaltyApplied = hops.some((h) => h.suspicious);
  if (proximityPenaltyApplied) {
    score *= PROXIMITY_PENALTY_MULTIPLIER;
    reasons.push(
      `Proximity-time penalty × ${PROXIMITY_PENALTY_MULTIPLIER} (a hop was both <${MIN_GENUINE_DISTANCE_METERS}m and <${MIN_GENUINE_TIME_MINUTES} min) → ${score.toFixed(3)}`,
    );
  } else {
    reasons.push("No proximity-time penalty");
  }

  return {
    genuineness_score: Number(score.toFixed(3)),
    proximityPenaltyApplied,
    reasons,
    hops,
  };
}
