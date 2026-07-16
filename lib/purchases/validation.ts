import type { Product, Purchase, Store, Token } from "@/types/database";
import type { BarcodeMatchStatus } from "@/config/categories";
import { STORE_MATCH_MAX_DISTANCE_M } from "@/config/rewards";
import { buildTokenChain } from "@/lib/purchases/chain";
import { resolveBarcodeMatch } from "@/lib/purchases/barcode-match";
import { computeOriginatorToBuyerClaimGap } from "@/lib/purchases/genuineness";
import { haversineMeters } from "@/lib/geo/haversine";

export { STORE_MATCH_MAX_DISTANCE_M };

export type SignalFlags = {
  barcode_match: BarcodeMatchStatus;
  store_match: boolean;
  within_window: boolean;
  time_to_purchase_hours: number;
  min_hop_distance_m: number | null;
  min_hop_time_minutes: number | null;
};

/** Receipt timestamp when present; otherwise row created_at (legacy). */
export function purchaseEventTime(purchase: Purchase): Date {
  if (purchase.receipt_purchased_at) {
    return new Date(purchase.receipt_purchased_at);
  }
  return new Date(purchase.created_at);
}

export async function computePurchaseSignalFlags(input: {
  purchase: Purchase;
  token: Token;
  product: Product | null;
  /** Originator's partner store — purchase GPS is scored against this. */
  originatorStore: Store | null;
  fetchParentToken: (parentId: string) => Promise<Token | null>;
}): Promise<SignalFlags> {
  const { purchase, token, product, originatorStore, fetchParentToken } = input;

  const chain = await buildTokenChain(token, fetchParentToken);
  const root = chain[0];
  const purchasedAt = purchaseEventTime(purchase);

  const timeToPurchaseHours = Number(
    (
      (purchasedAt.getTime() - new Date(root.created_at).getTime()) /
      3_600_000
    ).toFixed(2),
  );

  const within_window =
    purchasedAt.getTime() <= new Date(token.expires_at).getTime();

  // Tri-state: not_provided when token has no barcode → no genuineness penalty.
  const barcode_match = resolveBarcodeMatch({
    tokenScannedBarcode: root.scanned_barcode ?? token.scanned_barcode,
    receiptBarcode: purchase.receipt_barcode,
    productBarcode: product?.barcode,
  });

  // store_match: purchase GPS within STORE_MATCH_MAX_DISTANCE_M of originator store.
  let store_match = false;
  if (
    originatorStore?.lat != null &&
    originatorStore?.lng != null &&
    purchase.purchase_lat != null &&
    purchase.purchase_lng != null
  ) {
    const atOriginatorStore =
      !originatorStore.id ||
      !purchase.store_id ||
      purchase.store_id === originatorStore.id;
    store_match =
      atOriginatorStore &&
      haversineMeters(
        purchase.purchase_lat,
        purchase.purchase_lng,
        originatorStore.lat,
        originatorStore.lng,
      ) <= STORE_MATCH_MAX_DISTANCE_M;
  }

  const scoringGap = computeOriginatorToBuyerClaimGap(chain);

  return {
    barcode_match,
    store_match,
    within_window,
    time_to_purchase_hours: timeToPurchaseHours,
    min_hop_distance_m: scoringGap.distance_m,
    min_hop_time_minutes: scoringGap.time_minutes,
  };
}
