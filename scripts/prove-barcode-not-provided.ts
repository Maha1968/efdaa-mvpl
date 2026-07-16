/**
 * Prove: no barcode on token → barcode_match = not_provided → score 1.00
 * (BARCODE_MISS_MULTIPLIER must not apply).
 *
 * Run: npx tsx scripts/prove-barcode-not-provided.ts
 */
import { computeGenuinenessScore } from "../lib/purchases/genuineness";
import { resolveBarcodeMatch } from "../lib/purchases/barcode-match";
import type { Token } from "../types/database";

const originator = {
  id: "o",
  code: "O",
  holder_user_id: "u1",
  parent_token_id: null,
  root_token_id: "o",
  depth: 0,
  product_id: null,
  offer_id: "off",
  scanned_barcode: null,
  product_photo_url: null,
  barcode_photo_url: null,
  claim_lat: 12.93522,
  claim_lng: 77.62448,
  claim_location_text: "Store",
  originator_store_id: "s1",
  category: "Food & Grocery",
  store_name_text: null,
  store_resolution: "matched",
  store_signage_photo_url: null,
  expires_at: new Date(Date.now() + 86_400_000).toISOString(),
  created_at: new Date(Date.now() - 8 * 3_600_000).toISOString(),
} as Token;

const buyer = {
  ...originator,
  id: "b",
  code: "B",
  holder_user_id: "u2",
  parent_token_id: "o",
  depth: 1,
  scanned_barcode: null,
  claim_lat: 12.9166,
  claim_lng: 77.6101,
  claim_location_text: "BTM",
  created_at: new Date().toISOString(),
} as Token;

const barcodeStatus = resolveBarcodeMatch({
  tokenScannedBarcode: null,
  receiptBarcode: "890100ANYTHING",
});

const result = computeGenuinenessScore(
  {
    within_window: true,
    barcode_match: barcodeStatus,
    store_match: true,
  },
  [originator, buyer],
  {
    purchase_lat: 12.93522,
    purchase_lng: 77.62448,
    created_at: new Date().toISOString(),
    receipt_purchased_at: new Date().toISOString(),
  },
);

const ok =
  barcodeStatus === "not_provided" &&
  result.genuineness_score === 1 &&
  !result.reasons.some((r) => r.toLowerCase().includes("barcode miss"));

console.log(
  JSON.stringify(
    {
      barcode_match: barcodeStatus,
      genuineness_score: result.genuineness_score,
      reasons: result.reasons,
      proof_passed: ok,
    },
    null,
    2,
  ),
);

if (!ok) {
  console.error(
    "FAIL: expected barcode_match=not_provided and genuineness_score=1.00",
  );
  process.exit(1);
}

console.log(
  "PASS: no barcode → not_provided → score 1.00 (no BARCODE_MISS penalty).",
);
