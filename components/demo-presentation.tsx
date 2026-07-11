import { Libre_Franklin, Fraunces } from "next/font/google";
import type { DemoPresentationData, DemoPresentationChain } from "@/lib/demo/presentation";
import { formatRewardAmount, ZERO_SCORE_FLOOR_REWARD_PCT } from "@/lib/demo/presentation";

const sans = Libre_Franklin({
  subsets: ["latin"],
  variable: "--font-demo-sans",
});

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-demo-display",
});

function scoreColor(band: DemoPresentationChain["scoreBand"]) {
  if (band === "strong") return "text-emerald-700";
  if (band === "reduced") return "text-amber-700";
  return "text-zinc-500";
}

function scoreBg(band: DemoPresentationChain["scoreBand"]) {
  if (band === "strong") return "bg-emerald-50 border-emerald-200";
  if (band === "reduced") return "bg-amber-50 border-amber-200";
  return "bg-zinc-100 border-zinc-200";
}

function scoreWord(band: DemoPresentationChain["scoreBand"]) {
  if (band === "strong") return "Strong";
  if (band === "reduced") return "Reduced";
  return "Zero";
}

function roleLabel(role: string) {
  if (role === "originator") return "Originator";
  if (role === "last_referrer") return "Last referrer";
  if (role === "forwarder") return "Forwarder";
  if (role === "buyer") return "Buyer";
  return role;
}

function ChainColumn({ chain }: { chain: DemoPresentationChain }) {
  return (
    <article className="flex flex-col rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-7">
      <header className="border-b border-zinc-100 pb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
          {chain.subtitle}
        </p>
        <h2
          className={`${display.className} mt-2 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl`}
        >
          {chain.title}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-zinc-600 sm:text-base">
          {chain.thesis}
        </p>
      </header>

      {/* Score hero */}
      <div
        className={`mt-6 rounded-2xl border px-5 py-6 text-center ${scoreBg(chain.scoreBand)}`}
      >
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
          Genuineness score
        </p>
        <p
          className={`${display.className} mt-2 text-6xl font-semibold tabular-nums sm:text-7xl ${scoreColor(chain.scoreBand)}`}
        >
          {chain.score.toFixed(2)}
        </p>
        <p className={`mt-2 text-sm font-semibold ${scoreColor(chain.scoreBand)}`}>
          {scoreWord(chain.scoreBand)}
        </p>
        {chain.usedZeroScoreFloor && (
          <p className="mt-3 text-sm font-medium text-zinc-700">
            Floor paid at {(ZERO_SCORE_FLOOR_REWARD_PCT * 100).toFixed(1)}% — the
            record survives even when the scored pool is ₹0.
          </p>
        )}
      </div>

      {/* Chain flow */}
      <div className="mt-8">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
          The chain
        </p>
        <ol className="mt-4 space-y-0">
          {chain.nodes.map((node, i) => (
            <li key={`${node.role}-${node.publicUserId}-${i}`}>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
                  {node.role}
                </p>
                <p className="mt-1 font-mono text-sm font-medium text-zinc-800">
                  {node.publicUserId}
                </p>
                <p className="mt-2 text-sm text-zinc-700">{node.place}</p>
                {node.coords && (
                  <p className="mt-0.5 font-mono text-xs text-zinc-500">
                    {node.coords}
                  </p>
                )}
                <p className="mt-1 text-xs text-zinc-500">
                  {new Date(node.at).toLocaleString()}
                </p>
              </div>
              {i < chain.hops.length && (
                  <div
                  className={`my-2 flex items-center gap-3 px-2 ${
                    chain.hops[i].scoresProximity
                      ? chain.hops[i].suspicious
                        ? "text-amber-800"
                        : "text-emerald-800"
                      : chain.hops[i].suspicious
                        ? "text-amber-800"
                        : "text-zinc-700"
                  }`}
                >
                  <div
                    className={`h-8 w-0.5 shrink-0 ${
                      chain.hops[i].scoresProximity
                        ? chain.hops[i].suspicious
                          ? "bg-amber-400"
                          : "bg-emerald-500"
                        : "bg-zinc-300"
                    }`}
                  />
                  <div className="min-w-0 flex-1 rounded-xl border border-dashed border-zinc-300 bg-white px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                      {chain.hops[i].scoresProximity
                        ? "Scores genuineness"
                        : `Hop ${i + 1}`}
                      {chain.hops[i].suspicious ? " · flagged" : ""}
                    </p>
                    <p
                      className={`${display.className} text-lg font-semibold tabular-nums sm:text-xl`}
                    >
                      {chain.hops[i].label}
                    </p>
                    {chain.hops[i].scoresProximity ? (
                      <p className="mt-1 text-xs text-zinc-600">
                        Originator claim → buyer claim
                      </p>
                    ) : null}
                  </div>
                </div>
              )}
            </li>
          ))}
        </ol>
      </div>

      {/* Purchase */}
      <div className="mt-8 border-t border-zinc-100 pt-6">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
          The purchase
        </p>
        <div className="mt-3 flex gap-4">
          {chain.receiptImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={chain.receiptImageUrl}
              alt=""
              className="h-24 w-16 shrink-0 rounded-lg border border-zinc-200 object-cover"
            />
          ) : null}
          <div className="min-w-0 text-sm text-zinc-700">
            <p className="font-semibold text-zinc-900">{chain.productName}</p>
            <p className="mt-1 font-mono text-xs">{chain.barcode}</p>
            <p className="mt-1">{chain.storeName}</p>
            <p className="mt-2 text-lg font-semibold text-zinc-900">
              ₹{chain.amount.toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      {/* Why */}
      <div className="mt-8 border-t border-zinc-100 pt-6">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
          Why this score
        </p>
        <ul className="mt-3 space-y-2">
          {chain.checks.map((c) => (
            <li
              key={c.label}
              className="flex gap-3 rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2.5 text-sm"
            >
              <span
                className={`mt-0.5 shrink-0 text-base font-bold ${
                  c.pass ? "text-emerald-600" : "text-rose-600"
                }`}
                aria-hidden
              >
                {c.pass ? "✓" : "✗"}
              </span>
              <span>
                <span className="font-medium text-zinc-900">{c.label}</span>
                <span className="mt-0.5 block text-zinc-600">{c.detail}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Rewards */}
      <div className="mt-8 border-t border-zinc-100 pt-6">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
          Reward pool
        </p>
        <p className={`${display.className} mt-2 text-3xl font-semibold text-zinc-900`}>
          ₹{formatRewardAmount(chain.basePool)}
        </p>
        {chain.usedZeroScoreFloor ? (
          <p className="mt-1 text-sm text-zinc-600">
            Floor pool (scored pool was ₹{formatRewardAmount(chain.scoredPool)})
          </p>
        ) : (
          <p className="mt-1 text-sm text-zinc-600">
            Split across the chain by role
          </p>
        )}
        <ul className="mt-4 space-y-2">
          {chain.rewards.length === 0 ? (
            <li className="text-sm text-zinc-500">No rewards written.</li>
          ) : (
            chain.rewards.map((r) => (
              <li
                key={`${r.role}-${r.publicUserId}`}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span className="text-zinc-700">
                  {roleLabel(r.role)}{" "}
                  <span className="font-mono text-xs text-zinc-500">
                    {r.publicUserId}
                  </span>
                </span>
                <span className="font-semibold tabular-nums text-zinc-900">
                  ₹{formatRewardAmount(r.amount)}
                </span>
              </li>
            ))
          )}
        </ul>
      </div>
    </article>
  );
}

export function DemoPresentationView({ data }: { data: DemoPresentationData }) {
  return (
    <div
      className={`${sans.variable} ${display.variable} ${sans.className} min-h-full bg-zinc-100 text-zinc-900`}
    >
      <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-8 sm:py-14 lg:px-10 lg:py-16">
        {/* Thesis */}
        <header className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-800">
            EFDAA live demo
          </p>
          <h1
            className={`${display.className} mt-4 text-4xl font-semibold leading-[1.1] tracking-tight text-zinc-950 sm:text-5xl lg:text-6xl`}
          >
            Offline word-of-mouth, made measurable.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-zinc-600 sm:text-lg">
            Three real referral chains. Same product rules. Different behaviour.
            Watch how genuineness scoring decides who gets paid — and how every
            rupee still traces to a validated purchase.
          </p>
        </header>

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {[
            {
              label: "Chains tracked",
              value: String(data.stats.chainsTracked),
            },
            {
              label: "Purchases attributed",
              value: String(data.stats.purchasesAttributed),
            },
            {
              label: "Rewards paid",
              value: `₹${formatRewardAmount(data.stats.rewardsPaid)}`,
            },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-2xl border border-zinc-200 bg-white px-5 py-5 shadow-sm"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                {s.label}
              </p>
              <p
                className={`${display.className} mt-2 text-3xl font-semibold tabular-nums text-zinc-950 sm:text-4xl`}
              >
                {s.value}
              </p>
            </div>
          ))}
        </div>

        <p className="mt-8 max-w-3xl text-base font-medium text-zinc-800 sm:text-lg">
          Look across the three columns: full pay when hops are genuine · cut
          when proximity looks collusive · zero score when expired — yet the
          attribution record and floor reward still exist.
        </p>

        {!data.loaded ? (
          <div className="mt-12 rounded-3xl border border-amber-200 bg-amber-50 px-6 py-10 text-center">
            <p className={`${display.className} text-2xl font-semibold text-zinc-900`}>
              Demo chains not loaded yet
            </p>
            <p className="mx-auto mt-3 max-w-lg text-sm text-zinc-600">
              An administrator must run Demo Data → Load on the admin overview
              (roots include DEMOGEN0, DEMOPRX0, DEMOEXP0). This page only shows
              seeded demo rows — never real customer data.
            </p>
          </div>
        ) : (
          <section className="mt-12 grid gap-8 lg:grid-cols-3 lg:gap-6">
            {data.chains.map((chain) => (
              <ChainColumn key={chain.kind} chain={chain} />
            ))}
          </section>
        )}

        <footer className="mt-16 border-t border-zinc-300/80 pt-10 pb-6">
          <p
            className={`${display.className} max-w-3xl text-2xl font-semibold leading-snug text-zinc-950 sm:text-3xl`}
          >
            Every rupee of reward traces to one validated transaction — and every
            purchase traces back to the person who caused it.
          </p>
          <p className="mt-4 text-sm text-zinc-500">
            Read-only demo · seeded data only · no customer PII
          </p>
        </footer>
      </div>
    </div>
  );
}
