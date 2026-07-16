import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/lib/auth/admin";
import { DashboardNav, ADMIN_NAV } from "@/components/dashboard-nav";
import { DemoDataPanel } from "@/components/demo-data-panel";
import { toPublicUserId } from "@/lib/privacy/user-id";
import { formatRewardAmount } from "@/lib/purchases/rewards";
import { notFound, redirect } from "next/navigation";
import type { Token } from "@/types/database";

/** Demo Load creates many Auth users — allow long-running seed on Vercel. */
export const maxDuration = 300;

export default async function AdminOverviewPage() {
  if (!(await isAdminUser())) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin");

  const [
    { data: tokens },
    { data: purchases },
    { data: rewards },
    { count: openEvents },
  ] = await Promise.all([
    supabase.from("tokens").select("*"),
    supabase.from("purchases").select("*").eq("status", "validated"),
    supabase.from("rewards").select("amount, user_id"),
    supabase
      .from("referral_events")
      .select("id", { count: "exact", head: true })
      .eq("event_type", "opened"),
  ]);

  const allTokens = (tokens as Token[]) ?? [];
  const originators = allTokens.filter((t) => t.depth === 0);
  const forwards = allTokens.filter((t) => t.depth > 0);
  const purchaseValue = (purchases ?? []).reduce(
    (s, p) => s + Number(p.amount),
    0,
  );
  const rewardValue = (rewards ?? []).reduce(
    (s, r) => s + Number(r.amount),
    0,
  );

  const originatorTotals = new Map<string, number>();
  for (const r of rewards ?? []) {
    originatorTotals.set(
      r.user_id,
      (originatorTotals.get(r.user_id) ?? 0) + Number(r.amount),
    );
  }
  const topOriginators = Array.from(originatorTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const productCounts = new Map<string, number>();
  for (const t of originators) {
    const pid = t.product_id ?? "__none__";
    productCounts.set(pid, (productCounts.get(pid) ?? 0) + 1);
  }
  const topProductIds = Array.from(productCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const products = await Promise.all(
    topProductIds.map(async ([id, count]) => {
      if (id === "__none__") {
        return { name: "Photo recommendation", count };
      }
      const { data } = await supabase
        .from("products")
        .select("name")
        .eq("id", id)
        .single();
      return { name: data?.name ?? id.slice(0, 8), count };
    }),
  );

  const depthConversion = [1, 2, 3, 4, 5].map((depth) => {
    const atDepth = allTokens.filter((t) => t.depth === depth).length;
    const purchased = (purchases ?? []).filter((p) => {
      const t = allTokens.find((x) => x.id === p.token_id);
      return t && (t.depth === depth || (depth === 1 && t.depth === 0));
    }).length;
    return { depth, tokens: atDepth, purchases: purchased };
  });

  return (
    <main className="flex flex-1 flex-col px-6 py-10">
      <div className="mx-auto w-full max-w-3xl">
        <Link href="/" className="text-sm text-emerald-700 underline">
          ← Home
        </Link>

        <div className="mb-6 mt-4">
          <p className="text-sm font-medium uppercase tracking-widest text-emerald-700">
            Administrator
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-zinc-900">
            Operations overview
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            Full referral visibility using platform User IDs only — no customer
            names, phones, or emails.
          </p>
        </div>

        <DashboardNav current="/admin" links={ADMIN_NAV} />

        <DemoDataPanel />

        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Recommendations", originators.length],
            ["Opens (logged)", openEvents ?? 0],
            ["Forwards", forwards.length],
            ["Purchases", purchases?.length ?? 0],
            ["Purchase value", `₹${purchaseValue.toFixed(2)}`],
            ["Rewards issued", `₹${formatRewardAmount(rewardValue)}`],
            ["Tokens total", allTokens.length],
            ["Active origins", originators.filter((t) => new Date(t.expires_at) > new Date()).length],
          ].map(([label, value]) => (
            <div
              key={String(label)}
              className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm"
            >
              <p className="text-xs text-zinc-500">{label}</p>
              <p className="mt-1 text-xl font-semibold text-zinc-900">{value}</p>
            </div>
          ))}
        </div>

        <p className="mt-3 text-xs text-zinc-500">
          Opens = rows in referral_events with type opened. Forwards = tokens at
          depth 1+. If Opens stays at 0, the referral_events table is usually
          missing — run supabase/schema_stage7a.sql (then schema_demo.sql, then
          schema_stage7h.sql) in Supabase SQL Editor, then Reset + Load.
        </p>

        <section className="mt-8 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-zinc-900">Conversion by depth</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {depthConversion.map((d) => (
              <li key={d.depth} className="flex justify-between text-zinc-700">
                <span>Depth {d.depth}</span>
                <span>
                  {d.purchases} purchases / {d.tokens} tokens
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-zinc-900">
            Top originators (by reward earned)
          </h2>
          <ul className="mt-3 space-y-2 text-sm">
            {topOriginators.length === 0 ? (
              <li className="text-zinc-500">No rewards yet.</li>
            ) : (
              topOriginators.map(([uid, total]) => (
                <li key={uid} className="flex justify-between">
                  <span className="font-mono text-zinc-800">
                    {toPublicUserId(uid)}
                  </span>
                  <span className="text-emerald-700">₹{total.toFixed(2)}</span>
                </li>
              ))
            )}
          </ul>
        </section>

        <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-zinc-900">Top products (by recommendations)</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {products.map((p) => (
              <li key={p.name} className="flex justify-between text-zinc-700">
                <span>{p.name}</span>
                <span>{p.count}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
