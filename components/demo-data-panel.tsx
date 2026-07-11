"use client";

import { useState, useTransition } from "react";
import {
  loadDemoDataAction,
  resetDemoDataAction,
  type DemoActionResult,
} from "@/lib/actions/demo";
import type { ChainSeedReport } from "@/lib/demo/seed";

function ChainReportCard({ report }: { report: ChainSeedReport }) {
  return (
    <article className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm">
      <h3 className="font-semibold text-zinc-900">{report.label}</h3>
      <p className="mt-1 font-mono text-xs text-zinc-600">
        Codes: {report.codes.join(" · ")}
      </p>
      <p className="mt-3 text-zinc-800">
        Genuineness score:{" "}
        <strong className="text-emerald-800">
          {report.genuinenessScore.toFixed(3)}
        </strong>
      </p>
      <ul className="mt-2 list-inside list-disc text-zinc-600">
        {report.reasons.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
      <p className="mt-2 text-zinc-600">
        Flags: barcode {report.flags.barcode_match ? "✓" : "✗"}, store{" "}
        {report.flags.store_match ? "✓" : "✗"}, within window{" "}
        {report.flags.within_window ? "✓" : "✗"}
      </p>
      {report.hops.length > 0 && (
        <div className="mt-3">
          <p className="font-medium text-zinc-700">Hops</p>
          <ul className="mt-1 space-y-1 text-xs text-zinc-600">
            {report.hops.map((h, i) => (
              <li key={i}>
                {h.fromLabel} → {h.toLabel}:{" "}
                {h.distance_m != null ? `${h.distance_m} m` : "—"},{" "}
                {h.time_minutes != null ? `${h.time_minutes} min` : "—"}
                {h.suspicious ? " (suspicious)" : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="mt-3 text-zinc-800">
        Purchase ₹{report.amount.toFixed(2)} · scored pool ₹
        {report.scoredPool.toFixed(2)}
        {report.usedZeroScoreFloor ? " · zero-score floor applied" : ""} ·{" "}
        <strong>base_pool ₹{report.basePool.toFixed(2)}</strong>
      </p>
      <ul className="mt-2 space-y-1">
        {report.rewards.map((r) => (
          <li key={`${r.role}-${r.userId}`} className="flex justify-between gap-2">
            <span className="font-mono text-zinc-700">
              {r.role} · {r.publicId}
            </span>
            <span className="font-medium text-emerald-800">
              ₹{r.amount.toFixed(2)}
            </span>
          </li>
        ))}
      </ul>
    </article>
  );
}

export function DemoDataPanel() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<DemoActionResult | null>(null);

  const run = (action: "load" | "reset") => {
    startTransition(async () => {
      const res =
        action === "load"
          ? await loadDemoDataAction()
          : await resetDemoDataAction();
      setResult(res);
    });
  };

  return (
    <section className="mt-8 rounded-2xl border border-amber-200 bg-amber-50/60 p-5 shadow-sm">
      <h2 className="font-semibold text-zinc-900">Demo data</h2>
      <p className="mt-2 text-sm text-zinc-600">
        Load branching referral trees (children multiply under each parent),
        multiple products, and a couple of scoring contrast cases. Open{" "}
        <span className="font-medium">Network</span> on root codes like{" "}
        <span className="font-mono">DEMOT1A</span> to see the full tree. Rows are
        tagged <span className="font-mono">is_demo</span>. Customers only;
        rewards from the real genuineness engine.
      </p>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={() => run("load")}
          className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
        >
          {pending ? "Working…" : "Load demo data"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => run("reset")}
          className="rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-60"
        >
          Reset demo data
        </button>
      </div>

      {result && !result.ok && (
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {result.error}
        </p>
      )}

      {result?.ok && result.action === "reset" && (
        <p className="mt-4 rounded-xl bg-white px-4 py-3 text-sm text-zinc-700">
          {result.message}
        </p>
      )}

      {result?.ok && result.action === "load" && (
        <div className="mt-4 space-y-4">
          <p className="text-sm text-zinc-700">
            Seeded. Try Referral Assist with{" "}
            <span className="font-mono">{result.assistCodes.join(", ")}</span>
          </p>
          {result.reports.map((report) => (
            <ChainReportCard key={report.label} report={report} />
          ))}
        </div>
      )}
    </section>
  );
}
