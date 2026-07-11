import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DashboardNav } from "@/components/dashboard-nav";
import { redirect } from "next/navigation";

export default async function DashboardTokensPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard/tokens");

  const { data: tokens } = await supabase
    .from("tokens")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  const enriched = await Promise.all(
    (tokens ?? []).map(async (token) => {
      const [{ data: product }, { data: holder }] = await Promise.all([
        supabase
          .from("products")
          .select("name, barcode")
          .eq("id", token.product_id)
          .single(),
        supabase
          .from("users")
          .select("name")
          .eq("id", token.holder_user_id)
          .single(),
      ]);
      return { token, product, holder };
    }),
  );

  return (
    <main className="flex flex-1 flex-col px-6 py-10">
      <div className="mx-auto w-full max-w-2xl">
        <Link href="/" className="text-sm text-emerald-700 underline">
          ← Home
        </Link>

        <div className="mb-6 mt-4">
          <h1 className="text-2xl font-semibold text-zinc-900">Token chains</h1>
          <p className="mt-2 text-sm text-zinc-600">
            Open any token to see the full chain from originator toward buyers.
          </p>
        </div>

        <DashboardNav current="/dashboard/tokens" />

        {enriched.length === 0 ? (
          <p className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600">
            No tokens yet.
          </p>
        ) : (
          <ul className="space-y-3">
            {enriched.map(({ token, product, holder }) => (
              <li key={token.id}>
                <Link
                  href={`/dashboard/tokens/${token.code}`}
                  className="block rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition-colors hover:border-emerald-300"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-sm font-semibold tracking-wide text-zinc-900">
                        {token.code}
                      </p>
                      <p className="mt-1 text-sm text-zinc-700">
                        {product?.name ?? "Product"} · depth {token.depth}
                      </p>
                      <p className="mt-1 text-xs text-zinc-500">
                        Holder: {holder?.name || "Unknown"} · barcode{" "}
                        {product?.barcode ?? "—"}
                      </p>
                    </div>
                    <p className="text-xs text-zinc-500">
                      {new Date(token.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
