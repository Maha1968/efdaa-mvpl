"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { createOriginatorToken } from "@/lib/actions/tokens";
import {
  MAX_TOKEN_PHOTOS,
  TOKEN_CATEGORIES,
  type StoreResolution,
} from "@/config/categories";
import type { NearbyPlaceSuggestion } from "@/lib/places/types";
import type { Offer, Store } from "@/types/database";

type CreateTokenFormProps = {
  offers: Offer[];
  stores: Store[];
  userId: string;
};

type Step = "photos" | "share";

/** How the user is picking the store in the share step. */
type StoreUi =
  | { mode: "auto"; place: NearbyPlaceSuggestion }
  | { mode: "list" }
  | { mode: "other" }
  | { mode: "manual" }; // Places failed / empty — free text (+ optional vision prefill)

/** Shrink camera photos so vision can accept them (phones often shoot 3–8MB). */
async function compressImageForVision(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  if (file.size < 900_000) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const maxEdge = 1280;
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.72),
    );
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.\w+$/, ".jpg"), {
      type: "image/jpeg",
    });
  } catch {
    return file;
  }
}

export function CreateTokenForm({
  offers,
  stores,
  userId,
}: CreateTokenFormProps) {
  const [step, setStep] = useState<Step>("photos");
  const [photos, setPhotos] = useState<File[]>([]);
  const [category, setCategory] = useState<string>("");
  const [categorySuggested, setCategorySuggested] = useState(false);
  const [visionHint, setVisionHint] = useState<string | null>(null);
  const [offerId, setOfferId] = useState(offers[0]?.id ?? "");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [nearbyPlaces, setNearbyPlaces] = useState<NearbyPlaceSuggestion[]>(
    [],
  );
  const [selectedPlace, setSelectedPlace] =
    useState<NearbyPlaceSuggestion | null>(null);
  const [storeNameText, setStoreNameText] = useState("");
  const [storeUi, setStoreUi] = useState<StoreUi>({ mode: "manual" });
  const [visionStoreName, setVisionStoreName] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const multiInputRef = useRef<HTMLInputElement>(null);

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

  async function runVision(files: File[]) {
    const form = new FormData();
    const compressed = await Promise.all(files.map(compressImageForVision));
    for (const f of compressed) form.append("photo", f);
    try {
      const res = await fetch("/api/vision/detect", {
        method: "POST",
        body: form,
      });
      if (!res.ok) return null;
      return (await res.json()) as {
        ok: boolean;
        category: string | null;
        visible_store_name: string | null;
        store_name_confidence: "high" | "low" | null;
        error?: string;
      };
    } catch {
      return null;
    }
  }

  async function runPlaces(input: {
    lat: number;
    lng: number;
    category: string;
    visibleStoreName: string | null;
  }) {
    try {
      const res = await fetch("/api/places/nearby", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) return null;
      return (await res.json()) as {
        ok: boolean;
        places: NearbyPlaceSuggestion[];
        autoMatch: NearbyPlaceSuggestion | null;
      };
    } catch {
      return null;
    }
  }

  async function handleWantToShare() {
    setError(null);
    if (photos.length < 1) {
      setError("Add at least one photo of your finds.");
      return;
    }

    setAnalyzing(true);
    try {
      const visionFiles = photos;

      // GPS + vision in parallel — neither blocks the other; soft-fail vision.
      const [location, vision] = await Promise.all([
        coords ? Promise.resolve(coords) : captureLocation(),
        runVision(visionFiles),
      ]);
      setCoords(location);

      let nextCategory = category;
      let visibleName: string | null = null;
      if (vision?.ok && vision.category) {
        nextCategory = vision.category;
        setCategory(vision.category);
        setCategorySuggested(true);
        setVisionHint(null);
        visibleName = vision.visible_store_name;
        setVisionStoreName(visibleName);
      } else if (vision?.ok) {
        setCategorySuggested(false);
        setVisionHint("No clear category from the photo — please pick one.");
        visibleName = vision.visible_store_name;
        setVisionStoreName(visibleName);
      } else {
        setCategorySuggested(false);
        setVisionHint(
          "Couldn't auto-detect from the photo — pick a category manually.",
        );
        setVisionStoreName(null);
      }

      const placesResult = await runPlaces({
        lat: location.lat,
        lng: location.lng,
        category: nextCategory || "Other",
        visibleStoreName: visibleName,
      });

      const places = placesResult?.places ?? [];
      setNearbyPlaces(places);

      if (placesResult?.autoMatch) {
        setSelectedPlace(placesResult.autoMatch);
        setStoreUi({ mode: "auto", place: placesResult.autoMatch });
        setStoreNameText("");
      } else if (places.length > 0) {
        setSelectedPlace(null);
        setStoreUi({ mode: "list" });
        setStoreNameText("");
      } else if (visibleName) {
        setSelectedPlace(null);
        setStoreUi({ mode: "manual" });
        setStoreNameText("");
        // Offer one-tap prefill via UI button — keep field empty until they tap
      } else {
        setSelectedPlace(null);
        setStoreUi({ mode: "manual" });
      }

      setStep("share");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not get location.");
    } finally {
      setAnalyzing(false);
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

    if (selectedPlace) {
      if (selectedPlace.partnerStoreId) {
        originatorStoreId = selectedPlace.partnerStoreId;
        resolution = "matched";
      } else {
        storeName = selectedPlace.name;
        resolution = "suggested";
      }
    } else if (storeNameText.trim()) {
      // Typed name — still try partner name match
      const typed = storeNameText.trim();
      const partner = stores.find(
        (s) => s.name.trim().toLowerCase() === typed.toLowerCase(),
      );
      if (partner) {
        originatorStoreId = partner.id;
        resolution = "matched";
      } else {
        storeName = typed;
        resolution = "user_entered";
      }
    } else {
      setError("Pick a store or type the store name.");
      return;
    }

    setSubmitting(true);
    try {
      const photoUrls = await Promise.all(
        photos.map((f) => uploadPhoto("product-photos", f)),
      );

      const result = await createOriginatorToken({
        photoUrls,
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

  const busy = locating || analyzing;

  return (
    <form onSubmit={handleSubmit} className="space-y-6 pb-28">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900">
          What did you discover today?
        </h2>
        <p className="mt-1 text-sm text-zinc-600">
          Add 1–{MAX_TOKEN_PHOTOS} photos of your finds. Where possible, include
          a photo of the retail store name or frontage where you are — it could
          be on a product tag, a pillar, or signage. Location comes only when
          you are ready to share.
        </p>
      </div>

      <div>
        <p className="mb-1.5 text-sm font-medium text-zinc-700">Your finds</p>
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

      {step === "photos" ? (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-zinc-200 bg-white/95 p-3 backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
          <button
            type="button"
            onClick={handleWantToShare}
            disabled={busy || photos.length < 1}
            className="mx-auto flex min-h-12 w-full max-w-lg items-center justify-center rounded-xl bg-emerald-700 px-4 py-3.5 text-base font-medium text-white transition-colors hover:bg-emerald-800 disabled:opacity-60"
          >
            {locating
              ? "Getting location…"
              : analyzing
                ? "Looking at your photos…"
                : "Share"}
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
              onClick={() =>
                captureLocation().catch((e) => setError(e.message))
              }
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
              {categorySuggested
                ? "Suggested — tap to change"
                : visionHint ?? "Pick the category that fits your find."}
            </p>
            <select
              id="category"
              value={category}
              required
              onChange={(e) => {
                setCategory(e.target.value);
                setCategorySuggested(false);
                setVisionHint(null);
              }}
              className="min-h-12 w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            >
              <option value="" disabled>
                Select a category…
              </option>
              {TOKEN_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <p className="mb-1.5 text-sm font-medium text-zinc-700">
              Store where you found it
            </p>

            {storeUi.mode === "auto" ? (
              <div className="space-y-3">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-emerald-800">
                    You&apos;re at
                  </p>
                  <p className="mt-1 text-base font-semibold text-zinc-900">
                    {storeUi.place.name}
                    {storeUi.place.address
                      ? ` — ${storeUi.place.address}`
                      : ""}
                  </p>
                  <p className="mt-1 text-sm text-zinc-600">
                    {storeUi.place.distanceM}m away
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setStoreUi({ mode: "list" });
                    setSelectedPlace(null);
                  }}
                  className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-medium text-zinc-800"
                >
                  Not here? Choose another store
                </button>
              </div>
            ) : null}

            {storeUi.mode === "list" ? (
              <div className="space-y-2">
                <p className="mb-2 text-sm text-zinc-500">
                  Are you at one of these?
                </p>
                {nearbyPlaces.map((p) => {
                  const selected = selectedPlace?.placeId === p.placeId;
                  return (
                    <button
                      key={p.placeId}
                      type="button"
                      onClick={() => {
                        setSelectedPlace(p);
                        setStoreNameText("");
                      }}
                      className={`w-full rounded-2xl border px-4 py-3 text-left transition-colors ${
                        selected
                          ? "border-emerald-600 bg-emerald-50"
                          : "border-zinc-200 bg-white hover:border-zinc-300"
                      }`}
                    >
                      <p className="font-medium text-zinc-900">{p.name}</p>
                      <p className="mt-0.5 text-sm text-zinc-500">
                        {p.distanceM}m away
                        {p.address ? ` · ${p.address}` : ""}
                        {p.partnerStoreId ? " · partner store" : ""}
                      </p>
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => {
                    setStoreUi({ mode: "other" });
                    setSelectedPlace(null);
                  }}
                  className="w-full rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-3 text-left text-sm font-medium text-zinc-700"
                >
                  Other / not listed
                </button>
              </div>
            ) : null}

            {storeUi.mode === "other" || storeUi.mode === "manual" ? (
              <div className="space-y-3">
                {storeUi.mode === "manual" && visionStoreName ? (
                  <button
                    type="button"
                    onClick={() => setStoreNameText(visionStoreName)}
                    className="w-full rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-left text-sm text-emerald-900"
                  >
                    Looks like: <span className="font-semibold">{visionStoreName}</span>{" "}
                    — tap to use
                  </button>
                ) : null}
                {storeUi.mode === "other" && nearbyPlaces.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setStoreUi({ mode: "list" })}
                    className="text-sm font-medium text-emerald-800 underline"
                  >
                    ← Back to nearby list
                  </button>
                ) : null}
                <input
                  type="text"
                  value={storeNameText}
                  onChange={(e) => {
                    setStoreNameText(e.target.value);
                    setSelectedPlace(null);
                  }}
                  placeholder="e.g. Body Shop, Phoenix Mall"
                  className="min-h-12 w-full rounded-xl border border-zinc-300 px-4 py-3 text-base"
                />
                {storeUi.mode === "manual" ? (
                  <p className="text-xs text-zinc-500">
                    No stores found nearby — type the store name.
                  </p>
                ) : null}
              </div>
            ) : null}
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
