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
      <p className="mt-3 text-zinc-800">
        Purchase ₹{report.amount.toFixed(2)} · pool{" "}
        <strong>₹{report.basePool.toFixed(2)}</strong>
        {report.usedZeroScoreFloor ? " (zero-score floor)" : ""}
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
    setResult(null);
    startTransition(async () => {
      try {
        const res =
          action === "load"
            ? await loadDemoDataAction()
            : await resetDemoDataAction();
        setResult(res);
      } catch (e) {
        setResult({
          ok: false,
          error:
            e instanceof Error
              ? e.message
              : "Load failed or timed out. Wait a moment, reload /admin, then try Reset → Load again.",
        });
      }
    });
  };

  return (
    <section className="mt-8 rounded-2xl border border-amber-200 bg-amber-50/60 p-5 shadow-sm">
      <h2 className="font-semibold text-zinc-900">Demo data</h2>
      <p className="mt-2 text-sm text-zinc-600">
        Load depth-4 branching trees (parent → child → grandchild →
        great-grandchild). Roots:{" "}
        <span className="font-mono">DEMOT1A</span>,{" "}
        <span className="font-mono">DEMOT2A</span>,{" "}
        <span className="font-mono">DEMOT3A</span>. Load may take up to a
        minute. Then open Network or Referral Assist.
      </p>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={() => run("load")}
          className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
        >
          {pending ? "Working… (do not close)" : "Load demo data"}
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

      {pending && (
        <p className="mt-3 text-sm text-amber-900">
          Seeding in progress — stay on this page until it finishes.
        </p>
      )}

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
          <p className="text-sm text-zinc-700">{result.summary}</p>
          <p className="text-sm text-zinc-700">
            Roots:{" "}
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
