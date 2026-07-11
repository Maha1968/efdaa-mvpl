import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { buildTokenChain, chainPointsWithPurchase } from "@/lib/purchases/chain";
import { computeHopDetails } from "@/lib/purchases/genuineness";
import { explainGenuineness } from "@/lib/dashboard/format";
import {
  BARCODE_MISS_MULTIPLIER,
  MIN_GENUINE_DISTANCE_METERS,
  MIN_GENUINE_TIME_MINUTES,
  PROXIMITY_PENALTY_MULTIPLIER,
  ROLE_WEIGHTS,
  STORE_MISS_MULTIPLIER,
} from "@/config/rewards";
import { notFound, redirect } from "next/navigation";
import type { Token } from "@/types/database";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function DashboardPurchaseDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/dashboard/purchases/${id}`);

  const { data: purchase } = await supabase
    .from("purchases")
    .select("*")
    .eq("id", id)
    .single();

  if (!purchase || purchase.status !== "validated") notFound();

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
  const hops = computeHopDetails(
    chainPointsWithPurchase(chain, purchase),
    chain.length,
  );
  const reasons = explainGenuineness(purchase);

  const rewardsWithNames = await Promise.all(
    (rewards ?? []).map(async (reward) => {
      const { data: u } = await supabase
        .from("users")
        .select("name")
        .eq("id", reward.user_id)
        .single();
      return { ...reward, name: u?.name || "Unknown" };
    }),
  );

  const amount = Number(purchase.amount);
  const basePct = Number(offer?.base_reward_pct ?? 0);
  const score = Number(purchase.genuineness_score ?? 0);
  const basePool = Number((amount * basePct * score).toFixed(2));

  return (
    <main className="flex flex-1 flex-col px-6 py-10">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <Link
          href="/dashboard/purchases"
          className="text-sm text-emerald-700 underline"
        >
          ← Validated purchases
        </Link>

        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">
            Purchase detail
          </h1>
          <p className="mt-1 text-sm text-zinc-600">
            {product?.name ?? "Product"} · {store?.name ?? "Store"} · ₹{amount}
          </p>
        </div>

        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">Genuineness score</h2>
          <p className="mt-2 text-3xl font-semibold text-emerald-700">
            {score.toFixed(3)}
          </p>
          <ul className="mt-3 list-inside list-disc text-sm text-zinc-600">
            {reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
          <div className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
            <div className="rounded-xl bg-zinc-50 px-3 py-2">
              <p className="text-zinc-500">Within window</p>
              <p className="font-medium">{purchase.within_window ? "Yes" : "No"}</p>
            </div>
            <div className="rounded-xl bg-zinc-50 px-3 py-2">
              <p className="text-zinc-500">Barcode</p>
              <p className="font-medium">
                {purchase.barcode_match ? "Match" : `Miss ×${BARCODE_MISS_MULTIPLIER}`}
              </p>
            </div>
            <div className="rounded-xl bg-zinc-50 px-3 py-2">
              <p className="text-zinc-500">Store</p>
              <p className="font-medium">
                {purchase.store_match ? "Match" : `Miss ×${STORE_MISS_MULTIPLIER}`}
              </p>
            </div>
          </div>
          <p className="mt-3 text-xs text-zinc-500">
            Near &lt;{MIN_GENUINE_DISTANCE_METERS}m and fast &lt;
            {MIN_GENUINE_TIME_MINUTES} min → ×{PROXIMITY_PENALTY_MULTIPLIER}
          </p>
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">Hop distances & times</h2>
          <ul className="mt-4 space-y-3">
            {hops.map((hop) => (
              <li
                key={hop.index}
                className={`rounded-xl border px-4 py-3 text-sm ${
                  hop.suspicious
                    ? "border-amber-300 bg-amber-50"
                    : "border-zinc-200 bg-zinc-50"
                }`}
              >
                <p className="font-medium text-zinc-900">
                  Hop {hop.index}: {hop.fromLabel} → {hop.toLabel}
                </p>
                <p className="mt-1 text-zinc-600">
                  {hop.distance_m != null ? `${hop.distance_m} m` : "—"} ·{" "}
                  {hop.time_minutes != null ? `${hop.time_minutes} min` : "—"}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">Rewards paid</h2>
          <p className="mt-2 text-sm text-zinc-600">
            Pool ₹{basePool.toFixed(2)} (weights buyer {ROLE_WEIGHTS.buyer} /
            last_referrer {ROLE_WEIGHTS.last_referrer} / originator{" "}
            {ROLE_WEIGHTS.originator} / forwarder {ROLE_WEIGHTS.forwarder})
          </p>
          <ul className="mt-4 space-y-2">
            {rewardsWithNames.map((reward) => (
              <li
                key={reward.id}
                className="flex justify-between rounded-xl border border-zinc-200 px-4 py-3 text-sm"
              >
                <span>
                  {reward.name}{" "}
                  <span className="text-zinc-400">({reward.role})</span>
                </span>
                <span className="font-semibold text-emerald-700">
                  ₹{Number(reward.amount).toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
