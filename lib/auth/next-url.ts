/**
 * Safe post-login redirect path. Only same-origin relative paths are allowed
 * so share links like /t/CODE survive login without open-redirect risk.
 */
export function safeNextPath(
  next: string | null | undefined,
  fallback = "/",
): string {
  if (!next) return fallback;
  if (!next.startsWith("/") || next.startsWith("//")) return fallback;
  return next;
}
