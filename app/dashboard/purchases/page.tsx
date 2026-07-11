import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DashboardNav } from "@/components/dashboard-nav";
import { explainGenuineness } from "@/lib/dashboard/format";
import { redirect } from "next/navigation";

export default async function DashboardPurchasesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard/purchases");

  const { data: purchases } = await supabase
    .from("purchases")
    .select("*")
    .eq("status", "validated")
    .order("created_at", { ascending: false })
    .limit(30);

  const enriched = await Promise.all(
    (purchases ?? []).map(async (purchase) => {
      const { data: token } = await supabase
        .from("tokens")
        .select("code, product_id")
        .eq("id", purchase.token_id)
        .single();

      const [{ data: product }, { data: buyer }, { data: rewards }] =
        await Promise.all([
          token?.product_id
            ? supabase
                .from("products")
                .select("name, barcode")
                .eq("id", token.product_id)
                .single()
            : Promise.resolve({ data: null }),
          supabase
            .from("users")
            .select("name")
            .eq("id", purchase.buyer_user_id)
            .single(),
          supabase
            .from("rewards")
            .select("amount, role, user_id")
            .eq("purchase_id", purchase.id)
            .order("amount", { ascending: false }),
        ]);

      const rewardsNamed = await Promise.all(
        (rewards ?? []).map(async (reward) => {
          const { data: u } = await supabase
            .from("users")
            .select("name")
            .eq("id", reward.user_id)
            .single();
          return { ...reward, name: u?.name || "Unknown" };
        }),
      );

      return {
        purchase,
        token,
        product,
        buyer,
        rewards: rewardsNamed,
        reasons: explainGenuineness(purchase),
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
          <h1 className="text-2xl font-semibold text-zinc-900">
            Validated purchases
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            Genuineness scores, why they scored that way, and rewards paid.
          </p>
        </div>

        <DashboardNav current="/dashboard/purchases" />

        {enriched.length === 0 ? (
          <p className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600">
            No validated purchases yet. Validate a pending receipt first.
          </p>
        ) : (
          <div className="space-y-5">
            {enriched.map(
              ({ purchase, token, product, buyer, rewards, reasons }) => (
                <article
                  key={purchase.id}
                  className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-zinc-900">
                        {product?.name ?? "Product"}
                      </p>
                      <p className="mt-1 text-sm text-zinc-600">
                        Buyer: {buyer?.name || "Unknown"} · ₹
                        {Number(purchase.amount).toFixed(2)}
                      </p>
                      <p className="mt-1 text-xs text-zinc-500">
                        Token{" "}
                        <Link
                          href={`/dashboard/tokens/${token?.code}`}
                          className="font-mono text-emerald-700 underline"
                        >
                          {token?.code ?? "—"}
                        </Link>{" "}
                        · {new Date(purchase.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-zinc-500">Genuineness</p>
                      <p className="text-xl font-semibold text-emerald-700">
                        {Number(purchase.genuineness_score ?? 0).toFixed(3)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <p className="text-sm font-medium text-zinc-700">Why</p>
                    <ul className="mt-1 list-inside list-disc text-sm text-zinc-600">
                      {reasons.map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-4">
                    <p className="text-sm font-medium text-zinc-700">
                      Rewards paid
                    </p>
                    {rewards.length === 0 ? (
                      <p className="mt-1 text-sm text-zinc-500">No rewards.</p>
                    ) : (
                      <ul className="mt-2 space-y-1">
                        {rewards.map((reward) => (
                          <li
                            key={`${reward.user_id}-${reward.role}`}
                            className="flex justify-between text-sm"
                          >
                            <span className="text-zinc-700">
                              {reward.name}{" "}
                              <span className="text-zinc-400">
                                ({reward.role})
                              </span>
                            </span>
                            <span className="font-medium text-emerald-700">
                              ₹{Number(reward.amount).toFixed(2)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <Link
                    href={`/dashboard/purchases/${purchase.id}`}
                    className="mt-4 inline-block text-sm text-emerald-700 underline"
                  >
                    Full detail
                  </Link>
                </article>
              ),
            )}
          </div>
        )}
      </div>
    </main>
  );
}
