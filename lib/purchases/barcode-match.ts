import type { BarcodeMatchStatus } from "@/config/categories";

function normalizeBarcode(value: string) {
  return value.replace(/\s+/g, "").trim();
}

/**
 * Resolve barcode_match from the originator's captured barcode (if any) vs receipt.
 *
 * CRITICAL: when the token has NO barcode, status is "not_provided" and
 * genuineness must NOT apply BARCODE_MISS_MULTIPLIER.
 */
export function resolveBarcodeMatch(input: {
  tokenScannedBarcode: string | null | undefined;
  receiptBarcode: string | null | undefined;
  productBarcode?: string | null | undefined;
}): BarcodeMatchStatus {
  const tokenBarcode = normalizeBarcode(input.tokenScannedBarcode ?? "");
  if (!tokenBarcode) {
    return "not_provided";
  }

  const receipt = normalizeBarcode(input.receiptBarcode ?? "");
  const product = normalizeBarcode(input.productBarcode ?? "");

  if (receipt && (receipt === tokenBarcode || (product && receipt === product))) {
    return "match";
  }

  return "mismatch";
}
