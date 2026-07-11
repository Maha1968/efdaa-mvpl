import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DashboardNav } from "@/components/dashboard-nav";
import { buildTokenChain } from "@/lib/purchases/chain";
import { mapChainPeople } from "@/lib/dashboard/format";
import { notFound, redirect } from "next/navigation";
import type { Token } from "@/types/database";

type PageProps = {
  params: Promise<{ code: string }>;
};

export default async function TokenChainPage({ params }: PageProps) {
  const { code } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/dashboard/tokens/${code}`);

  const { data: token } = await supabase
    .from("tokens")
    .select("*")
    .eq("code", code)
    .single();

  if (!token) notFound();

  const fetchParent = async (parentId: string) => {
    const { data } = await supabase
      .from("tokens")
      .select("*")
      .eq("id", parentId)
      .single();
    return data as Token | null;
  };

  const chain = await buildTokenChain(token as Token, fetchParent);

  // Also walk downward: children that were shared from this root lineage
  // For display we show the upward chain for this token; plus any purchase on this token.
  const [{ data: product }, { data: offer }, { data: purchase }] =
    await Promise.all([
      supabase
        .from("products")
        .select("name, barcode, price")
        .eq("id", token.product_id)
        .single(),
      supabase
        .from("offers")
        .select("name, base_reward_pct")
        .eq("id", token.offer_id)
        .single(),
      supabase
        .from("purchases")
        .select("*")
        .eq("token_id", token.id)
        .in("status", ["pending", "validated"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  const holderIds = Array.from(new Set(chain.map((t) => t.holder_user_id)));
  if (purchase?.buyer_user_id) holderIds.push(purchase.buyer_user_id);

  const namesById: Record<string, string> = {};
  await Promise.all(
    holderIds.map(async (id) => {
      const { data: u } = await supabase
        .from("users")
        .select("name")
        .eq("id", id)
        .single();
      namesById[id] = u?.name || "Unknown";
    }),
  );

  const people = mapChainPeople(chain, namesById, purchase?.buyer_user_id);

  return (
    <main className="flex flex-1 flex-col px-6 py-10">
      <div className="mx-auto w-full max-w-2xl">
        <Link
          href="/dashboard/tokens"
          className="text-sm text-emerald-700 underline"
        >
          ← All tokens
        </Link>

        <div className="mb-6 mt-4">
          <h1 className="text-2xl font-semibold text-zinc-900">
            Chain for {code}
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            {product?.name ?? "Product"} · barcode {product?.barcode ?? "—"}
            {offer
              ? ` · ${(Number(offer.base_reward_pct) * 100).toFixed(0)}% offer`
              : ""}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Expires {new Date(token.expires_at).toLocaleString()}
          </p>
        </div>

        <DashboardNav current="/dashboard/tokens" />

        <ol className="space-y-4">
          {people.map((person, index) => (
            <li
              key={`${person.tokenCode}-${index}`}
              className="relative rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
            >
              {index < people.length - 1 && (
                <div className="absolute -bottom-4 left-6 h-4 w-px bg-emerald-300" />
              )}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">
                    Depth {person.depth} · {person.roleLabel}
                  </p>
                  <p className="mt-1 text-lg font-semibold text-zinc-900">
                    {person.userName}
                  </p>
                  <p className="mt-1 font-mono text-sm text-zinc-600">
                    {person.tokenCode}
                  </p>
                </div>
              </div>
              <div className="mt-3 space-y-1 text-sm text-zinc-600">
                <p>
                  When: {new Date(person.createdAt).toLocaleString()}
                </p>
                <p>
                  Where:{" "}
                  {person.claimLat != null && person.claimLng != null
                    ? `${person.claimLat.toFixed(5)}, ${person.claimLng.toFixed(5)}`
                    : "—"}
                  {person.claimLocationText
                    ? ` · ${person.claimLocationText}`
                    : ""}
                </p>
                <p>Expires: {new Date(person.expiresAt).toLocaleString()}</p>
              </div>
            </li>
          ))}
        </ol>

        {purchase && (
          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <p className="text-sm font-medium text-emerald-900">
              Purchase on this token
            </p>
            <p className="mt-1 text-sm text-emerald-800">
              Buyer: {namesById[purchase.buyer_user_id] || "Unknown"} · ₹
              {Number(purchase.amount).toFixed(2)} · status{" "}
              <strong>{purchase.status}</strong>
            </p>
            {purchase.purchase_lat != null && purchase.purchase_lng != null && (
              <p className="mt-1 text-xs text-emerald-700">
                Purchase GPS: {purchase.purchase_lat.toFixed(5)},{" "}
                {purchase.purchase_lng.toFixed(5)} ·{" "}
                {new Date(purchase.created_at).toLocaleString()}
              </p>
            )}
            {purchase.status === "validated" && (
              <Link
                href={`/dashboard/purchases/${purchase.id}`}
                className="mt-3 inline-block text-sm text-emerald-800 underline"
              >
                View score & rewards
              </Link>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
