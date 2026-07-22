"use client";

import Link from "next/link";
import { useState } from "react";
import { formatRewardAmount } from "@/lib/purchases/rewards";
import type { CustomerPointsDashboardData } from "@/lib/dashboard/customer-points";

function statusClass(status: string) {
  if (status === "Active") return "bg-primary-soft text-primary";
  if (status === "Completed") return "bg-info-soft text-info";
  return "bg-surface-muted text-text-secondary";
}

function earnAsLabel(earnAs: "forwarder" | "last_referrer") {
  return earnAs === "last_referrer" ? "Last referrer" : "Forwarder";
}

function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function CustomerPointsDashboard({
  data,
}: {
  data: CustomerPointsDashboardData;
}) {
  const { summary, originator, forwarder, buyer } = data;
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="space-y-10">
      <section className="rounded-2xl border border-primary/25 bg-primary-soft p-6 text-center sm:p-8">
        <p className="text-sm font-medium text-primary">You have</p>
        <p className="mt-1 text-4xl font-semibold tracking-tight text-primary sm:text-5xl">
          {formatRewardAmount(summary.lifetime)}
        </p>
        <p className="mt-1 text-base text-primary">MOJODAA points</p>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => scrollToId("section-originator")}
            className="rounded-xl border border-primary/25 bg-surface px-3 py-4 text-left shadow-sm transition hover:border-primary/40"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
              As Originator
            </p>
            <p className="mt-1 text-2xl font-semibold text-text-primary">
              {formatRewardAmount(summary.asOriginator)}
            </p>
          </button>
          <button
            type="button"
            onClick={() => scrollToId("section-forwarder")}
            className="rounded-xl border border-primary/25 bg-surface px-3 py-4 text-left shadow-sm transition hover:border-primary/40"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
              As Forwarder
            </p>
            <p className="mt-1 text-2xl font-semibold text-text-primary">
              {formatRewardAmount(summary.asForwarder)}
            </p>
          </button>
          <button
            type="button"
            onClick={() => scrollToId("section-buyer")}
            className="rounded-xl border border-primary/25 bg-surface px-3 py-4 text-left shadow-sm transition hover:border-primary/40"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
              As Buyer
            </p>
            <p className="mt-1 text-2xl font-semibold text-text-primary">
              {formatRewardAmount(summary.asBuyer)}
            </p>
          </button>
        </div>

        <Link
          href="/efdaagifts"
          className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-primary px-4 py-3.5 text-base font-medium text-white transition-colors hover:bg-primary-hover sm:w-auto"
        >
          Buy using MOJODAA points
        </Link>
      </section>

      {/* Section 1 */}
      <section id="section-originator" className="scroll-mt-6">
        <h2 className="text-lg font-semibold text-text-primary">As Originator</h2>
        <p className="mt-1 text-sm text-text-secondary">
          Products you recommended — performance by level, aggregates only.
        </p>

        {originator.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-border bg-surface p-5 text-sm text-text-secondary">
            You haven&apos;t recommended a product yet.{" "}
            <Link href="/create" className="text-primary underline">
              Recommend a product
            </Link>{" "}
            to start earning points as an originator.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {originator.map((row) => {
              const open = openId === row.id;
              return (
                <li
                  key={row.id}
                  className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm"
                >
                  <button
                    type="button"
                    onClick={() => setOpenId(open ? null : row.id)}
                    className="flex w-full items-start gap-3 p-4 text-left"
                  >
                    {row.productPhotoUrl ? (
                      <img
                        src={row.productPhotoUrl}
                        alt=""
                        className="h-14 w-14 shrink-0 rounded-lg object-cover bg-surface-muted"
                      />
                    ) : (
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-xs text-text-muted">
                        No photo
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="font-medium text-text-primary">
                          {row.productName}
                        </p>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusClass(row.status)}`}
                        >
                          {row.status}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-text-muted">
                        Recommended{" "}
                        {new Date(row.recommendedAt).toLocaleDateString()}
                      </p>
                      <p className="mt-2 text-sm text-text-secondary">
                        {row.totalPurchases} purchase
                        {row.totalPurchases === 1 ? "" : "s"} ·{" "}
                        <span className="font-semibold text-primary">
                          {formatRewardAmount(row.totalPoints)} points
                        </span>
                      </p>
                      <p className="mt-1 text-xs text-primary">
                        {open ? "Hide levels ▲" : "Performance by level ▼"}
                      </p>
                    </div>
                  </button>

                  {open && (
                    <div className="border-t border-border bg-surface-muted px-4 py-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
                        Performance by level
                      </p>
                      <div className="mt-2 overflow-x-auto">
                        <table className="w-full min-w-[360px] text-left text-xs sm:text-sm">
                          <thead>
                            <tr className="text-text-muted">
                              <th className="py-1.5 font-medium">Level</th>
                              <th className="py-1.5 font-medium">Forwards</th>
                              <th className="py-1.5 font-medium">Purchases</th>
                              <th className="py-1.5 font-medium">Value</th>
                              <th className="py-1.5 font-medium">Your points</th>
                            </tr>
                          </thead>
                          <tbody>
                            {row.levels.map((l) => (
                              <tr
                                key={l.level}
                                className="border-t border-border"
                              >
                                <td className="py-1.5">Level {l.level}</td>
                                <td className="py-1.5">{l.forwards}</td>
                                <td className="py-1.5">{l.purchases}</td>
                                <td className="py-1.5">
                                  ₹{l.purchaseValue.toFixed(0)}
                                </td>
                                <td className="py-1.5 font-medium text-primary">
                                  {formatRewardAmount(l.pointsEarned)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <p className="mt-3 text-sm text-text-secondary">
                        Total for this recommendation:{" "}
                        <span className="font-semibold">
                          {row.totalPurchases} purchase
                          {row.totalPurchases === 1 ? "" : "s"}, you earned{" "}
                          {formatRewardAmount(row.totalPoints)} points
                        </span>
                      </p>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Section 2 */}
      <section id="section-forwarder" className="scroll-mt-6">
        <h2 className="text-lg font-semibold text-text-primary">As Forwarder</h2>
        <p className="mt-1 text-sm text-text-secondary">
          Chains you passed on that earned you points — your contribution only.
        </p>

        {forwarder.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-border bg-surface p-5 text-sm text-text-secondary">
            No forwarder earnings yet. When someone shares a recommendation with
            you, pass it on — you earn points if a purchase converts later.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {forwarder.map((row) => (
              <li
                key={row.id}
                className="rounded-2xl border border-border bg-surface p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-text-primary">{row.productName}</p>
                    <p className="mt-1 text-xs text-text-muted">
                      Forwarded {new Date(row.forwardedAt).toLocaleDateString()}
                    </p>
                    <p className="mt-2 text-sm text-text-secondary">
                      {row.converted ? "Converted" : "Not converted"} · earned
                      as {earnAsLabel(row.earnAs)}
                    </p>
                  </div>
                  <p className="text-lg font-semibold text-primary">
                    {formatRewardAmount(row.points)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Section 3 */}
      <section id="section-buyer" className="scroll-mt-6">
        <h2 className="text-lg font-semibold text-text-primary">As Buyer</h2>
        <p className="mt-1 text-sm text-text-secondary">
          Purchases you made through a recommendation.
        </p>

        {buyer.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-border bg-surface p-5 text-sm text-text-secondary">
            No buyer points yet. Redeem a recommendation at a partner store to
            earn points as a buyer.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {buyer.map((row) => (
              <li
                key={row.id}
                className="rounded-2xl border border-border bg-surface p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-text-primary">{row.productName}</p>
                    <p className="mt-1 text-sm text-text-secondary">{row.storeName}</p>
                    <p className="mt-1 text-xs text-text-muted">
                      {new Date(row.purchasedAt).toLocaleString()} · ₹
                      {row.amount.toFixed(2)}
                    </p>
                  </div>
                  <p className="text-lg font-semibold text-primary">
                    {formatRewardAmount(row.points)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
