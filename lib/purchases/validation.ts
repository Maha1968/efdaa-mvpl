import type { Product, Purchase, Store, Token } from "@/types/database";
import {
  buildTokenChain,
  chainPointsWithPurchase,
  computeMinHopStats,
} from "@/lib/purchases/chain";
import { haversineMeters } from "@/lib/geo/haversine";

/** Max distance (metres) from store GPS for store_match in the pilot. */
export const STORE_MATCH_MAX_DISTANCE_M = 500;

export type SignalFlags = {
  barcode_match: boolean;
  store_match: boolean;
  within_window: boolean;
  time_to_purchase_hours: number;
  min_hop_distance_m: number | null;
  min_hop_time_minutes: number | null;
};

function normalizeBarcode(value: string) {
  return value.replace(/\s+/g, "").trim();
}

export async function computePurchaseSignalFlags(input: {
  purchase: Purchase;
  token: Token;
  product: Product;
  store: Store | null;
  fetchParentToken: (parentId: string) => Promise<Token | null>;
}): Promise<SignalFlags> {
  const { purchase, token, product, store, fetchParentToken } = input;

  const chain = await buildTokenChain(token, fetchParentToken);
  const root = chain[0];

  const timeToPurchaseHours = Number(
    (
      (new Date(purchase.created_at).getTime() -
        new Date(root.created_at).getTime()) /
      3_600_000
    ).toFixed(2),
  );

  const within_window =
    new Date(purchase.created_at).getTime() <=
    new Date(token.expires_at).getTime();

  const barcode_match =
    normalizeBarcode(purchase.receipt_barcode ?? "") ===
    normalizeBarcode(product.barcode);

  let store_match = false;
  if (
    store?.lat != null &&
    store?.lng != null &&
    purchase.purchase_lat != null &&
    purchase.purchase_lng != null
  ) {
    store_match =
      haversineMeters(
        purchase.purchase_lat,
        purchase.purchase_lng,
        store.lat,
        store.lng,
      ) <= STORE_MATCH_MAX_DISTANCE_M;
  }

  const hopStats = computeMinHopStats(
    chainPointsWithPurchase(chain, purchase),
  );

  return {
    barcode_match,
    store_match,
    within_window,
    time_to_purchase_hours: timeToPurchaseHours,
    min_hop_distance_m: hopStats.min_hop_distance_m,
    min_hop_time_minutes: hopStats.min_hop_time_minutes,
  };
}
