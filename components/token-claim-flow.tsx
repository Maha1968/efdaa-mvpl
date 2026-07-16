"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LocationCapture } from "@/components/location-capture";
import { ExpiryCountdown } from "@/components/expiry-countdown";
import { TokenFindsHero } from "@/components/token-finds-hero";
import { forwardToken } from "@/lib/actions/tokens";
import type { TokenWithDetails } from "@/lib/tokens/helpers";
import { canForwardToken, isTokenExpired } from "@/lib/tokens/helpers";

type TokenClaimFlowProps = {
  token: TokenWithDetails;
  alreadyRedeemed: boolean;
  photos: string[];
  senderFirstName: string;
  /** When true, only show preview + sign-in CTA (logged-out viewer). */
  previewOnly?: boolean;
  signInHref?: string;
};

export function TokenClaimFlow({
  token,
  alreadyRedeemed,
  photos,
  senderFirstName,
  previewOnly = false,
  signInHref,
}: TokenClaimFlowProps) {
  const router = useRouter();
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [locationText, setLocationText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(() =>
    isTokenExpired(token.expires_at),
  );

  const shareAllowed = canForwardToken(token.depth) && !expired;
  const actionsDisabled = expired;

  async function handleShare() {
    if (actionsDisabled) return;
    if (!coords) {
      setError("Please capture your location before sharing.");
      return;
    }

    setLoading(true);
    setError(null);

    const result = await forwardToken({
      parentCode: token.code,
      claimLat: coords.lat,
      claimLng: coords.lng,
      claimLocationText: locationText.trim() || undefined,
    });

    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    const from = encodeURIComponent(`/t/${token.code}`);
    router.push(`/create/${result.code}?from=${from}`);
  }

  return (
    <div className="space-y-6 pb-28">
      <div>
        <p className="text-sm font-medium uppercase tracking-widest text-emerald-700">
          EFDAA
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-900">
          {senderFirstName} shared something they think you&apos;ll love.
        </h1>
      </div>

      <TokenFindsHero photos={photos} senderFirstName={senderFirstName} />

      <div>
        <ExpiryCountdown
          expiresAt={token.expires_at}
          onExpiredChange={setExpired}
        />
        <p className="mt-3 text-sm leading-relaxed text-zinc-600">
          When you buy, you both earn EFDAA points.
        </p>
        {(token.product?.name || token.category) && (
          <p className="mt-2 text-sm text-zinc-500">
            {token.product?.name ??
              (token.category ? `A find in ${token.category}` : null)}
          </p>
        )}
      </div>

      {previewOnly ? (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-zinc-200 bg-white/95 p-3 backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
          <Link
            href={signInHref ?? `/login?next=/t/${token.code}`}
            className="mx-auto flex min-h-12 w-full max-w-lg items-center justify-center rounded-xl bg-emerald-700 px-4 py-3.5 text-base font-medium text-white transition-colors hover:bg-emerald-800"
          >
            Sign in to continue
          </Link>
        </div>
      ) : (
        <>
          {alreadyRedeemed && !expired && (
            <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              You&apos;ve already redeemed this. You can still share it while
              it&apos;s active.
            </p>
          )}

          {!expired && (
            <div>
              <h2 className="text-lg font-semibold text-zinc-900">
                Share or redeem
              </h2>
              <p className="mt-1 text-sm text-zinc-600">
                Share their find with someone else, or redeem when you buy —
                redeem once, share as often as you like.
              </p>
            </div>
          )}

          {shareAllowed && (
            <LocationCapture
              coords={coords}
              onCoordsChange={setCoords}
              locationText={locationText}
              onLocationTextChange={setLocationText}
              onError={setError}
            />
          )}

          {!expired && !canForwardToken(token.depth) && (
            <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
              This chain has reached its maximum length. You can still redeem,
              but cannot share further.
            </p>
          )}

          {error && (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="fixed inset-x-0 bottom-0 z-20 border-t border-zinc-200 bg-white/95 p-3 backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
            <div className="mx-auto flex max-w-lg flex-col gap-2 sm:gap-3">
              {canForwardToken(token.depth) && (
                <button
                  type="button"
                  onClick={handleShare}
                  disabled={loading || actionsDisabled}
                  className="min-h-12 w-full rounded-xl border border-emerald-700 bg-white px-4 py-3.5 text-base font-medium text-emerald-800 transition-colors hover:bg-emerald-50 disabled:opacity-60"
                >
                  {loading ? "Creating link…" : "Share"}
                </button>
              )}
              {!alreadyRedeemed && !actionsDisabled ? (
                <Link
                  href={`/redeem/${token.code}`}
                  className="flex min-h-12 w-full items-center justify-center rounded-xl bg-emerald-700 px-4 py-3.5 text-base font-medium text-white transition-colors hover:bg-emerald-800"
                >
                  Redeem
                </Link>
              ) : alreadyRedeemed && !actionsDisabled ? (
                <p className="py-2 text-center text-sm text-zinc-500">
                  Redeem is no longer available for this token.
                </p>
              ) : null}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
