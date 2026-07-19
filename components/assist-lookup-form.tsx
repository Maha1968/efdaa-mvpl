"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AssistLookupForm({ initialCode }: { initialCode: string }) {
  const router = useRouter();
  const [code, setCode] = useState(initialCode);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const cleaned = code.trim().toUpperCase();
    if (!cleaned) return;
    router.push(`/admin/assist?code=${encodeURIComponent(cleaned)}`);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 sm:flex-row"
    >
      <input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="Enter referral / token code"
        className="flex-1 rounded-xl border border-border-strong px-4 py-3 font-mono text-sm outline-none focus:border-primary"
      />
      <button
        type="submit"
        className="rounded-xl bg-primary px-5 py-3 text-sm font-medium text-white"
      >
        Trace
      </button>
    </form>
  );
}
