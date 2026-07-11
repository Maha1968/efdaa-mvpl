import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/lib/auth/admin";
import { DashboardNav, ADMIN_NAV } from "@/components/dashboard-nav";
import { toPublicUserId } from "@/lib/privacy/user-id";
import { collectDescendants, emptyDepthStats } from "@/lib/dashboard/analytics";
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
      const byDepth = emptyDepthStats();

      for (const p of purchases ?? []) {
        if (p.id === purchase.id) continue;
        const pt = tree.find((t) => t.id === p.token_id);
        if (!pt) continue;
        // downstream relative to this purchase's token depth
        const buyerDepth = token?.depth ?? 0;
        if (pt.depth <= buyerDepth) continue;
        const relative = Math.min(pt.depth - buyerDepth, 5);
        const bucket = Math.max(relative, 1);
        const row = byDepth.find((d) => d.depth === bucket)!;
        row.purchases += 1;
        row.purchaseValue = (row.purchaseValue ?? 0) + Number(p.amount);
        const pRewards = (rewards ?? []).filter((r) => r.purchase_id === p.id);
        const rv = pRewards.reduce((s, r) => s + Number(r.amount), 0);
        row.rewardValue += rv;
        row.rewardPoints += Math.round(rv);
      }

      return {
        purchase,
        productName: product?.name ?? "Product",
        originatorId: root?.holder_user_id,
        originCode: root?.code,
        byDepth,
      };
    }),
  );

  return (
    <main className="flex flex-1 flex-col px-6 py-10">
      <div className="mx-auto w-full max-w-3xl">
        <Link href="/admin" className="text-sm text-emerald-700 underline">
          ← Admin overview
        </Link>

        <div className="mb-6 mt-4">
          <h1 className="text-2xl font-semibold text-zinc-900">
            Customer purchase view
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            Buyer User IDs and cascading depth impact — no PII.
          </p>
        </div>

        <DashboardNav current="/admin/purchase-view" links={ADMIN_NAV} />

        {rows.length === 0 ? (
          <p className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600">
            No validated purchases yet.
          </p>
        ) : (
          <ul className="space-y-4">
            {rows.map(({ purchase, productName, originatorId, originCode, byDepth }) => (
              <li
                key={purchase.id}
                className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
              >
                <p className="font-mono text-sm font-semibold text-zinc-900">
                  Buyer {toPublicUserId(purchase.buyer_user_id)}
                </p>
                <p className="mt-1 text-sm text-zinc-700">
                  {productName} · ₹{Number(purchase.amount).toFixed(2)}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  {new Date(purchase.created_at).toLocaleString()} · originating{" "}
                  <span className="font-mono">{originCode}</span> · originator{" "}
                  <span className="font-mono">
                    {toPublicUserId(originatorId)}
                  </span>
                </p>

                <div className="mt-4 overflow-x-auto">
                  <p className="text-sm font-medium text-zinc-700">
                    Downstream purchases by depth
                  </p>
                  <table className="mt-2 w-full text-left text-xs">
                    <thead>
                      <tr className="text-zinc-500">
                        <th className="py-1">Depth</th>
                        <th>Purchases</th>
                        <th>Value</th>
                        <th>Points</th>
                        <th>Rewards</th>
                      </tr>
                    </thead>
                    <tbody>
                      {byDepth.map((d) => (
                        <tr key={d.depth} className="border-t border-zinc-100">
                          <td className="py-1">{d.depth}</td>
                          <td>{d.purchases}</td>
                          <td>₹{(d.purchaseValue ?? 0).toFixed(0)}</td>
                          <td>{d.rewardPoints}</td>
                          <td>₹{d.rewardValue.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
