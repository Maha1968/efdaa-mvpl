"use client";

import { useState, useTransition } from "react";
import { rejectPurchase, validatePurchase } from "@/lib/actions/purchases";

type AdminPurchaseActionsProps = {
  purchaseId: string;
};

export function AdminPurchaseActions({ purchaseId }: AdminPurchaseActionsProps) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [action, setAction] = useState<"validate" | "reject" | null>(null);

  function handleValidate() {
    setError(null);
    setAction("validate");
    startTransition(async () => {
      const result = await validatePurchase(purchaseId);
      // redirect() throws; only handle returned errors
      if (result?.error) {
        setError(result.error);
        setAction(null);
      }
    });
  }

  function handleReject() {
    setError(null);
    setAction("reject");
    startTransition(async () => {
      const result = await rejectPurchase(purchaseId);
      if (result?.error) {
        setError(result.error);
      }
      setAction(null);
    });
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={handleValidate}
          disabled={isPending}
          className="rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
        >
          {isPending && action === "validate" ? "Validating..." : "Validate"}
        </button>
        <button
          type="button"
          onClick={handleReject}
          disabled={isPending}
          className="rounded-xl border border-red-300 bg-error-soft px-4 py-2.5 text-sm font-medium text-error disabled:opacity-60"
        >
          {isPending && action === "reject" ? "Rejecting..." : "Reject"}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
