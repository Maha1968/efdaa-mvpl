import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DashboardNav } from "@/components/dashboard-nav";
import { redirect } from "next/navigation";

export default async function MyRewardsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/rewards");

  const { data: rewards } = await supabase
    .from("rewards")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const total = (rewards ?? []).reduce(
    (sum, r) => sum + Number(r.amount),
    0,
  );

  const enriched = await Promise.all(
    (rewards ?? []).map(async (reward) => {
      const { data: purchase } = await supabase
        .from("purchases")
        .select("amount, token_id, created_at")
        .eq("id", reward.purchase_id)
        .single();

      let tokenCode: string | null = null;
      let productName: string | null = null;

      if (purchase?.token_id) {
        const { data: token } = await supabase
          .from("tokens")
          .select("code, product_id")
          .eq("id", purchase.token_id)
          .single();
        tokenCode = token?.code ?? null;
        if (token?.product_id) {
          const { data: product } = await supabase
            .from("products")
            .select("name")
            .eq("id", token.product_id)
            .single();
          productName = product?.name ?? null;
        }
      }

      return { reward, purchase, tokenCode, productName };
    }),
  );

  return (
    <main className="flex flex-1 flex-col px-6 py-10">
      <div className="mx-auto w-full max-w-2xl">
        <Link href="/" className="text-sm text-emerald-700 underline">
          ← Home
        </Link>

        <div className="mb-6 mt-4">
          <p className="text-sm font-medium uppercase tracking-widest text-emerald-700">
            EFDAA points
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-zinc-900">
            Your rewards
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            Points appear after an admin validates a purchase in your chain.
          </p>
        </div>

        <DashboardNav current="/rewards" />

        <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
          <p className="text-sm text-emerald-800">Total earned</p>
          <p className="mt-1 text-3xl font-semibold text-emerald-900">
            ₹{total.toFixed(2)}
          </p>
        </div>

        {enriched.length === 0 ? (
          <p className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600">
            No points yet. Share offers or redeem — rewards unlock when a
            purchase in your chain is validated.
          </p>
        ) : (
          <ul className="space-y-3">
            {enriched.map(({ reward, purchase, tokenCode, productName }) => (
              <li
                key={reward.id}
                className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-zinc-900">
                      {productName ?? "Purchase"}
                    </p>
                    <p className="mt-1 text-sm text-zinc-600">
                      Role: {reward.role}
                      {tokenCode ? (
                        <>
                          {" "}
                          · token{" "}
                          <Link
                            href={`/dashboard/tokens/${tokenCode}`}
                            className="font-mono text-emerald-700 underline"
                          >
                            {tokenCode}
                          </Link>
                        </>
                      ) : null}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {new Date(reward.created_at).toLocaleString()}
                      {purchase
                        ? ` · purchase ₹${Number(purchase.amount).toFixed(2)}`
                        : ""}
                    </p>
                  </div>
                  <p className="text-lg font-semibold text-emerald-700">
                    ₹{Number(reward.amount).toFixed(2)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
