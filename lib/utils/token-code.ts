const CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Short shareable code for WhatsApp links (no ambiguous 0/O or 1/I). */
export function generateTokenCode(length = 8): string {
  const bytes = new Uint8Array(length);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (b) => CHARSET[b % CHARSET.length]).join("");
}
