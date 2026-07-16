/** Product categories for recommendations (manual fallback when no vision API). */
export const TOKEN_CATEGORIES = [
  "Food & Grocery",
  "Fashion & Apparel",
  "Electronics",
  "Home & Living",
  "Beauty & Personal Care",
  "Health & Wellness",
  "Other",
] as const;

export type TokenCategory = (typeof TOKEN_CATEGORIES)[number];

export const MAX_TOKEN_PHOTOS = 5;

export type StoreResolution = "matched" | "suggested" | "user_entered";

/**
 * Tri-state barcode check.
 * not_provided = token had no barcode at share time → NEVER apply BARCODE_MISS_MULTIPLIER.
 */
export type BarcodeMatchStatus = "match" | "mismatch" | "not_provided";
