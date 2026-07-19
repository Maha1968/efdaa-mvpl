"use client";

import { useEffect, useState } from "react";
import { formatCountdown, msUntilExpiry } from "@/lib/tokens/countdown";

export { formatCountdown } from "@/lib/tokens/countdown";

type ExpiryCountdownProps = {
  expiresAt: string;
  onExpiredChange?: (expired: boolean) => void;
  className?: string;
};

export function ExpiryCountdown({
  expiresAt,
  onExpiredChange,
  className = "",
}: ExpiryCountdownProps) {
  const [remainingMs, setRemainingMs] = useState(() =>
    msUntilExpiry(expiresAt),
  );

  useEffect(() => {
    const id = window.setInterval(() => {
      setRemainingMs(msUntilExpiry(expiresAt));
    }, 1000);
    // Sync immediately on next frame so we don't setState synchronously in effect.
    const raf = window.requestAnimationFrame(() => {
      setRemainingMs(msUntilExpiry(expiresAt));
    });
    return () => {
      window.clearInterval(id);
      window.cancelAnimationFrame(raf);
    };
  }, [expiresAt]);

  const expired = remainingMs <= 0;

  useEffect(() => {
    onExpiredChange?.(expired);
  }, [expired, onExpiredChange]);

  if (expired) {
    return (
      <div className={className}>
        <p className="font-mono text-lg font-semibold tabular-nums text-text-muted">
          Expires in 00:00:00
        </p>
        <p className="mt-1 text-sm font-medium text-warning">
          This offer has expired
        </p>
      </div>
    );
  }

  return (
    <p
      className={`font-mono text-lg font-semibold tabular-nums text-text-primary ${className}`}
      aria-live="polite"
    >
      Expires in {formatCountdown(remainingMs)}
    </p>
  );
}
