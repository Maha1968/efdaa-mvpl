import type { Purchase, Token } from "@/types/database";
import {
  BARCODE_MISS_MULTIPLIER,
  MIN_GENUINE_DISTANCE_METERS,
  MIN_GENUINE_TIME_MINUTES,
  PROXIMITY_PENALTY_MULTIPLIER,
  STORE_MISS_MULTIPLIER,
} from "@/config/rewards";

/** Human-readable reasons for a stored genuineness_score (from purchase flags). */
export function explainGenuineness(purchase: Purchase): string[] {
  const reasons: string[] = [];

  if (purchase.within_window === false) {
    return [
      "Outside validity window → score set to 0",
      "Pilot floor: ZERO_SCORE_FLOOR_REWARD_PCT of purchase still paid when scored pool is 0",
    ];
  }

  reasons.push("Started at 1.0 (within window)");

  if (purchase.barcode_match === false) {
    reasons.push(`Barcode miss × ${BARCODE_MISS_MULTIPLIER}`);
  } else if (purchase.barcode_match === true) {
    reasons.push("Barcode matched");
  }

  if (purchase.store_match === false) {
    reasons.push(`Store miss × ${STORE_MISS_MULTIPLIER}`);
  } else if (purchase.store_match === true) {
    reasons.push("Store matched");
  }

  const near =
    purchase.min_hop_distance_m != null &&
    purchase.min_hop_distance_m < MIN_GENUINE_DISTANCE_METERS;
  const fast =
    purchase.min_hop_time_minutes != null &&
    purchase.min_hop_time_minutes < MIN_GENUINE_TIME_MINUTES;

  if (near && fast) {
    reasons.push(
      `Proximity-time penalty × ${PROXIMITY_PENALTY_MULTIPLIER} (min hop ${purchase.min_hop_distance_m}m / ${purchase.min_hop_time_minutes} min)`,
    );
  } else {
    reasons.push("No proximity-time penalty");
  }

  reasons.push(`Final score: ${Number(purchase.genuineness_score ?? 0).toFixed(3)}`);
  return reasons;
}

export type ChainPerson = {
  depth: number;
  roleLabel: string;
  tokenCode: string;
  userName: string;
  userId: string;
  claimLat: number | null;
  claimLng: number | null;
  claimLocationText: string | null;
  createdAt: string;
  expiresAt: string;
};

export function labelChainRole(
  index: number,
  chainLength: number,
  holderUserId: string,
  buyerUserId?: string | null,
) {
  if (index === 0) return "Originator";
  if (buyerUserId && holderUserId === buyerUserId) return "Buyer";
  if (index === chainLength - 1) return "Last referrer / holder";
  return "Forwarder";
}

export function mapChainPeople(
  chain: Token[],
  namesById: Record<string, string>,
  buyerUserId?: string | null,
): ChainPerson[] {
  return chain.map((token, index) => ({
    depth: token.depth,
    roleLabel: labelChainRole(index, chain.length, token.holder_user_id, buyerUserId),
    tokenCode: token.code,
    userName: namesById[token.holder_user_id] || "Unknown",
    userId: token.holder_user_id,
    claimLat: token.claim_lat,
    claimLng: token.claim_lng,
    claimLocationText: token.claim_location_text,
    createdAt: token.created_at,
    expiresAt: token.expires_at,
  }));
}
