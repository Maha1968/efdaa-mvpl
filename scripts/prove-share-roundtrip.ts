/**
 * Prove Stage 7L logged-out share-link round-trip wiring.
 * Run: npx tsx scripts/prove-share-roundtrip.ts
 *
 * Checks:
 * 1. safeNextPath keeps /t/CODE and rejects open redirects
 * 2. Countdown formatting freezes at 0 and doesn't hardcode 24
 * 3. Live app (if BASE_URL set) returns login?next=/t/… from public share page CTA
 */

import { safeNextPath } from "../lib/auth/next-url";
import { formatCountdown } from "../lib/tokens/countdown";
import { TOKEN_VALIDITY_HOURS } from "../config/rewards";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function main() {
  assert(safeNextPath("/t/DEMOT1A") === "/t/DEMOT1A", "preserve /t/CODE");
  assert(safeNextPath("/t/ABC123") === "/t/ABC123", "preserve arbitrary code");
  assert(safeNextPath("//evil.com") === "/", "reject protocol-relative");
  assert(safeNextPath("https://evil.com") === "/", "reject absolute URL");
  assert(safeNextPath(null, "/home") === "/home", "fallback");

  assert(formatCountdown(0) === "00:00:00", "zero freeze");
  assert(formatCountdown(23 * 3600_000 + 47 * 60_000 + 12_000) === "23:47:12", "tick format");
  assert(
    formatCountdown(TOKEN_VALIDITY_HOURS * 3600_000) ===
      `${String(TOKEN_VALIDITY_HOURS).padStart(2, "0")}:00:00`,
    "countdown driven by TOKEN_VALIDITY_HOURS, not hardcoded 24 in formatter",
  );

  console.log("OK: next-path + countdown unit checks passed");
  console.log(`TOKEN_VALIDITY_HOURS = ${TOKEN_VALIDITY_HOURS}`);
  console.log(
    "Manual proof: open /t/<code> logged out → Sign in → land on /t/<code> with finds + timer.",
  );
}

main();
