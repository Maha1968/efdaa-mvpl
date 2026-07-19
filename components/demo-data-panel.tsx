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
    <article className="rounded-xl border border-border bg-surface-muted p-4 text-sm">
      <h3 className="font-semibold text-text-primary">{report.label}</h3>
      <p className="mt-1 font-mono text-xs text-text-secondary">
        Codes: {report.codes.join(" · ")}
      </p>
      <p className="mt-3 text-text-primary">
        Genuineness score:{" "}
        <strong className="text-primary">
          {report.genuinenessScore.toFixed(3)}
        </strong>
      </p>
      <ul className="mt-2 list-inside list-disc text-text-secondary">
        {report.reasons.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
      <p className="mt-3 text-text-primary">
        Purchase ₹{report.amount.toFixed(2)} · pool{" "}
        <strong>₹{report.basePool.toFixed(2)}</strong>
        {report.usedZeroScoreFloor ? " (zero-score floor)" : ""}
      </p>
      <ul className="mt-2 space-y-1">
        {report.rewards.map((r) => (
          <li key={`${r.role}-${r.userId}`} className="flex justify-between gap-2">
            <span className="font-mono text-text-secondary">
              {r.role} · {r.publicId}
            </span>
            <span className="font-medium text-primary">
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
    <section className="mt-8 rounded-2xl border border-warning/25 bg-warning-soft/60 p-5 shadow-sm">
      <h2 className="font-semibold text-text-primary">Demo data</h2>
      <p className="mt-2 text-sm text-text-secondary">
        Load depth-4 branching trees (parent → child → grandchild →
        great-grandchild). Roots:{" "}
        <span className="font-mono">DEMOT1A</span>,{" "}
        <span className="font-mono">DEMOT2A</span>,{" "}
        <span className="font-mono">DEMOT3A</span>. Also seeds DEMOGEN0 / DEMOPRX0 /
        DEMOEXP0 for the public <span className="font-mono">/demo</span> page. Load
        may take up to a minute. Then open Network, Referral Assist, or /demo.
        Customer login for <span className="font-mono">DEMOT1A</span> originator:{" "}
        <span className="font-mono">demo_user@efdaa.com</span> /{" "}
        <span className="font-mono">demo_user</span>.
      </p>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={() => run("load")}
          className="rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-60"
        >
          {pending ? "Working… (do not close)" : "Load demo data"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => run("reset")}
          className="rounded-xl border border-border-strong bg-surface px-4 py-2.5 text-sm font-medium text-text-primary hover:bg-surface-muted disabled:opacity-60"
        >
          Reset demo data
        </button>
      </div>

      {pending && (
        <p className="mt-3 text-sm text-warning">
          Seeding in progress — stay on this page until it finishes.
        </p>
      )}

      {result && !result.ok && (
        <p className="mt-4 rounded-xl bg-error-soft px-4 py-3 text-sm text-error">
          {result.error}
        </p>
      )}

      {result?.ok && result.action === "reset" && (
        <p className="mt-4 rounded-xl bg-surface px-4 py-3 text-sm text-text-secondary">
          {result.message}
        </p>
      )}

      {result?.ok && result.action === "load" && (
        <div className="mt-4 space-y-4">
          <p className="text-sm text-text-secondary">{result.summary}</p>
          <p className="text-sm text-text-secondary">
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
