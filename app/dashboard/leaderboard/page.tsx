import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DashboardNav } from "@/components/dashboard-nav";
import { redirect } from "next/navigation";

export default async function LeaderboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard/leaderboard");

  const { data: rewards } = await supabase
    .from("rewards")
    .select("user_id, amount");

  const totals = new Map<string, number>();
  for (const reward of rewards ?? []) {
    const current = totals.get(reward.user_id) ?? 0;
    totals.set(reward.user_id, current + Number(reward.amount));
  }

  const ranked = Array.from(totals.entries())
    .map(([userId, total]) => ({ userId, total }))
    .sort((a, b) => b.total - a.total);

  const rows = await Promise.all(
    ranked.map(async (row, index) => {
      const { data: u } = await supabase
        .from("users")
        .select("name")
        .eq("id", row.userId)
        .single();
      return {
        rank: index + 1,
        name: u?.name || "Unknown",
        total: row.total,
        isYou: row.userId === user.id,
      };
    }),
  );

  return (
    <main className="flex flex-1 flex-col px-6 py-10">
      <div className="mx-auto w-full max-w-2xl">
        <Link href="/" className="text-sm text-emerald-700 underline">
          ← Home
        </Link>

        <div className="mb-6 mt-4">
          <h1 className="text-2xl font-semibold text-zinc-900">Leaderboard</h1>
          <p className="mt-2 text-sm text-zinc-600">
            Users ranked by total EFDAA reward earned — an early influence signal.
          </p>
        </div>

        <DashboardNav current="/dashboard/leaderboard" />

        {rows.length === 0 ? (
          <p className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600">
            No rewards yet. Validate a purchase to start the leaderboard.
          </p>
        ) : (
          <ol className="space-y-2">
            {rows.map((row) => (
              <li
                key={row.rank}
                className={`flex items-center justify-between rounded-2xl border px-4 py-3 ${
                  row.isYou
                    ? "border-emerald-300 bg-emerald-50"
                    : "border-zinc-200 bg-white"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-sm font-semibold text-zinc-700">
                    {row.rank}
                  </span>
                  <div>
                    <p className="font-medium text-zinc-900">
                      {row.name}
                      {row.isYou ? " (you)" : ""}
                    </p>
                  </div>
                </div>
                <p className="font-semibold text-emerald-700">
                  ₹{row.total.toFixed(2)}
                </p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </main>
  );
}
