"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LocationCapture } from "@/components/location-capture";
import { ExpiryCountdown } from "@/components/expiry-countdown";
import { TokenFindsHero } from "@/components/token-finds-hero";
import { claimToken, markTokenShared } from "@/lib/actions/tokens";
import { getTokenShareUrl } from "@/lib/utils/app-url";
import type { TokenWithDetails } from "@/lib/tokens/helpers";
import { canForwardToken, isTokenExpired } from "@/lib/tokens/helpers";

type TokenClaimFlowProps = {
  token: TokenWithDetails;
  alreadyRedeemed: boolean;
  photos: string[];
  senderFirstName: string;
  /** Viewer must claim with location before seeing finds + actions. */
  needsClaim: boolean;
  /** Logged-out: sign in first (then claim). */
  previewOnly?: boolean;
  signInHref?: string;
};

export function TokenClaimFlow({
  token,
  alreadyRedeemed,
  photos,
  senderFirstName,
  needsClaim,
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

  const actionsDisabled = expired;
  const canShareFurther = canForwardToken(token.depth);
  const canRedeem = token.depth > 0 && !alreadyRedeemed && !actionsDisabled;

  const findLabel =
    token.product?.name ??
    (token.category ? `a find in ${token.category}` : "this find");

  const shareUrl = getTokenShareUrl(token.code);
  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(
    `I found something I think you'll love — ${findLabel}. Open this on EFDAA: ${shareUrl}`,
  )}`;

  async function handleClaim() {
    if (actionsDisabled) return;
    if (!coords) {
      setError("Share your location to claim this find.");
      return;
    }

    setLoading(true);
    setError(null);

    const result = await claimToken({
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

    router.replace(`/t/${result.code}`);
    router.refresh();
  }

  async function handleShareClick() {
    await markTokenShared(token.code);
  }

  if (previewOnly || needsClaim) {
    return (
      <div className="space-y-6 pb-28">
        <div>
          <p className="text-sm font-medium uppercase tracking-widest text-emerald-700">
            EFDAA
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-900">
            {senderFirstName} shared something they think you&apos;ll love.
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            Share your location to open their find. Location is required — without
            it you can&apos;t redeem or share.
          </p>
        </div>

        <ExpiryCountdown
          expiresAt={token.expires_at}
          onExpiredChange={setExpired}
        />

        {previewOnly ? (
          <div className="fixed inset-x-0 bottom-0 z-20 border-t border-zinc-200 bg-white/95 p-3 backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
            <Link
              href={signInHref ?? `/login?next=/t/${token.code}`}
              className="mx-auto flex min-h-12 w-full max-w-lg items-center justify-center rounded-xl bg-emerald-700 px-4 py-3.5 text-base font-medium text-white transition-colors hover:bg-emerald-800"
            >
              Sign in to claim
            </Link>
          </div>
        ) : expired ? null : (
          <>
            <LocationCapture
              coords={coords}
              onCoordsChange={setCoords}
              locationText={locationText}
              onLocationTextChange={setLocationText}
              onError={setError}
            />

            {error && (
              <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </p>
            )}

            <div className="fixed inset-x-0 bottom-0 z-20 border-t border-zinc-200 bg-white/95 p-3 backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
              <button
                type="button"
                onClick={handleClaim}
                disabled={loading || !coords}
                className="mx-auto flex min-h-12 w-full max-w-lg items-center justify-center rounded-xl bg-emerald-700 px-4 py-3.5 text-base font-medium text-white transition-colors hover:bg-emerald-800 disabled:opacity-60"
              >
                {loading ? "Claiming…" : "Claim with my location"}
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-28">
      <div>
        <p className="text-sm font-medium uppercase tracking-widest text-emerald-700">
          EFDAA
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-900">
          {token.depth === 0
            ? "Your find is ready to share."
            : `${senderFirstName} shared something they think you&apos;ll love.`}
        </h1>
      </div>

      <TokenFindsHero photos={photos} senderFirstName={senderFirstName} />

      <div>
        <ExpiryCountdown
          expiresAt={token.expires_at}
          onExpiredChange={setExpired}
        />
        <p className="mt-3 text-sm leading-relaxed text-zinc-600">
          When you buy, you both earn EFDAA points. Redeem once anytime before
          the timer ends — share as often as you like.
        </p>
        {(token.product?.name || token.category) && (
          <p className="mt-2 text-sm text-zinc-500">{findLabel}</p>
        )}
      </div>

      {alreadyRedeemed && !expired && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          You&apos;ve already redeemed this. You can still share it while
          it&apos;s active.
        </p>
      )}

      {!expired && !canShareFurther && token.depth > 0 && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          This chain has reached its maximum length. You can still redeem, but
          friends who open your link cannot claim further shares.
        </p>
      )}

      {!expired && (
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">
            Share or redeem
          </h2>
          <p className="mt-1 text-sm text-zinc-600">
            Both stay open for the same countdown. Redeem is once; share is
            unlimited.
          </p>
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-zinc-200 bg-white/95 p-3 backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
        <div className="mx-auto flex max-w-lg flex-col gap-2 sm:gap-3">
          {!actionsDisabled && (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                void handleShareClick();
              }}
              className="flex min-h-12 w-full items-center justify-center rounded-xl bg-emerald-700 px-4 py-3.5 text-base font-medium text-white transition-colors hover:bg-emerald-800"
            >
              Share
            </a>
          )}
          {canRedeem ? (
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
    </div>
  );
}
