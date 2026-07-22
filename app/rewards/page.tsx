import { CustomerShell } from "@/components/layout/customer-shell";
import { CustomerPointsDashboard } from "@/components/customer-points-dashboard";
import { PageHeader } from "@/components/ui/card";
import { buildCustomerPointsDashboard } from "@/lib/dashboard/customer-points";
import { isAdminUser } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
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
    <CustomerShell wide>
      <PageHeader
        eyebrow="MOJODAA points"
        title="My points"
        description="Your lifetime earnings from finds you shared, passed on, or bought through — never other people's identities."
      />
      <CustomerPointsDashboard data={data} />
    </CustomerShell>
  );
}
