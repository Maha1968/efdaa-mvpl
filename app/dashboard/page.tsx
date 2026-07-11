import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DashboardNav } from "@/components/dashboard-nav";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard");

  const [
    { count: tokenCount },
    { count: validatedCount },
    { data: myRewards },
  ] = await Promise.all([
    supabase.from("tokens").select("id", { count: "exact", head: true }),
    supabase
      .from("purchases")
      .select("id", { count: "exact", head: true })
      .eq("status", "validated"),
    supabase.from("rewards").select("amount").eq("user_id", user.id),
  ]);

  const myTotal = (myRewards ?? []).reduce(
    (sum, r) => sum + Number(r.amount),
    0,
  );

  return (
    <main className="flex flex-1 flex-col px-6 py-10">
      <div className="mx-auto w-full max-w-2xl">
        <Link href="/" className="text-sm text-emerald-700 underline">
          ← Home
        </Link>

        <div className="mb-6 mt-4">
          <p className="text-sm font-medium uppercase tracking-widest text-emerald-700">
            Influence graph
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-zinc-900">Dashboard</h1>
          <p className="mt-2 text-sm text-zinc-600">
            Trace token chains, see validated purchases and rewards, and rank
            influence by points earned.
          </p>
        </div>

        <DashboardNav current="/dashboard" />

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-zinc-500">Tokens</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-900">
              {tokenCount ?? 0}
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-zinc-500">Validated purchases</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-900">
              {validatedCount ?? 0}
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-zinc-500">Your EFDAA points</p>
            <p className="mt-1 text-2xl font-semibold text-emerald-700">
              ₹{myTotal.toFixed(2)}
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          <Link
            href="/dashboard/tokens"
            className="block rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
          >
            View token chains →
          </Link>
          <Link
            href="/dashboard/purchases"
            className="block rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
          >
            View validated purchases & rewards →
          </Link>
          <Link
            href="/dashboard/leaderboard"
            className="block rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
          >
            View leaderboard →
          </Link>
          <Link
            href="/rewards"
            className="block rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900 hover:bg-emerald-100"
          >
            My EFDAA points →
          </Link>
        </div>
      </div>
    </main>
  );
}
