"use client";

import { useState } from "react";

type LocationCaptureProps = {
  coords: { lat: number; lng: number } | null;
  onCoordsChange: (coords: { lat: number; lng: number } | null) => void;
  locationText: string;
  onLocationTextChange: (text: string) => void;
  onError?: (message: string) => void;
  showPlaceName?: boolean;
};

export function LocationCapture({
  coords,
  onCoordsChange,
  locationText,
  onLocationTextChange,
  onError,
  showPlaceName = true,
}: LocationCaptureProps) {
  const [locating, setLocating] = useState(false);

  function captureLocation() {
    if (!navigator.geolocation) {
      onError?.("Your browser does not support location. Try on your phone.");
      return;
    }

    setLocating(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        onCoordsChange({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLocating(false);
      },
      (err) => {
        onError?.(
          err.code === 1
            ? "Location permission denied. Please allow location access and try again."
            : "Could not get your location. Please try again.",
        );
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <p className="text-sm font-medium text-text-secondary">Share your location</p>
      <p className="mt-1 text-xs text-text-muted">
        Needed once so we know where you opened this find.
      </p>

      <button
        type="button"
        onClick={captureLocation}
        disabled={locating}
        className="mt-3 min-h-12 w-full rounded-xl border border-border-strong bg-surface-muted px-4 py-3.5 text-base font-medium text-text-primary transition-colors hover:bg-border disabled:opacity-60"
      >
        {locating
          ? "Getting location…"
          : coords
            ? "Update location"
            : "Share your location"}
      </button>

      {locating && (
        <p className="mt-2 text-sm text-text-secondary">
          Waiting for GPS — allow location when your browser asks.
        </p>
      )}

      {coords && (
        <p className="mt-2 text-xs text-primary">
          Location captured: {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
        </p>
      )}

      {showPlaceName && (
        <div className="mt-4">
          <label
            htmlFor="claim-location-text"
            className="mb-1.5 block text-sm font-medium text-text-secondary"
          >
            Place name <span className="font-normal text-text-muted">(optional)</span>
          </label>
          <input
            id="claim-location-text"
            type="text"
            value={locationText}
            onChange={(e) => onLocationTextChange(e.target.value)}
            placeholder='e.g. "Phoenix Mall"'
            className="w-full rounded-xl border border-border-strong px-4 py-3 text-base outline-none focus:border-primary focus:ring-2 focus:ring-focus-ring/40"
          />
        </div>
      )}
    </div>
  );
}
