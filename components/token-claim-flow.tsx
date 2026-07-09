"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LocationCapture } from "@/components/location-capture";
import { forwardToken } from "@/lib/actions/tokens";
import type { TokenWithDetails } from "@/lib/tokens/helpers";
import { canForwardToken } from "@/lib/tokens/helpers";

type TokenClaimFlowProps = {
  token: TokenWithDetails;
};

export function TokenClaimFlow({ token }: TokenClaimFlowProps) {
  const router = useRouter();
  const [step, setStep] = useState<"claim" | "actions">("claim");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [locationText, setLocationText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const forwardAllowed = canForwardToken(token.depth);

  function handleClaimContinue() {
    setError(null);
    if (!coords) {
      setError("Please capture your location before continuing.");
      return;
    }
    setStep("actions");
  }

  async function handleForward(andRedeem: boolean) {
    if (!coords) {
      setError("Location is required.");
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

    if (andRedeem) {
      router.push(`/redeem/${token.code}?shared=${result.code}`);
      return;
    }

    router.push(`/create/${result.code}`);
  }

  function handleRedeemOnly() {
    if (!coords) {
      setError("Please capture your location first.");
      return;
    }
    router.push(`/redeem/${token.code}`);
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-zinc-500">Product</p>
        <p className="mt-1 text-lg font-semibold text-zinc-900">
          {token.product?.name ?? "Unknown product"}
        </p>
        {token.product?.price != null && (
          <p className="mt-1 text-sm text-zinc-600">₹{token.product.price}</p>
        )}
        {token.offer && (
          <p className="mt-2 text-sm text-emerald-700">
            {(token.offer.base_reward_pct * 100).toFixed(0)}% reward pool on purchase
          </p>
        )}
        <p className="mt-4 text-xs text-zinc-500">
          Expires {new Date(token.expires_at).toLocaleString()}
        </p>
      </div>

      {step === "claim" ? (
        <>
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Claim this offer</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Capture where you are right now to claim this token.
            </p>
          </div>

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

          <button
            type="button"
            onClick={handleClaimContinue}
            className="w-full rounded-xl bg-emerald-700 px-4 py-3.5 text-base font-medium text-white transition-colors hover:bg-emerald-800"
          >
            Continue
          </button>
        </>
      ) : (
        <>
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">What would you like to do?</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Redeem for yourself, share it, or both.
            </p>
          </div>

          {error && (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="space-y-3">
            <button
              type="button"
              onClick={handleRedeemOnly}
              disabled={loading}
              className="w-full rounded-xl bg-emerald-700 px-4 py-3.5 text-base font-medium text-white transition-colors hover:bg-emerald-800 disabled:opacity-60"
            >
              Redeem
            </button>

            <button
              type="button"
              onClick={() => handleForward(false)}
              disabled={loading || !forwardAllowed}
              className="w-full rounded-xl border border-emerald-700 bg-white px-4 py-3.5 text-base font-medium text-emerald-800 transition-colors hover:bg-emerald-50 disabled:opacity-60"
            >
              Share
            </button>

            <button
              type="button"
              onClick={() => handleForward(true)}
              disabled={loading || !forwardAllowed}
              className="w-full rounded-xl border border-zinc-300 bg-zinc-50 px-4 py-3.5 text-base font-medium text-zinc-800 transition-colors hover:bg-zinc-100 disabled:opacity-60"
            >
              Redeem + Share
            </button>
          </div>

          {!forwardAllowed && (
            <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
              This chain has reached its maximum length. You can still redeem, but
              cannot share further.
            </p>
          )}

          <button
            type="button"
            onClick={() => setStep("claim")}
            className="w-full text-sm text-zinc-500 underline"
          >
            Back to location
          </button>
        </>
      )}
    </div>
  );
}
