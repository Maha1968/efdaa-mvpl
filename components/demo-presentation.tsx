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
  if (band === "strong") return "text-primary";
  if (band === "reduced") return "text-amber-700";
  return "text-text-muted";
}

function scoreBg(band: DemoPresentationChain["scoreBand"]) {
  if (band === "strong") return "bg-primary-soft border-primary/25";
  if (band === "reduced") return "bg-warning-soft border-warning/25";
  return "bg-surface-muted border-border";
}

function scoreWord(band: DemoPresentationChain["scoreBand"]) {
  if (band === "strong") return "Strong";
  if (band === "reduced") return "Reduced";
  return "Zero";
}

function formatDurationMinutes(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes - h * 60);
  if (m <= 0) return `${h} h`;
  return `${h} h ${m} min`;
}

function roleLabel(role: string) {
  if (role === "originator") return "Originator";
  if (role === "last_referrer") return "Last referrer";
  if (role === "forwarder") return "Forwarder";
  if (role === "buyer") return "Buyer";
  return role;
}

function HopBox({
  hop,
  title,
  subtitle,
}: {
  hop: DemoPresentationChain["scoringHop"];
  title: string;
  subtitle?: string;
}) {
  if (!hop) return null;
  const emphasis = hop.scoresProximity;
  const flagged = hop.suspicious;
  return (
    <div
      className={`my-2 flex items-center gap-3 px-2 ${
        emphasis
          ? flagged
            ? "text-warning"
            : "text-primary"
          : "text-text-secondary"
      }`}
    >
      <div
        className={`h-8 w-0.5 shrink-0 ${
          emphasis
            ? flagged
              ? "bg-amber-400"
              : "bg-primary-soft0"
            : "bg-zinc-300"
        }`}
      />
      <div className="min-w-0 flex-1 rounded-xl border border-dashed border-border-strong bg-surface px-3 py-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
          {title}
          {flagged ? " · flagged" : ""}
        </p>
        <p
          className={`${display.className} text-lg font-semibold tabular-nums sm:text-xl`}
        >
          {hop.label}
        </p>
        {subtitle ? (
          <p className="mt-1 text-xs text-text-secondary">{subtitle}</p>
        ) : null}
      </div>
    </div>
  );
}

function ChainColumn({ chain }: { chain: DemoPresentationChain }) {
  return (
    <article className="flex flex-col rounded-3xl border border-border bg-surface p-5 shadow-sm sm:p-7">
      <header className="border-b border-zinc-100 pb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
          {chain.subtitle}
        </p>
        <h2
          className={`${display.className} mt-2 text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl`}
        >
          {chain.title}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-text-secondary sm:text-base">
          {chain.thesis}
        </p>
      </header>

      {/* Score hero */}
      <div
        className={`mt-6 rounded-2xl border px-5 py-6 text-center ${scoreBg(chain.scoreBand)}`}
      >
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">
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
          <p className="mt-3 text-sm font-medium text-text-secondary">
            Floor paid at {(ZERO_SCORE_FLOOR_REWARD_PCT * 100).toFixed(1)}% — the
            record survives even when the scored pool is ₹0.
          </p>
        )}
      </div>

      {/* Chain flow — claims only (fraud score uses claim↔claim, never receipt) */}
      <div className="mt-8">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
          The chain (claims only)
        </p>
        <p className="mt-1 text-xs text-text-muted">
          Claim = where/when someone opened the coupon. Intermediate hops are
          display-only. Only originator claim ↔ buyer claim scores genuineness.
        </p>
        <ol className="mt-4 space-y-0">
          {chain.nodes.map((node, i) => (
            <li key={`${node.role}-${node.publicUserId}-${i}`}>
              <div
                className={`rounded-2xl border px-4 py-3 ${
                  node.isBuyerClaim
                    ? "border-emerald-300 bg-primary-soft/70"
                    : "border-border bg-surface-muted/80"
                }`}
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                  {node.role}
                </p>
                {node.isBuyerClaim ? (
                  <p className="mt-1 text-xs font-medium text-primary">
                    BUYER CLAIMED — where &amp; when they opened the coupon (this
                    feeds the fraud score with the originator claim)
                  </p>
                ) : null}
                <p className="mt-1 font-mono text-sm font-medium text-text-primary">
                  {node.publicUserId}
                </p>
                <p className="mt-2 text-sm font-medium text-text-primary">
                  {node.isBuyerClaim ? `BUYER CLAIMED — ${node.place}` : node.place}
                </p>
                {node.coords && (
                  <p className="mt-0.5 font-mono text-xs text-text-muted">
                    {node.coords}
                  </p>
                )}
                <p className="mt-1 text-xs text-text-muted">
                  {node.isBuyerClaim ? "Claimed " : "Claimed "}
                  {new Date(node.at).toLocaleString()}
                </p>
              </div>
              {i < chain.claimHops.length ? (
                <HopBox hop={chain.claimHops[i]} title={`Hop ${i + 1} (display only)`} />
              ) : null}
            </li>
          ))}
        </ol>

        <HopBox
          hop={chain.scoringHop}
          title="This is what scores genuineness"
          subtitle="ORIGINATOR CLAIM ↔ BUYER CLAIM — never the receipt purchase"
        />
      </div>

      {/* Purchase from receipt — does NOT affect fraud/proximity score */}
      <div className="mt-8 border-t border-zinc-100 pt-6">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
          Purchase (from receipt)
        </p>
        <p className="mt-1 text-xs font-medium text-text-secondary">
          Confirms the purchase; does not affect the fraud score.
        </p>
        <p className="mt-1 text-xs text-text-muted">
          Uses receipt time + purchase GPS for store-match and validity only.
        </p>

        {chain.claimToPurchaseHop ? (
          <HopBox
            hop={chain.claimToPurchaseHop}
            title="Receipt vs originator share"
            subtitle="Distance: claim place → store · Time: originator share → receipt (not used for proximity)"
          />
        ) : null}

        <div className="mt-3 flex gap-4 rounded-2xl border border-border bg-surface-muted/80 p-4">
          {chain.receiptImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={chain.receiptImageUrl}
              alt="Receipt"
              className="h-28 w-20 shrink-0 rounded-lg border border-border object-cover"
            />
          ) : (
            <div className="flex h-28 w-20 shrink-0 items-center justify-center rounded-lg border border-dashed border-border-strong bg-surface text-center text-[10px] text-text-muted">
              Receipt
            </div>
          )}
          <div className="min-w-0 text-sm text-text-secondary">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
              PURCHASE (from receipt)
            </p>
            <p className="mt-1 font-semibold text-text-primary">{chain.productName}</p>
            <p className="mt-1 font-mono text-xs">{chain.barcode}</p>
            <p className="mt-3 text-sm font-medium text-text-primary">
              {chain.storeName}
              {chain.storeAddress ? ` — ${chain.storeAddress}` : ""}
            </p>
            <p className="mt-2 text-sm font-medium text-text-primary">
              Store distance:{" "}
              {chain.purchaseVsStoreMeters != null
                ? `${chain.purchaseVsStoreMeters.toFixed(0)} m`
                : "—"}
              {chain.purchaseVsStoreMeters != null &&
              chain.purchaseVsStoreMeters < 50
                ? " (at originator store)"
                : ""}
            </p>
            {chain.purchaseCoords ? (
              <p className="mt-1 font-mono text-xs text-text-muted">
                Purchase GPS {chain.purchaseCoords}
              </p>
            ) : null}
            <p className="mt-1 text-xs text-text-muted">
              Receipt time {new Date(chain.purchaseAt).toLocaleString()}
              {chain.minutesOriginToPurchase != null
                ? ` · ${formatDurationMinutes(chain.minutesOriginToPurchase)} from originator share`
                : ""}
            </p>
            <p className="mt-2 text-lg font-semibold text-text-primary">
              ₹{chain.amount.toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      {/* Why */}
      <div className="mt-8 border-t border-zinc-100 pt-6">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
          Why this score
        </p>
        <ul className="mt-3 space-y-2">
          {chain.checks.map((c) => (
            <li
              key={c.label}
              className="flex gap-3 rounded-xl border border-zinc-100 bg-surface-muted px-3 py-2.5 text-sm"
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
                <span className="font-medium text-text-primary">{c.label}</span>
                <span className="mt-0.5 block text-text-secondary">{c.detail}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Rewards */}
      <div className="mt-8 border-t border-zinc-100 pt-6">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
          Reward pool
        </p>
        <p className={`${display.className} mt-2 text-3xl font-semibold text-text-primary`}>
          ₹{formatRewardAmount(chain.basePool)}
        </p>
        {chain.usedZeroScoreFloor ? (
          <p className="mt-1 text-sm text-text-secondary">
            Floor pool (scored pool was ₹{formatRewardAmount(chain.scoredPool)})
          </p>
        ) : (
          <p className="mt-1 text-sm text-text-secondary">
            Split across the chain by role
          </p>
        )}
        <ul className="mt-4 space-y-2">
          {chain.rewards.length === 0 ? (
            <li className="text-sm text-text-muted">No rewards written.</li>
          ) : (
            chain.rewards.map((r) => (
              <li
                key={`${r.role}-${r.publicUserId}`}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span className="text-text-secondary">
                  {roleLabel(r.role)}{" "}
                  <span className="font-mono text-xs text-text-muted">
                    {r.publicUserId}
                  </span>
                </span>
                <span className="font-semibold tabular-nums text-text-primary">
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
      className={`${sans.variable} ${display.variable} ${sans.className} min-h-full bg-surface-muted text-text-primary`}
    >
      <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-8 sm:py-14 lg:px-10 lg:py-16">
        {/* Thesis */}
        <header className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
            EFDAA live demo
          </p>
          <h1
            className={`${display.className} mt-4 text-4xl font-semibold leading-[1.1] tracking-tight text-zinc-950 sm:text-5xl lg:text-6xl`}
          >
            Offline word-of-mouth, made measurable.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-text-secondary sm:text-lg">
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
              className="rounded-2xl border border-border bg-surface px-5 py-5 shadow-sm"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
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

        <p className="mt-8 max-w-3xl text-base font-medium text-text-primary sm:text-lg">
          Look across the three columns: full pay when hops are genuine · cut
          when proximity looks collusive · zero score when expired — yet the
          attribution record and floor reward still exist.
        </p>

        {!data.loaded ? (
          <div className="mt-12 rounded-3xl border border-warning/25 bg-warning-soft px-6 py-10 text-center">
            <p className={`${display.className} text-2xl font-semibold text-text-primary`}>
              Demo chains not loaded yet
            </p>
            <p className="mx-auto mt-3 max-w-lg text-sm text-text-secondary">
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

        <footer className="mt-16 border-t border-border-strong/80 pt-10 pb-6">
          <p
            className={`${display.className} max-w-3xl text-2xl font-semibold leading-snug text-zinc-950 sm:text-3xl`}
          >
            Every rupee of reward traces to one validated transaction — and every
            purchase traces back to the person who caused it.
          </p>
          <p className="mt-4 text-sm text-text-muted">
            Read-only demo · seeded data only · no customer PII
          </p>
        </footer>
      </div>
    </div>
  );
}
