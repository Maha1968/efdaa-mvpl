import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/lib/auth/admin";
import { toPublicUserId } from "@/lib/privacy/user-id";
import { collectDescendants, emptyDepthStats } from "@/lib/dashboard/analytics";
import { formatRewardAmount } from "@/lib/purchases/rewards";
import { notFound, redirect } from "next/navigation";
import type { Token } from "@/types/database";

export default async function AdminPurchaseViewPage() {
  if (!(await isAdminUser())) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin/purchase-view");

  const [{ data: purchases }, { data: tokens }, { data: rewards }] =
    await Promise.all([
      supabase
        .from("purchases")
        .select("*")
        .eq("status", "validated")
        .order("created_at", { ascending: false })
        .limit(40),
      supabase.from("tokens").select("*"),
      supabase.from("rewards").select("*"),
    ]);

  const allTokens = (tokens as Token[]) ?? [];

  const rows = await Promise.all(
    (purchases ?? []).map(async (purchase) => {
      const token = allTokens.find((t) => t.id === purchase.token_id);
      const root =
        allTokens.find((t) => t.id === (token?.root_token_id ?? token?.id)) ??
        token;

      const { data: product } = token
        ? await supabase
            .from("products")
            .select("name")
            .eq("id", token.product_id)
            .single()
        : { data: null };

      const tree = root ? collectDescendants(root.id, allTokens) : [];
      const tokenIds = new Set(tree.map((t) => t.id));

      // Absolute depth in this referral tree (originator = 0).
      // Demo purchases are usually on depth-4 leaves — relative "downstream
      // only" would always be empty for those.
      const byDepth = emptyDepthStats();
      for (const p of purchases ?? []) {
        if (!tokenIds.has(p.token_id)) continue;
        const pt = tree.find((t) => t.id === p.token_id);
        if (!pt) continue;
        const bucket = Math.min(Math.max(pt.depth === 0 ? 1 : pt.depth, 1), 5);
        const row = byDepth.find((d) => d.depth === bucket)!;
        row.purchases += 1;
        row.purchaseValue = (row.purchaseValue ?? 0) + Number(p.amount);
      }

      const thisRewards = (rewards ?? []).filter(
        (r) => r.purchase_id === purchase.id,
      );
      const holderDepth = new Map<string, number>();
      for (const t of tree) {
        const prev = holderDepth.get(t.holder_user_id);
        if (prev === undefined || t.depth < prev) {
          holderDepth.set(t.holder_user_id, t.depth);
        }
      }
      // Buyer may not hold a token in-tree (self-redeem vs last referrer).
      if (!holderDepth.has(purchase.buyer_user_id) && token) {
        holderDepth.set(purchase.buyer_user_id, token.depth);
      }

      const rewardsByDepth = emptyDepthStats();
      for (const r of thisRewards) {
        const d = holderDepth.get(r.user_id) ?? token?.depth ?? 0;
        const bucket = Math.min(Math.max(d === 0 ? 1 : d, 1), 5);
        const row = rewardsByDepth.find((x) => x.depth === bucket)!;
        const amount = Number(r.amount);
        row.rewardValue += amount;
        row.rewardPoints += amount;
        row.purchases = 0;
      }

      return {
        purchase,
        productName: product?.name ?? "Product",
        originatorId: root?.holder_user_id,
        originCode: root?.code,
        purchaseCode: token?.code ?? "—",
        purchaseDepth: token?.depth ?? null,
        byDepth,
        rewardsByDepth,
        rewardTotal: thisRewards.reduce((s, r) => s + Number(r.amount), 0),
      };
    }),
  );

  return (
    <main className="flex flex-1 flex-col px-6 py-10">
      <div className="mx-auto w-full max-w-3xl">
        <Link href="/admin" className="text-sm text-primary underline">
          ← Admin overview
        </Link>

        <div className="mb-6 mt-4">
          <h1 className="text-2xl font-semibold text-text-primary">
            Customer purchase view
          </h1>
          <p className="mt-2 text-sm text-text-secondary">
            Buyer User IDs and depth impact in the referral tree — no PII.
          </p>
        </div>

        {rows.length === 0 ? (
          <p className="rounded-2xl border border-border bg-surface p-6 text-sm text-text-secondary">
            No validated purchases yet.
          </p>
        ) : (
          <ul className="space-y-4">
            {rows.map(
              ({
                purchase,
                productName,
                originatorId,
                originCode,
                purchaseCode,
                purchaseDepth,
                byDepth,
                rewardsByDepth,
                rewardTotal,
              }) => (
                <li
                  key={purchase.id}
                  className="rounded-2xl border border-border bg-surface p-5 shadow-sm"
                >
                  <p className="font-mono text-sm font-semibold text-text-primary">
                    Buyer {toPublicUserId(purchase.buyer_user_id)}
                  </p>
                  <p className="mt-1 text-sm text-text-secondary">
                    {productName} · ₹{Number(purchase.amount).toFixed(2)}
                  </p>
                  <p className="mt-1 text-xs text-text-muted">
                    {new Date(purchase.created_at).toLocaleString()} · token{" "}
                    <span className="font-mono">
                      {purchaseCode}
                      <span
                        className="ml-1 font-sans font-semibold text-amber-700"
                        title="Purchase on this token"
                      >
                        (P)
                      </span>
                    </span>
                    {purchaseDepth != null ? ` · depth ${purchaseDepth}` : ""} ·
                    originating{" "}
                    <span className="font-mono">{originCode}</span> ·
                    originator{" "}
                    <span className="font-mono">
                      {toPublicUserId(originatorId)}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-text-muted">
                    Rewards from this purchase: ₹
                    {formatRewardAmount(rewardTotal)}
                  </p>

                  <div className="mt-4 overflow-x-auto">
                    <p className="text-sm font-medium text-text-secondary">
                      Purchases in this referral tree by depth
                    </p>
                    <p className="mt-0.5 text-xs text-text-muted">
                      Absolute depth from originator (not only deeper than this
                      buyer).
                    </p>
                    <table className="mt-2 w-full text-left text-xs">
                      <thead>
                        <tr className="text-text-muted">
                          <th className="py-1">Depth</th>
                          <th>Purchases</th>
                          <th>Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {byDepth.map((d) => (
                          <tr
                            key={d.depth}
                            className="border-t border-border"
                          >
                            <td className="py-1">{d.depth}</td>
                            <td>{d.purchases}</td>
                            <td>₹{(d.purchaseValue ?? 0).toFixed(0)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-4 overflow-x-auto">
                    <p className="text-sm font-medium text-text-secondary">
                      Rewards from this purchase by recipient depth
                    </p>
                    <table className="mt-2 w-full text-left text-xs">
                      <thead>
                        <tr className="text-text-muted">
                          <th className="py-1">Depth</th>
                          <th>Points</th>
                          <th>Rewards</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rewardsByDepth.map((d) => (
                          <tr
                            key={d.depth}
                            className="border-t border-border"
                          >
                            <td className="py-1">{d.depth}</td>
                            <td>{formatRewardAmount(d.rewardPoints)}</td>
                            <td>₹{formatRewardAmount(d.rewardValue)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </li>
              ),
            )}
          </ul>
        )}
      </div>
    </main>
  );
}
