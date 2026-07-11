import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DashboardNav, CUSTOMER_NAV } from "@/components/dashboard-nav";
import { CustomerPointsDashboard } from "@/components/customer-points-dashboard";
import { buildCustomerPointsDashboard } from "@/lib/dashboard/customer-points";
import { isAdminUser } from "@/lib/auth/admin";
import { redirect } from "next/navigation";
import type { Purchase, Reward, Token } from "@/types/database";

export default async function MyRewardsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/rewards");

  if (await isAdminUser()) redirect("/admin");

  const [
    { data: allTokens },
    { data: products },
    { data: purchases },
    { data: myRewards },
    { data: stores },
  ] = await Promise.all([
    supabase.from("tokens").select("*"),
    supabase.from("products").select("id, name"),
    supabase.from("purchases").select("*").eq("status", "validated"),
    supabase.from("rewards").select("*").eq("user_id", user.id),
    supabase.from("stores").select("id, name"),
  ]);

  const data = buildCustomerPointsDashboard({
    userId: user.id,
    allTokens: (allTokens as Token[]) ?? [],
    products: products ?? [],
    purchases: (purchases as Purchase[]) ?? [],
    rewards: (myRewards as Reward[]) ?? [],
    stores: stores ?? [],
  });

  return (
    <main className="flex flex-1 flex-col px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto w-full max-w-2xl">
        <Link href="/" className="text-sm text-emerald-700 underline">
          ← Home
        </Link>

        <div className="mb-6 mt-4">
          <p className="text-sm font-medium uppercase tracking-widest text-emerald-700">
            EFDAA points
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-zinc-900">
            My points
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            Your lifetime earnings from recommendations you started, passed on,
            or bought through — never other people&apos;s identities.
          </p>
        </div>

        <DashboardNav current="/rewards" links={CUSTOMER_NAV} />

        <CustomerPointsDashboard data={data} />
      </div>
    </main>
  );
}
