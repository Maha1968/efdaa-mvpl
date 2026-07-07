"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { createOriginatorToken } from "@/lib/actions/tokens";
import { PhotoUpload } from "@/components/photo-upload";
import type { Offer, Product } from "@/types/database";

type CreateTokenFormProps = {
  products: Product[];
  offers: Offer[];
  userId: string;
};

export function CreateTokenForm({
  products,
  offers,
  userId,
}: CreateTokenFormProps) {
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [offerId, setOfferId] = useState(offers[0]?.id ?? "");
  const [barcode, setBarcode] = useState(products[0]?.barcode ?? "");
  const [productPhoto, setProductPhoto] = useState<File | null>(null);
  const [barcodePhoto, setBarcodePhoto] = useState<File | null>(null);
  const [locationText, setLocationText] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleProductChange(id: string) {
    setProductId(id);
    const product = products.find((p) => p.id === id);
    if (product) setBarcode(product.barcode);
  }

  function captureLocation() {
    if (!navigator.geolocation) {
      setError("Your browser does not support location. Try on your phone.");
      return;
    }

    setLocating(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLocating(false);
      },
      (err) => {
        setError(
          err.code === 1
            ? "Location permission denied. Please allow location access and try again."
            : "Could not get your location. Please try again.",
        );
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  async function uploadPhoto(bucket: string, file: File) {
    const supabase = createClient();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${userId}/${Date.now()}-${safeName}`;
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(path, file, { upsert: false });

    if (uploadError) throw new Error(uploadError.message);

    const {
      data: { publicUrl },
    } = supabase.storage.from(bucket).getPublicUrl(path);

    return publicUrl;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!productId || !offerId) {
      setError("Please select a product and offer.");
      return;
    }
    if (!barcode.trim()) {
      setError("Please enter the barcode number.");
      return;
    }
    if (!productPhoto || !barcodePhoto) {
      setError("Please add both the product photo and barcode photo.");
      return;
    }
    if (!coords) {
      setError("Please capture your location before creating the token.");
      return;
    }

    setSubmitting(true);

    try {
      const [productPhotoUrl, barcodePhotoUrl] = await Promise.all([
        uploadPhoto("product-photos", productPhoto),
        uploadPhoto("barcode-photos", barcodePhoto),
      ]);

      const result = await createOriginatorToken({
        productId,
        offerId,
        scannedBarcode: barcode.trim(),
        productPhotoUrl,
        barcodePhotoUrl,
        claimLat: coords.lat,
        claimLng: coords.lng,
        claimLocationText: locationText.trim() || undefined,
      });

      if (result?.error) {
        setError(result.error);
        setSubmitting(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label htmlFor="product" className="mb-1.5 block text-sm font-medium text-zinc-700">
          Product
        </label>
        <select
          id="product"
          value={productId}
          onChange={(e) => handleProductChange(e.target.value)}
          className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
        >
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name} — ₹{product.price}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="offer" className="mb-1.5 block text-sm font-medium text-zinc-700">
          Offer
        </label>
        <select
          id="offer"
          value={offerId}
          onChange={(e) => setOfferId(e.target.value)}
          className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
        >
          {offers.map((offer) => (
            <option key={offer.id} value={offer.id}>
              {offer.name} ({(offer.base_reward_pct * 100).toFixed(0)}% reward)
            </option>
          ))}
        </select>
      </div>

      <PhotoUpload
        id="product-photo"
        label="Product photo"
        hint="Photograph the product you want to share."
        value={productPhoto}
        onChange={setProductPhoto}
      />

      <PhotoUpload
        id="barcode-photo"
        label="Barcode photo"
        hint="Photograph the product's barcode tag."
        value={barcodePhoto}
        onChange={setBarcodePhoto}
      />

      <div>
        <label htmlFor="barcode" className="mb-1.5 block text-sm font-medium text-zinc-700">
          Barcode number
        </label>
        <input
          id="barcode"
          type="text"
          inputMode="numeric"
          value={barcode}
          onChange={(e) => setBarcode(e.target.value)}
          placeholder="e.g. 8901234567890"
          className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-base outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
        />
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4">
        <p className="text-sm font-medium text-zinc-700">Your location</p>
        <p className="mt-1 text-xs text-zinc-500">
          We capture GPS coordinates when you create a token — no maps service needed.
        </p>

        <button
          type="button"
          onClick={captureLocation}
          disabled={locating}
          className="mt-3 w-full rounded-xl border border-zinc-300 bg-zinc-50 px-4 py-3 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-100 disabled:opacity-60"
        >
          {locating
            ? "Getting location..."
            : coords
              ? "Update location"
              : "Capture my location"}
        </button>

        {coords && (
          <p className="mt-2 text-xs text-emerald-700">
            Location captured: {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
          </p>
        )}

        <div className="mt-4">
          <label
            htmlFor="location-text"
            className="mb-1.5 block text-sm font-medium text-zinc-700"
          >
            Place name <span className="font-normal text-zinc-400">(optional)</span>
          </label>
          <input
            id="location-text"
            type="text"
            value={locationText}
            onChange={(e) => setLocationText(e.target.value)}
            placeholder='e.g. "Phoenix Mall"'
            className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-base outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          />
        </div>
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-xl bg-emerald-700 px-4 py-3.5 text-base font-medium text-white transition-colors hover:bg-emerald-800 disabled:opacity-60"
      >
        {submitting ? "Creating token..." : "Create token"}
      </button>
    </form>
  );
}
