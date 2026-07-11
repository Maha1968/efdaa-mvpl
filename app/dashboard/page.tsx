import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DashboardNav, CUSTOMER_NAV } from "@/components/dashboard-nav";
import { buildCustomerProductStats } from "@/lib/dashboard/analytics";
import { isAdminUser } from "@/lib/auth/admin";
import { redirect } from "next/navigation";
import type { Purchase, Reward, Token } from "@/types/database";

export default async function CustomerDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard");

  if (await isAdminUser()) redirect("/admin");

  const [{ data: allTokens }, { data: products }, { data: purchases }, { data: myRewards }] =
    await Promise.all([
      supabase.from("tokens").select("*"),
      supabase.from("products").select("id, name"),
      supabase.from("purchases").select("*").eq("status", "validated"),
      supabase.from("rewards").select("*").eq("user_id", user.id),
    ]);

  const rootTokens = ((allTokens as Token[]) ?? []).filter(
    (t) => t.depth === 0 && t.holder_user_id === user.id,
  );

  const rows = buildCustomerProductStats({
    rootTokens,
    allTokens: (allTokens as Token[]) ?? [],
    products: products ?? [],
    purchases: (purchases as Purchase[]) ?? [],
    rewards: (myRewards as Reward[]) ?? [],
  });

  return (
    <main className="flex flex-1 flex-col px-6 py-10">
      <div className="mx-auto w-full max-w-2xl">
        <Link href="/" className="text-sm text-emerald-700 underline">
          ← Home
        </Link>

        <div className="mb-6 mt-4">
          <p className="text-sm font-medium uppercase tracking-widest text-emerald-700">
            Customer dashboard
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-zinc-900">
            My recommendations
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            See the commercial impact of products you recommended — aggregates
            only. Other people&apos;s identities and tokens are never shown.
          </p>
        </div>

        <DashboardNav current="/dashboard" links={CUSTOMER_NAV} />

        {rows.length === 0 ? (
          <p className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600">
            You haven&apos;t recommended a product yet.{" "}
            <Link href="/create" className="text-emerald-700 underline">
              Create a token
            </Link>
          </p>
        ) : (
          <div className="space-y-6">
            {rows.map((row) => (
              <article
                key={row.rootTokenId}
                className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-semibold text-zinc-900">
                      {row.productName}
                    </h2>
                    <p className="mt-1 text-sm text-zinc-600">
                      Recommended{" "}
                      {new Date(row.recommendedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      row.status === "Active"
                        ? "bg-emerald-100 text-emerald-800"
                        : row.status === "Completed"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-zinc-100 text-zinc-600"
                    }`}
                  >
                    {row.status}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
                  <div className="rounded-xl bg-zinc-50 px-2 py-3">
                    <p className="text-zinc-500">Purchases</p>
                    <p className="mt-1 text-lg font-semibold text-zinc-900">
                      {row.totalPurchases}
                    </p>
                  </div>
                  <div className="rounded-xl bg-zinc-50 px-2 py-3">
                    <p className="text-zinc-500">Points</p>
                    <p className="mt-1 text-lg font-semibold text-zinc-900">
                      {row.totalRewardPoints}
                    </p>
                  </div>
                  <div className="rounded-xl bg-emerald-50 px-2 py-3">
                    <p className="text-emerald-700">Reward value</p>
                    <p className="mt-1 text-lg font-semibold text-emerald-800">
                      ₹{row.totalRewardValue.toFixed(2)}
                    </p>
                  </div>
                </div>

                <div className="mt-5">
                  <p className="text-sm font-medium text-zinc-700">
                    Referral performance by depth
                  </p>
                  <div className="mt-2 overflow-x-auto">
                    <table className="w-full min-w-[320px] text-left text-sm">
                      <thead>
                        <tr className="border-b border-zinc-200 text-zinc-500">
                          <th className="py-2 font-medium">Depth</th>
                          <th className="py-2 font-medium">Purchases</th>
                          <th className="py-2 font-medium">Points</th>
                          <th className="py-2 font-medium">Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {row.byDepth.map((d) => (
                          <tr key={d.depth} className="border-b border-zinc-100">
                            <td className="py-2">Depth {d.depth}</td>
                            <td className="py-2">{d.purchases}</td>
                            <td className="py-2">{d.rewardPoints}</td>
                            <td className="py-2">
                              ₹{d.rewardValue.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
