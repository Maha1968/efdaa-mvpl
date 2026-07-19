import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/lib/auth/admin";
import { buildTokenChain, chainPointsWithPurchase } from "@/lib/purchases/chain";
import { computeHopDetails, computeOriginatorToBuyerClaimGap } from "@/lib/purchases/genuineness";
import {
  BARCODE_MISS_MULTIPLIER,
  MIN_GENUINE_DISTANCE_METERS,
  MIN_GENUINE_TIME_MINUTES,
  PROXIMITY_PENALTY_MULTIPLIER,
  ROLE_WEIGHTS,
  STORE_MISS_MULTIPLIER,
  ZERO_SCORE_FLOOR_REWARD_PCT,
} from "@/config/rewards";
import {
  computeBasePool,
  formatRewardAmount,
} from "@/lib/purchases/rewards";
import { toPublicUserId } from "@/lib/privacy/user-id";
import { notFound } from "next/navigation";
import type { Token } from "@/types/database";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function PurchaseResultPage({ params }: PageProps) {
  if (!(await isAdminUser())) notFound();

  const { id } = await params;
  const supabase = await createClient();

  const { data: purchase } = await supabase
    .from("purchases")
    .select("*")
    .eq("id", id)
    .single();

  if (!purchase) notFound();

  const { data: token } = await supabase
    .from("tokens")
    .select("*")
    .eq("id", purchase.token_id)
    .single();

  if (!token) notFound();

  const [{ data: product }, { data: offer }, { data: store }, { data: rewards }] =
    await Promise.all([
      supabase.from("products").select("name, barcode").eq("id", token.product_id).single(),
      supabase.from("offers").select("name, base_reward_pct").eq("id", token.offer_id).single(),
      purchase.store_id
        ? supabase.from("stores").select("name").eq("id", purchase.store_id).single()
        : Promise.resolve({ data: null }),
      supabase
        .from("rewards")
        .select("*")
        .eq("purchase_id", purchase.id)
        .order("amount", { ascending: false }),
    ]);

  const fetchParent = async (parentId: string) => {
    const { data } = await supabase
      .from("tokens")
      .select("*")
      .eq("id", parentId)
      .single();
    return data as Token | null;
  };

  const chain = await buildTokenChain(token as Token, fetchParent);
  const scoring = computeOriginatorToBuyerClaimGap(chain);
  const hops = computeHopDetails(
    chainPointsWithPurchase(chain, purchase),
    chain.length,
    scoring,
  );

  const rewardsWithIds = await Promise.all(
    (rewards ?? []).map(async (reward) => ({
      ...reward,
      publicId: toPublicUserId(reward.user_id),
    })),
  );

  const amount = Number(purchase.amount);
  const basePct = Number(offer?.base_reward_pct ?? 0);
  const score = Number(purchase.genuineness_score ?? 0);
  const pool = computeBasePool({
    amount,
    baseRewardPct: basePct,
    genuinenessScore: score,
  });
  const basePool = pool.basePool;

  return (
    <main className="flex flex-1 flex-col px-6 py-10">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <Link href="/admin/purchases" className="text-sm text-primary underline">
          ← Back to pending purchases
        </Link>

        <div>
          <p className="text-sm font-medium uppercase tracking-widest text-primary">
            Validation result
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-text-primary">
            {purchase.status === "validated" ? "Purchase validated" : "Purchase details"}
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            {product?.name ?? "Product"} · {store?.name ?? "Store"} · ₹{amount}
          </p>
          {purchase.receipt_purchased_at ? (
            <p className="mt-1 text-sm text-text-muted">
              Receipt time:{" "}
              {new Date(purchase.receipt_purchased_at).toLocaleString()}
            </p>
          ) : null}
        </div>

        <section className="rounded-2xl border border-border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-text-primary">Genuineness score</h2>
          <p className="mt-2 text-3xl font-semibold text-primary">
            {score.toFixed(3)}
          </p>

          <div className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
            <div className="rounded-xl bg-surface-muted px-3 py-2">
              <p className="text-text-muted">Within window</p>
              <p className="font-medium text-text-primary">
                {purchase.within_window ? "Yes" : "No"}
              </p>
            </div>
            <div className="rounded-xl bg-surface-muted px-3 py-2">
              <p className="text-text-muted">Barcode match</p>
              <p className="font-medium text-text-primary">
                {purchase.barcode_match === "match"
                  ? "Yes (match)"
                  : purchase.barcode_match === "not_provided"
                    ? "Not provided (no penalty)"
                    : purchase.barcode_match === "mismatch"
                      ? `Mismatch (×${BARCODE_MISS_MULTIPLIER})`
                      : "—"}
              </p>
            </div>
            <div className="rounded-xl bg-surface-muted px-3 py-2">
              <p className="text-text-muted">Store match</p>
              <p className="font-medium text-text-primary">
                {purchase.store_match ? "Yes" : `No (×${STORE_MISS_MULTIPLIER})`}
              </p>
            </div>
          </div>

          <p className="mt-3 text-xs text-text-muted">
            Scoring hop: originator claim ↔ buyer token claim. Penalty if both
            near &lt;{MIN_GENUINE_DISTANCE_METERS}m and fast &lt;
            {MIN_GENUINE_TIME_MINUTES} min → ×{PROXIMITY_PENALTY_MULTIPLIER}.
            Intermediate shares do not change the score.
          </p>
        </section>

        <section className="rounded-2xl border border-border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-text-primary">Hop distances & times</h2>
          <p className="mt-1 text-sm text-text-secondary">
            Consecutive claims (and purchase) for context. The row marked
            &quot;scores&quot; is originator ↔ buyer claim — the only proximity
            input to genuineness.
          </p>

          {hops.length === 0 ? (
            <p className="mt-4 text-sm text-text-muted">No hops recorded.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {hops.map((hop) => (
                <li
                  key={`${hop.index}-${hop.toLabel}`}
                  className={`rounded-xl border px-4 py-3 text-sm ${
                    hop.scoresProximity
                      ? hop.suspicious
                        ? "border-amber-300 bg-warning-soft"
                        : "border-primary/30 bg-primary-soft"
                      : "border-border bg-surface-muted"
                  }`}
                >
                  <p className="font-medium text-text-primary">
                    {hop.scoresProximity ? "Scoring hop" : `Hop ${hop.index}`}:{" "}
                    {hop.fromLabel} → {hop.toLabel}
                  </p>
                  <p className="mt-1 text-text-secondary">
                    Distance:{" "}
                    {hop.distance_m != null ? `${hop.distance_m} m` : "—"} · Time:{" "}
                    {hop.time_minutes != null ? `${hop.time_minutes} min` : "—"}
                  </p>
                  {hop.suspicious && (
                    <p className="mt-1 text-warning">
                      Suspicious: both too near and too fast
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}

          <p className="mt-4 text-sm text-text-secondary">
            Originator ↔ buyer claim: {purchase.min_hop_distance_m ?? "—"} m ·{" "}
            {purchase.min_hop_time_minutes ?? "—"} min
          </p>
        </section>

        <section className="rounded-2xl border border-border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-text-primary">Reward pool & payouts</h2>
          <p className="mt-2 text-sm text-text-secondary">
            scored = ₹{amount} × {(basePct * 100).toFixed(2)}% × {score.toFixed(3)} ={" "}
            ₹{formatRewardAmount(pool.scoredPool)}
          </p>
          {pool.usedZeroScoreFloor ? (
            <p className="mt-1 text-sm text-warning">
              Zero-score floor applied: ₹{amount} ×{" "}
              {(ZERO_SCORE_FLOOR_REWARD_PCT * 100).toFixed(2)}% ={" "}
              <strong>₹{formatRewardAmount(basePool)}</strong>
            </p>
          ) : (
            <p className="mt-1 text-sm text-text-secondary">
              base_pool = <strong>₹{formatRewardAmount(basePool)}</strong>
            </p>
          )}
          <p className="mt-1 text-xs text-text-muted">
            Weights: buyer {ROLE_WEIGHTS.buyer}, last_referrer {ROLE_WEIGHTS.last_referrer},
            originator {ROLE_WEIGHTS.originator}, forwarder {ROLE_WEIGHTS.forwarder}
          </p>

          {rewardsWithIds.length === 0 ? (
            <p className="mt-4 text-sm text-text-muted">
              No rewards written (no eligible customer recipients, or pool is zero).
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {rewardsWithIds.map((reward) => (
                <li
                  key={reward.id}
                  className="flex items-center justify-between rounded-xl border border-border px-4 py-3 text-sm"
                >
                  <div>
                    <p className="font-mono font-medium text-text-primary">
                      {reward.publicId}
                    </p>
                    <p className="text-text-muted">{reward.role}</p>
                  </div>
                  <p className="font-semibold text-primary">
                    ₹{formatRewardAmount(Number(reward.amount))}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
