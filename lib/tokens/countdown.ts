/** Milliseconds remaining until expires_at (never negative). */
export function msUntilExpiry(expiresAt: string, now = Date.now()) {
  return Math.max(0, new Date(expiresAt).getTime() - now);
}

/**
 * Format remaining time as HH:MM:SS.
 * Hours may exceed 24 when TOKEN_VALIDITY_HOURS is raised — do not hardcode 24 here.
 */
export function formatCountdown(ms: number) {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
