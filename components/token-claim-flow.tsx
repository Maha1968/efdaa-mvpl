"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LocationCapture } from "@/components/location-capture";
import { forwardToken } from "@/lib/actions/tokens";
import type { TokenWithDetails } from "@/lib/tokens/helpers";
import { canForwardToken } from "@/lib/tokens/helpers";

type TokenClaimFlowProps = {
  token: TokenWithDetails;
  alreadyRedeemed: boolean;
};

export function TokenClaimFlow({
  token,
  alreadyRedeemed,
}: TokenClaimFlowProps) {
  const router = useRouter();
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [locationText, setLocationText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shareAllowed = canForwardToken(token.depth);

  async function handleShare() {
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
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
        <p className="text-sm font-medium text-zinc-500">Product</p>
        <p className="mt-1 text-lg font-semibold text-zinc-900">
          {token.product?.name ?? "Unknown product"}
        </p>
        {token.product?.price != null && (
          <p className="mt-1 text-sm text-zinc-600">₹{token.product.price}</p>
        )}
        {token.offer && (
          <p className="mt-2 text-sm text-emerald-700">
            {(token.offer.base_reward_pct * 100).toFixed(0)}% reward pool on
            purchase
          </p>
        )}
        <p className="mt-4 text-sm text-zinc-500">
          Expires {new Date(token.expires_at).toLocaleString()}
        </p>
      </div>

      {alreadyRedeemed && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          You&apos;ve already redeemed this token. You can still share it with
          others while it&apos;s active.
        </p>
      )}

      <div>
        <h2 className="text-lg font-semibold text-zinc-900">
          Share or redeem
        </h2>
        <p className="mt-1 text-sm text-zinc-600">
          Share and redeem are independent — share as many times as you like, but
          you can only redeem once.
        </p>
      </div>

      {shareAllowed && (
        <LocationCapture
          coords={coords}
          onCoordsChange={setCoords}
          locationText={locationText}
          onLocationTextChange={setLocationText}
          onError={setError}
        />
      )}

      {!shareAllowed && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          This chain has reached its maximum length. You can still redeem, but
          cannot share further.
        </p>
      )}

      {error && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-zinc-200 bg-white/95 p-3 backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
        <div className="mx-auto flex max-w-lg flex-col gap-2 sm:gap-3">
          {shareAllowed && (
            <button
              type="button"
              onClick={handleShare}
              disabled={loading}
              className="min-h-12 w-full rounded-xl border border-emerald-700 bg-white px-4 py-3.5 text-base font-medium text-emerald-800 transition-colors hover:bg-emerald-50 disabled:opacity-60"
            >
              {loading ? "Creating link…" : "Share"}
            </button>
          )}
          {!alreadyRedeemed ? (
            <Link
              href={`/redeem/${token.code}`}
              className="flex min-h-12 w-full items-center justify-center rounded-xl bg-emerald-700 px-4 py-3.5 text-base font-medium text-white transition-colors hover:bg-emerald-800"
            >
              Redeem
            </Link>
          ) : (
            <p className="py-2 text-center text-sm text-zinc-500">
              Redeem is no longer available for this token.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
