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
  originatorStore: Store | null;
  storeLabel: string;
  /** When false, receipt barcode is optional (token had no barcode). */
  barcodeRequired: boolean;
  userId: string;
};

function toDatetimeLocalValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function RedeemForm({
  tokenCode,
  product,
  originatorStore,
  storeLabel,
  barcodeRequired,
  userId,
}: RedeemFormProps) {
  const [amount, setAmount] = useState(
    product.price > 0 ? product.price.toString() : "",
  );
  const [receiptBarcode, setReceiptBarcode] = useState(product.barcode || "");
  const [receiptPhoto, setReceiptPhoto] = useState<File | null>(null);
  const [receiptPurchasedAt, setReceiptPurchasedAt] = useState(
    toDatetimeLocalValue(new Date()),
  );
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

    const parsedAmount = Number(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      setError("Please enter a valid purchase amount.");
      return;
    }

    if (barcodeRequired && !receiptBarcode.trim()) {
      setError("Please enter the barcode from your receipt.");
      return;
    }

    if (!receiptPurchasedAt) {
      setError("Please enter the date and time printed on your receipt.");
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
      const receiptIso = new Date(receiptPurchasedAt).toISOString();

      const result = await createPurchase({
        tokenCode,
        storeId: originatorStore?.id,
        amount: parsedAmount,
        receiptBarcode: receiptBarcode.trim(),
        receiptImageUrl,
        purchaseLat: coords.lat,
        purchaseLng: coords.lng,
        receiptPurchasedAt: receiptIso,
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
        {product.price > 0 ? (
          <p className="mt-1 text-sm text-zinc-600">₹{product.price}</p>
        ) : null}
      </div>

      <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
        <p className="text-sm font-medium text-emerald-900">
          Originator&apos;s store (required)
        </p>
        <p className="mt-1 text-base font-semibold text-zinc-900">{storeLabel}</p>
        {originatorStore?.address ? (
          <p className="mt-1 text-sm text-zinc-600">{originatorStore.address}</p>
        ) : null}
        <p className="mt-2 text-xs text-zinc-600">
          Purchase GPS should be at this store. Farther than 50 m reduces the
          genuineness score sharply (×0.01).
        </p>
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
          htmlFor="receipt-purchased-at"
          className="mb-1.5 block text-sm font-medium text-zinc-700"
        >
          Date &amp; time on receipt
        </label>
        <p className="mb-2 text-sm text-zinc-500">
          Enter exactly as printed on the invoice — this is the purchase time.
        </p>
        <input
          id="receipt-purchased-at"
          type="datetime-local"
          required
          value={receiptPurchasedAt}
          onChange={(e) => setReceiptPurchasedAt(e.target.value)}
          className="min-h-12 w-full rounded-xl border border-zinc-300 px-4 py-3 text-base outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
        />
      </div>

      <div>
        <label
          htmlFor="receipt-barcode"
          className="mb-1.5 block text-sm font-medium text-zinc-700"
        >
          Barcode on receipt
          {!barcodeRequired ? (
            <span className="font-normal text-zinc-400"> (optional)</span>
          ) : null}
        </label>
        {!barcodeRequired ? (
          <p className="mb-2 text-sm text-zinc-500">
            This recommendation had no barcode — leaving blank is fine
            (barcode_match = not_provided, no score penalty).
          </p>
        ) : null}
        <input
          id="receipt-barcode"
          type="text"
          inputMode="numeric"
          required={barcodeRequired}
          value={receiptBarcode}
          onChange={(e) => setReceiptBarcode(e.target.value)}
          className="min-h-12 w-full rounded-xl border border-zinc-300 px-4 py-3 text-base outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
        />
      </div>

      <PhotoUpload
        id="receipt-photo"
        label="Receipt photo"
        hint="Photograph your store receipt (showing the date/time)."
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
