/** Product categories — vision model must return one of these; dropdown uses the same list. */
export const TOKEN_CATEGORIES = [
  "Apparel",
  "Footwear",
  "Electronics",
  "Grocery",
  "Beauty & Personal Care",
  "Home & Kitchen",
  "Toys",
  "Books & Stationery",
  "Food & Beverage",
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

/**
 * Google Places Nearby Search `type` values by category.
 * Tune here when a category needs a better Places bias.
 * Beauty uses two types — the nearby helper merges both calls.
 */
export const CATEGORY_PLACE_TYPES: Record<
  string,
  string | string[]
> = {
  Apparel: "clothing_store",
  Footwear: "shoe_store",
  Electronics: "electronics_store",
  Grocery: "supermarket",
  "Beauty & Personal Care": ["beauty_salon", "store"],
  "Home & Kitchen": "home_goods_store",
  Toys: "store",
  "Books & Stationery": "book_store",
  "Food & Beverage": ["restaurant", "cafe"],
  Other: "store",
};

export function placeTypesForCategory(category: string): string[] {
  const mapped = CATEGORY_PLACE_TYPES[category] ?? "store";
  return Array.isArray(mapped) ? mapped : [mapped];
}
