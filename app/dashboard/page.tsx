import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CustomerShell } from "@/components/layout/customer-shell";
import { PageHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { ButtonLink } from "@/components/ui/button-link";
import { Badge } from "@/components/ui/badge";
import { buildCustomerProductStats } from "@/lib/dashboard/analytics";
import { formatRewardAmount } from "@/lib/purchases/rewards";
import { isAdminUser } from "@/lib/auth/admin";
import { redirect } from "next/navigation";
import { Share2 } from "lucide-react";
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
    <CustomerShell wide>
      <PageHeader
        eyebrow="Your activity"
        title="My recommendations"
        description="See the impact of finds you shared — aggregates only. Other people's identities are never shown."
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={Share2}
          title="No recommendations yet"
          description="Share a find you love — when friends buy, your activity appears here."
          action={
            <ButtonLink href="/create" fullWidth>
              Share a find
            </ButtonLink>
          }
        />
      ) : (
        <div className="space-y-5">
          {rows.map((row) => (
            <article
              key={row.rootTokenId}
              className="rounded-xl border border-border bg-surface p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-card-title text-text-primary">
                    {row.productName}
                  </h2>
                  <p className="mt-1 text-sm text-text-secondary">
                    Shared {new Date(row.recommendedAt).toLocaleDateString()}
                  </p>
                </div>
                <Badge
                  tone={
                    row.status === "Active"
                      ? "success"
                      : row.status === "Completed"
                        ? "info"
                        : "neutral"
                  }
                >
                  {row.status}
                </Badge>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
                <div className="rounded-xl bg-surface-muted px-2 py-3">
                  <p className="text-caption">Purchases</p>
                  <p className="mt-1 text-lg font-semibold text-text-primary">
                    {row.totalPurchases}
                  </p>
                </div>
                <div className="rounded-xl bg-surface-muted px-2 py-3">
                  <p className="text-caption">Points</p>
                  <p className="mt-1 text-lg font-semibold text-text-primary">
                    {formatRewardAmount(row.totalRewardPoints)}
                  </p>
                </div>
                <div className="rounded-xl bg-accent-soft px-2 py-3">
                  <p className="text-caption text-accent">Reward value</p>
                  <p className="mt-1 text-lg font-semibold text-accent">
                    ₹{formatRewardAmount(row.totalRewardValue)}
                  </p>
                </div>
              </div>

              <div className="mt-5">
                <p className="text-label">Performance by level</p>
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full min-w-[320px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-border text-text-muted">
                        <th className="py-2 font-medium">Level</th>
                        <th className="py-2 font-medium">Purchases</th>
                        <th className="py-2 font-medium">Points</th>
                        <th className="py-2 font-medium">Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {row.byDepth.map((d) => (
                        <tr key={d.depth} className="border-b border-border">
                          <td className="py-2">L{d.depth}</td>
                          <td className="py-2">{d.purchases}</td>
                          <td className="py-2">
                            {formatRewardAmount(d.rewardPoints)}
                          </td>
                          <td className="py-2">
                            ₹{formatRewardAmount(d.rewardValue)}
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

      <p className="mt-8 text-center text-sm text-text-muted">
        Looking for points detail?{" "}
        <Link href="/rewards" className="font-medium text-primary hover:underline">
          My points
        </Link>
      </p>
    </CustomerShell>
  );
}
