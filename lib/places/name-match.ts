/**
 * Normalize store names for fuzzy match: lowercase, strip punctuation,
 * drop leading "the", collapse whitespace.
 */
export function normalizeStoreName(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\bthe\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * True when photo name and Places name refer to the same store
 * (either contains the other after normalization).
 */
export function storeNamesMatch(photoName: string, placesName: string) {
  const a = normalizeStoreName(photoName);
  const b = normalizeStoreName(placesName);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}
