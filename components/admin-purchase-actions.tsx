"use client";

import { useState } from "react";
import { rejectPurchase, validatePurchase } from "@/lib/actions/purchases";

type AdminPurchaseActionsProps = {
  purchaseId: string;
};

export function AdminPurchaseActions({ purchaseId }: AdminPurchaseActionsProps) {
  const [loading, setLoading] = useState<"validate" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleValidate() {
    setLoading("validate");
    setError(null);
    const result = await validatePurchase(purchaseId);
    if (result.error) setError(result.error);
    setLoading(null);
  }

  async function handleReject() {
    setLoading("reject");
    setError(null);
    const result = await rejectPurchase(purchaseId);
    if (result.error) setError(result.error);
    setLoading(null);
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={handleValidate}
          disabled={loading !== null}
          className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
        >
          {loading === "validate" ? "Validating..." : "Validate"}
        </button>
        <button
          type="button"
          onClick={handleReject}
          disabled={loading !== null}
          className="rounded-xl border border-red-300 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700 disabled:opacity-60"
        >
          {loading === "reject" ? "Rejecting..." : "Reject"}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
