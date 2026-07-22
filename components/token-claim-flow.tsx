"use client";

import { useState } from "react";
import { LocationCapture } from "@/components/location-capture";
import { ExpiryCountdown } from "@/components/expiry-countdown";
import { TokenFindsHero } from "@/components/token-finds-hero";
import { StickyActionBar } from "@/components/ui/sticky-action-bar";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { MojodaaLogo } from "@/components/brand/mojodaa-logo";
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
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [locationText, setLocationText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Step 1 = Claim CTA; step 2 = location + place; then unlock after success. */
  const [claimStep, setClaimStep] = useState<"claim" | "location">("claim");
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
    `I found something I think you'll love — ${findLabel}. Open this on MOJODAA: ${shareUrl}`,
  )}`;

  async function handleClaimWithLocation() {
    if (actionsDisabled) return;
    if (!coords) {
      setError("Share your location to claim this find.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await claimToken({
        parentCode: token.code,
        claimLat: coords.lat,
        claimLng: coords.lng,
        claimLocationText: locationText.trim() || undefined,
      });

      if (result.error) {
        console.error("claimToken failed:", result.error);
        setError(result.error);
        return;
      }

      if (!result.code) {
        const msg = "Claim succeeded but no token code was returned.";
        console.error(msg, result);
        setError(msg);
        return;
      }

      // Hard navigate so the unlocked token screen always loads (Share + Redeem).
      window.location.assign(`/t/${result.code}`);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong while claiming.";
      console.error("claimToken threw:", err);
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleShareClick() {
    await markTokenShared(token.code);
  }

  if (previewOnly || needsClaim) {
    return (
      <div className="space-y-6">
        <div>
          <MojodaaLogo height={240} />
          <h1 className="text-page-title mt-3">
            {senderFirstName} shared something they think you&apos;ll love.
          </h1>
          <p className="text-supporting mt-2">
            {claimStep === "claim"
              ? "Claim this find to open it. You’ll share your location next so we can confirm the recommendation."
              : "Share your location to open their find — without it you can’t redeem or share."}
          </p>
        </div>

        <ExpiryCountdown
          expiresAt={token.expires_at}
          onExpiredChange={setExpired}
        />

        {previewOnly ? (
          <StickyActionBar>
            <ButtonLink
              href={signInHref ?? `/login?next=/t/${token.code}`}
              fullWidth
            >
              Sign in to claim
            </ButtonLink>
          </StickyActionBar>
        ) : expired ? (
          <p className="rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning">
            This offer has expired — sharing and redeeming are closed.
          </p>
        ) : claimStep === "claim" ? (
          <StickyActionBar>
            <Button fullWidth onClick={() => setClaimStep("location")}>
              Claim
            </Button>
          </StickyActionBar>
        ) : (
          <>
            <LocationCapture
              coords={coords}
              onCoordsChange={setCoords}
              locationText={locationText}
              onLocationTextChange={setLocationText}
              onError={setError}
              showPlaceName={false}
            />

            {error && (
              <p
                role="alert"
                className="rounded-xl bg-error-soft px-4 py-3 text-sm text-error"
              >
                {error}
              </p>
            )}

            <StickyActionBar>
              <Button
                fullWidth
                onClick={handleClaimWithLocation}
                disabled={loading || !coords}
                loading={loading}
              >
                Share location and view
              </Button>
            </StickyActionBar>
          </>
        )}
        <div className="h-24 sm:hidden" aria-hidden />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <MojodaaLogo height={240} />
        <h1 className="text-page-title mt-3">
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
        <p className="text-supporting mt-3">
          When you buy, you both earn MOJODAA points. Redeem once anytime before
          the timer ends — share as often as you like.
        </p>
        {(token.product?.name || token.category) && (
          <p className="mt-2 text-sm text-text-muted">{findLabel}</p>
        )}
      </div>

      {alreadyRedeemed && !expired && (
        <p className="rounded-xl bg-success-soft px-4 py-3 text-sm text-success">
          You&apos;ve already redeemed this. You can still share it while
          it&apos;s active.
        </p>
      )}

      {!expired && !canShareFurther && token.depth > 0 && (
        <p className="rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning">
          This chain has reached its maximum length. You can still redeem, but
          friends who open your link cannot claim further shares.
        </p>
      )}

      {!expired && (
        <div>
          <h2 className="text-section">Share or redeem</h2>
          <p className="text-supporting mt-1">
            Both stay open for the same countdown. Redeem is once; share is
            unlimited.
          </p>
        </div>
      )}

      <StickyActionBar>
        <div className="flex flex-col gap-2">
          {!actionsDisabled && (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                void handleShareClick();
              }}
              className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#25D366] px-4 text-base font-medium text-white transition-colors hover:bg-[#1ebe5d]"
            >
              Share on WhatsApp
            </a>
          )}
          {canRedeem ? (
            <ButtonLink href={`/redeem/${token.code}`} variant="secondary" fullWidth>
              Redeem
            </ButtonLink>
          ) : alreadyRedeemed && !actionsDisabled ? (
            <p className="py-2 text-center text-sm text-text-muted">
              Redeem is no longer available for this find.
            </p>
          ) : null}
        </div>
      </StickyActionBar>
      <div className="h-28 sm:hidden" aria-hidden />
    </div>
  );
}
