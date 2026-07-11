"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { createPurchase } from "@/lib/actions/purchases";
import { LocationCapture } from "@/components/location-capture";
import { PhotoUpload } from "@/components/photo-upload";
import type { Product, Store } from "@/types/database";

type RedeemFormProps = {
  tokenCode: string;
  product: Product;
  stores: Store[];
  userId: string;
};

export function RedeemForm({
  tokenCode,
  product,
  stores,
  userId,
}: RedeemFormProps) {
  const [storeId, setStoreId] = useState(stores[0]?.id ?? "");
  const [amount, setAmount] = useState(product.price.toString());
  const [receiptBarcode, setReceiptBarcode] = useState(product.barcode);
  const [receiptPhoto, setReceiptPhoto] = useState<File | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function uploadReceipt(file: File) {
    const supabase = createClient();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${userId}/${Date.now()}-${safeName}`;
    const { error: uploadError } = await supabase.storage
      .from("receipts")
      .upload(path, file, { upsert: false });

    if (uploadError) throw new Error(uploadError.message);

    const {
      data: { publicUrl },
    } = supabase.storage.from("receipts").getPublicUrl(path);

    return publicUrl;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!storeId) {
      setError("Please select a store.");
      return;
    }

    const parsedAmount = Number(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      setError("Please enter a valid purchase amount.");
      return;
    }

    if (!receiptBarcode.trim()) {
      setError("Please enter the barcode from your receipt.");
      return;
    }

    if (!receiptPhoto) {
      setError("Please upload a photo of your receipt.");
      return;
    }

    if (!coords) {
      setError("Please capture your purchase location.");
      return;
    }

    setLoading(true);

    try {
      const receiptImageUrl = await uploadReceipt(receiptPhoto);

      const result = await createPurchase({
        tokenCode,
        storeId,
        amount: parsedAmount,
        receiptBarcode: receiptBarcode.trim(),
        receiptImageUrl,
        purchaseLat: coords.lat,
        purchaseLng: coords.lng,
      });

      if (result?.error) {
        setError(result.error);
        setLoading(false);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? `Upload or submit failed: ${err.message}`
          : "Upload or submit failed. Check your connection and try again.",
      );
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 pb-28">
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <p className="text-sm font-medium text-zinc-500">Product</p>
        <p className="mt-1 text-lg font-semibold text-zinc-900">{product.name}</p>
        <p className="mt-1 text-sm text-zinc-600">₹{product.price}</p>
      </div>

      <div>
        <label htmlFor="store" className="mb-1.5 block text-sm font-medium text-zinc-700">
          Store where you bought it
        </label>
        <select
          id="store"
          value={storeId}
          onChange={(e) => setStoreId(e.target.value)}
          className="min-h-12 w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
        >
          {stores.map((store) => (
            <option key={store.id} value={store.id}>
              {store.name}
              {store.address ? ` — ${store.address}` : ""}
            </option>
          ))}
        </select>
      </div>

      <LocationCapture
        coords={coords}
        onCoordsChange={setCoords}
        locationText=""
        onLocationTextChange={() => {}}
        onError={setError}
        showPlaceName={false}
      />

      <div>
        <label htmlFor="amount" className="mb-1.5 block text-sm font-medium text-zinc-700">
          Purchase amount (₹)
        </label>
        <input
          id="amount"
          type="number"
          min="1"
          step="0.01"
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="min-h-12 w-full rounded-xl border border-zinc-300 px-4 py-3 text-base outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
        />
      </div>

      <div>
        <label
          htmlFor="receipt-barcode"
          className="mb-1.5 block text-sm font-medium text-zinc-700"
        >
          Barcode on receipt
        </label>
        <input
          id="receipt-barcode"
          type="text"
          inputMode="numeric"
          required
          value={receiptBarcode}
          onChange={(e) => setReceiptBarcode(e.target.value)}
          className="min-h-12 w-full rounded-xl border border-zinc-300 px-4 py-3 text-base outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
        />
      </div>

      <PhotoUpload
        id="receipt-photo"
        label="Receipt photo"
        hint="Photograph your store receipt."
        value={receiptPhoto}
        onChange={setReceiptPhoto}
      />

      {error && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-zinc-200 bg-white/95 p-3 backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
        <button
          type="submit"
          disabled={loading}
          className="mx-auto flex min-h-12 w-full max-w-lg items-center justify-center rounded-xl bg-emerald-700 px-4 py-3.5 text-base font-medium text-white transition-colors hover:bg-emerald-800 disabled:opacity-60"
        >
          {loading ? "Submitting…" : "Submit purchase"}
        </button>
      </div>
    </form>
  );
}
