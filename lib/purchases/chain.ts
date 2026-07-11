import type { Purchase, Token } from "@/types/database";
import { haversineMeters } from "@/lib/geo/haversine";

export type ChainPoint = {
  lat: number | null;
  lng: number | null;
  at: string;
};

/** Walk parent_token_id upward from the redeemed token to the root. */
export async function buildTokenChain(
  token: Token,
  fetchParent: (parentId: string) => Promise<Token | null>,
): Promise<Token[]> {
  const chain: Token[] = [token];
  let current = token;

  while (current.parent_token_id) {
    const parent = await fetchParent(current.parent_token_id);
    if (!parent) break;
    chain.unshift(parent);
    current = parent;
  }

  return chain;
}

export function chainPointsWithPurchase(
  chain: Token[],
  purchase: Pick<
    Purchase,
    "purchase_lat" | "purchase_lng" | "created_at" | "receipt_purchased_at"
  >,
): ChainPoint[] {
  const points: ChainPoint[] = chain.map((t) => ({
    lat: t.claim_lat,
    lng: t.claim_lng,
    at: t.created_at,
  }));

  points.push({
    lat: purchase.purchase_lat,
    lng: purchase.purchase_lng,
    at: purchase.receipt_purchased_at ?? purchase.created_at,
  });

  return points;
}

/** Smallest distance and time gap between any two consecutive people in the chain. */
export function computeMinHopStats(points: ChainPoint[]) {
  let minDistance = Infinity;
  let minTimeMinutes = Infinity;

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const next = points[i];

    if (
      prev.lat != null &&
      prev.lng != null &&
      next.lat != null &&
      next.lng != null
    ) {
      minDistance = Math.min(
        minDistance,
        haversineMeters(prev.lat, prev.lng, next.lat, next.lng),
      );
    }

    const gapMinutes =
      (new Date(next.at).getTime() - new Date(prev.at).getTime()) / 60_000;
    if (gapMinutes >= 0) {
      minTimeMinutes = Math.min(minTimeMinutes, gapMinutes);
    }
  }

  return {
    min_hop_distance_m:
      minDistance === Infinity ? null : Number(minDistance.toFixed(2)),
    min_hop_time_minutes:
      minTimeMinutes === Infinity ? null : Number(minTimeMinutes.toFixed(2)),
  };
}
