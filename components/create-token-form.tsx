"use client";

import { useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { createOriginatorToken } from "@/lib/actions/tokens";
import { PhotoUpload } from "@/components/photo-upload";
import {
  MAX_TOKEN_PHOTOS,
  TOKEN_CATEGORIES,
  type StoreResolution,
} from "@/config/categories";
import type { Offer, Store } from "@/types/database";

type CreateTokenFormProps = {
  offers: Offer[];
  stores: Store[];
  userId: string;
};

type Step = "photos" | "share";

function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function CreateTokenForm({
  offers,
  stores,
  userId,
}: CreateTokenFormProps) {
  const [step, setStep] = useState<Step>("photos");
  const [photos, setPhotos] = useState<File[]>([]);
  const [barcodePhoto, setBarcodePhoto] = useState<File | null>(null);
  const [barcodeText, setBarcodeText] = useState("");
  const [signagePhoto, setSignagePhoto] = useState<File | null>(null);
  const [category, setCategory] = useState<string>(TOKEN_CATEGORIES[0]);
  const [offerId, setOfferId] = useState(offers[0]?.id ?? "");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [storeId, setStoreId] = useState("");
  const [storeNameText, setStoreNameText] = useState("");
  const [storeMode, setStoreMode] = useState<"pick" | "type">("pick");
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const multiInputRef = useRef<HTMLInputElement>(null);

  const nearbyStores = useMemo(() => {
    if (!coords) return stores.slice(0, 3);
    return [...stores]
      .map((s) => ({
        store: s,
        km:
          s.lat != null && s.lng != null
            ? haversineKm(coords.lat, coords.lng, s.lat, s.lng)
            : Number.POSITIVE_INFINITY,
      }))
      .sort((a, b) => a.km - b.km)
      .slice(0, 3)
      .map((x) => x.store);
  }, [coords, stores]);

  function addPhotos(fileList: FileList | null) {
    if (!fileList?.length) return;
    const next = [...photos];
    for (const file of Array.from(fileList)) {
      if (next.length >= MAX_TOKEN_PHOTOS) break;
      if (file.type.startsWith("image/")) next.push(file);
    }
    setPhotos(next);
  }

  function removePhoto(index: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }

  function replacePhoto(index: number, file: File | null) {
    if (!file) {
      removePhoto(index);
      return;
    }
    setPhotos((prev) => prev.map((p, i) => (i === index ? file : p)));
  }

  function captureLocation(): Promise<{ lat: number; lng: number }> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Your browser does not support location."));
        return;
      }
      setLocating(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const c = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setCoords(c);
          setLocating(false);
          resolve(c);
        },
        (err) => {
          setLocating(false);
          reject(
            new Error(
              err.code === 1
                ? "Location permission denied. Please allow location and try again."
                : "Could not get your location. Please try again.",
            ),
          );
        },
        { enableHighAccuracy: true, timeout: 15000 },
      );
    });
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

  async function handleWantToShare() {
    setError(null);
    if (photos.length < 1) {
      setError("Add at least one photo of your finds.");
      return;
    }
    try {
      const c = coords ?? (await captureLocation());
      setCoords(c);
      if (!storeId && nearbyStores[0]) {
        setStoreId(nearbyStores[0].id);
        setStoreMode("pick");
      }
      setStep("share");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not get location.");
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!offerId) {
      setError("No offer is configured. Ask an admin to add one.");
      return;
    }
    if (photos.length < 1 || photos.length > MAX_TOKEN_PHOTOS) {
      setError(`Please add between 1 and ${MAX_TOKEN_PHOTOS} photos.`);
      return;
    }
    if (!category) {
      setError("Please choose a category.");
      return;
    }

    let location = coords;
    if (!location) {
      try {
        location = await captureLocation();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Location required.");
        return;
      }
    }

    let resolution: StoreResolution = "user_entered";
    let originatorStoreId: string | undefined;
    let storeName: string | undefined;

    if (storeMode === "pick" && storeId) {
      originatorStoreId = storeId;
      resolution = nearbyStores.some((s) => s.id === storeId)
        ? "suggested"
        : "matched";
    } else if (storeNameText.trim()) {
      storeName = storeNameText.trim();
      resolution = "user_entered";
    } else {
      setError("Pick a store from the list or type the store name.");
      return;
    }

    setSubmitting(true);
    try {
      const photoUrls = await Promise.all(
        photos.map((f) => uploadPhoto("product-photos", f)),
      );
      const barcodePhotoUrl = barcodePhoto
        ? await uploadPhoto("barcode-photos", barcodePhoto)
        : undefined;
      const storeSignagePhotoUrl = signagePhoto
        ? await uploadPhoto("product-photos", signagePhoto)
        : undefined;

      const result = await createOriginatorToken({
        photoUrls,
        scannedBarcode: barcodeText.trim() || undefined,
        barcodePhotoUrl,
        storeSignagePhotoUrl,
        category,
        claimLat: location.lat,
        claimLng: location.lng,
        originatorStoreId,
        storeNameText: storeName,
        storeResolution: resolution,
        offerId,
      });

      if (result?.error) {
        setError(result.error);
        setSubmitting(false);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? `Upload or create failed: ${err.message}`
          : "Upload or create failed. Check your connection and try again.",
      );
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 pb-28">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900">
          What did you discover today?
        </h2>
        <p className="mt-1 text-sm text-zinc-600">
          Add 1–{MAX_TOKEN_PHOTOS} photos of your finds. Location and store come
          only when you are ready to share.
        </p>
      </div>

      {/* Product photos */}
      <div>
        <p className="mb-1.5 text-sm font-medium text-zinc-700">
          Your finds
        </p>
        <p className="mb-3 text-sm text-zinc-500">
          {photos.length}/{MAX_TOKEN_PHOTOS} photos
        </p>

        <input
          ref={multiInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="hidden"
          onChange={(e) => {
            addPhotos(e.target.files);
            e.target.value = "";
          }}
        />

        <div className="grid grid-cols-3 gap-2">
          {photos.map((file, index) => {
            const url = URL.createObjectURL(file);
            return (
              <div
                key={`${file.name}-${index}`}
                className="relative overflow-hidden rounded-xl border border-zinc-200"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`Photo ${index + 1}`}
                  className="h-28 w-full object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 flex gap-1 bg-black/50 p-1">
                  <label className="flex-1 cursor-pointer rounded bg-white/90 py-1 text-center text-[10px] font-medium">
                    Retake
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) =>
                        replacePhoto(index, e.target.files?.[0] ?? null)
                      }
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => removePhoto(index)}
                    className="flex-1 rounded bg-white/90 py-1 text-[10px] font-medium"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
          {photos.length < MAX_TOKEN_PHOTOS ? (
            <button
              type="button"
              onClick={() => multiInputRef.current?.click()}
              className="flex h-28 flex-col items-center justify-center rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-50 text-sm font-medium text-zinc-700"
            >
              + Add
            </button>
          ) : null}
        </div>
      </div>

      <PhotoUpload
        id="barcode-photo-optional"
        label="Scan / add barcode (optional)"
        hint="Never required. Leaving this out does not lower the genuineness score."
        value={barcodePhoto}
        onChange={setBarcodePhoto}
      />

      {barcodePhoto || barcodeText ? (
        <div>
          <label
            htmlFor="barcode-text"
            className="mb-1.5 block text-sm font-medium text-zinc-700"
          >
            Barcode number (optional)
          </label>
          <input
            id="barcode-text"
            type="text"
            inputMode="numeric"
            value={barcodeText}
            onChange={(e) => setBarcodeText(e.target.value)}
            placeholder="Only if you scanned one"
            className="min-h-12 w-full rounded-xl border border-zinc-300 px-4 py-3 text-base outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          />
        </div>
      ) : null}

      <PhotoUpload
        id="store-signage-optional"
        label="Add a photo of the store name (optional)"
        hint="Storefront or signage — helpful but not required."
        value={signagePhoto}
        onChange={setSignagePhoto}
      />

      {step === "photos" ? (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-zinc-200 bg-white/95 p-3 backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
          <button
            type="button"
            onClick={handleWantToShare}
            disabled={locating || photos.length < 1}
            className="mx-auto flex min-h-12 w-full max-w-lg items-center justify-center rounded-xl bg-emerald-700 px-4 py-3.5 text-base font-medium text-white transition-colors hover:bg-emerald-800 disabled:opacity-60"
          >
            {locating ? "Getting location…" : "Share"}
          </button>
        </div>
      ) : (
        <>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
            <p className="text-sm font-medium text-emerald-900">
              Location captured
            </p>
            {coords ? (
              <p className="mt-1 font-mono text-xs text-zinc-600">
                {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
              </p>
            ) : null}
            <button
              type="button"
              onClick={() => captureLocation().catch((e) => setError(e.message))}
              className="mt-2 text-sm font-medium text-emerald-800 underline"
            >
              Update location
            </button>
          </div>

          <div>
            <label
              htmlFor="category"
              className="mb-1.5 block text-sm font-medium text-zinc-700"
            >
              Category
            </label>
            <p className="mb-2 text-sm text-zinc-500">
              Manual pick for the pilot (vision API optional later).
            </p>
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="min-h-12 w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            >
              {TOKEN_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {offers.length > 1 ? (
            <div>
              <label
                htmlFor="offer"
                className="mb-1.5 block text-sm font-medium text-zinc-700"
              >
                Offer
              </label>
              <select
                id="offer"
                value={offerId}
                onChange={(e) => setOfferId(e.target.value)}
                className="min-h-12 w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base"
              >
                {offers.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name} ({(o.base_reward_pct * 100).toFixed(0)}%)
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div>
            <p className="mb-1.5 text-sm font-medium text-zinc-700">
              Store where you found it
            </p>
            <p className="mb-3 text-sm text-zinc-500">
              Nearby partner stores from your GPS (or type your own). Places API
              is optional — this list works offline.
            </p>

            <div className="mb-3 flex gap-2">
              <button
                type="button"
                onClick={() => setStoreMode("pick")}
                className={`min-h-10 flex-1 rounded-xl px-3 text-sm font-medium ${
                  storeMode === "pick"
                    ? "bg-emerald-700 text-white"
                    : "border border-zinc-300 bg-white text-zinc-700"
                }`}
              >
                Nearby stores
              </button>
              <button
                type="button"
                onClick={() => setStoreMode("type")}
                className={`min-h-10 flex-1 rounded-xl px-3 text-sm font-medium ${
                  storeMode === "type"
                    ? "bg-emerald-700 text-white"
                    : "border border-zinc-300 bg-white text-zinc-700"
                }`}
              >
                Type store name
              </button>
            </div>

            {storeMode === "pick" ? (
              <select
                value={storeId}
                onChange={(e) => setStoreId(e.target.value)}
                className="min-h-12 w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base"
              >
                <option value="">Select a store…</option>
                {nearbyStores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.address ? ` — ${s.address}` : ""}
                  </option>
                ))}
                {stores
                  .filter((s) => !nearbyStores.some((n) => n.id === s.id))
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                      {s.address ? ` — ${s.address}` : ""}
                    </option>
                  ))}
              </select>
            ) : (
              <input
                type="text"
                value={storeNameText}
                onChange={(e) => setStoreNameText(e.target.value)}
                placeholder="e.g. MG Road Store"
                className="min-h-12 w-full rounded-xl border border-zinc-300 px-4 py-3 text-base"
              />
            )}
          </div>

          {error ? (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <div className="fixed inset-x-0 bottom-0 z-20 border-t border-zinc-200 bg-white/95 p-3 backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
            <button
              type="submit"
              disabled={submitting}
              className="mx-auto flex min-h-12 w-full max-w-lg items-center justify-center rounded-xl bg-emerald-700 px-4 py-3.5 text-base font-medium text-white transition-colors hover:bg-emerald-800 disabled:opacity-60"
            >
              {submitting ? "Sharing…" : "Share"}
            </button>
          </div>
        </>
      )}

      {step === "photos" && error ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </form>
  );
}
