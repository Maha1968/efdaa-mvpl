import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/lib/auth/admin";
import { DashboardNav, ADMIN_NAV } from "@/components/dashboard-nav";
import { toPublicUserId } from "@/lib/privacy/user-id";
import { buildTokenChain } from "@/lib/purchases/chain";
import { AssistLookupForm } from "@/components/assist-lookup-form";
import { notFound, redirect } from "next/navigation";
import type { Token } from "@/types/database";

type PageProps = {
  searchParams: Promise<{ code?: string }>;
};

/** Flatten subtree under `root` (excluding root), depth-first, with indent level. */
function flattenDescendants(
  rootId: string,
  allInTree: Token[],
): { token: Token; indent: number }[] {
  const byParent = new Map<string, Token[]>();
  for (const t of allInTree) {
    if (!t.parent_token_id) continue;
    const list = byParent.get(t.parent_token_id) ?? [];
    list.push(t);
    byParent.set(t.parent_token_id, list);
  }

  const out: { token: Token; indent: number }[] = [];
  const walk = (id: string, indent: number) => {
    const kids = (byParent.get(id) ?? []).sort((a, b) =>
      a.code.localeCompare(b.code),
    );
    for (const kid of kids) {
      out.push({ token: kid, indent });
      walk(kid.id, indent + 1);
    }
  };
  walk(rootId, 0);
  return out;
}

export default async function AdminAssistPage({ searchParams }: PageProps) {
  if (!(await isAdminUser())) notFound();

  const { code: rawCode } = await searchParams;
  const code = rawCode?.trim().toUpperCase();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin/assist");

  let token: Token | null = null;
  let ancestors: Token[] = [];
  let directChildren: Token[] = [];
  let descendants: { token: Token; indent: number }[] = [];
  let events: {
    event_type: string;
    created_at: string;
    actor_user_id: string | null;
  }[] = [];
  let purchase: {
    status: string;
    amount: number;
    created_at: string;
    buyer_user_id: string;
  } | null = null;
  let productName = "Product";
  /** token_id → latest purchase status (any status counts as a purchase mark). */
  const purchaseByTokenId = new Map<string, string>();

  if (code) {
    const { data } = await supabase
      .from("tokens")
      .select("*")
      .eq("code", code)
      .maybeSingle();
    token = data as Token | null;

    if (token) {
      const fetchParent = async (parentId: string) => {
        const { data: p } = await supabase
          .from("tokens")
          .select("*")
          .eq("id", parentId)
          .single();
        return p as Token | null;
      };
      ancestors = await buildTokenChain(token, fetchParent);

      const rootId = token.root_token_id ?? token.id;

      const [
        { data: childRows },
        { data: treeRows },
        { data: eventRows },
        { data: purchaseRow },
        { data: product },
      ] = await Promise.all([
        supabase
          .from("tokens")
          .select("*")
          .eq("parent_token_id", token.id)
          .order("created_at"),
        supabase
          .from("tokens")
          .select("*")
          .or(`id.eq.${rootId},root_token_id.eq.${rootId}`)
          .order("depth")
          .order("created_at"),
        supabase
          .from("referral_events")
          .select("event_type, created_at, actor_user_id")
          .eq("token_id", token.id)
          .order("created_at"),
        supabase
          .from("purchases")
          .select("status, amount, created_at, buyer_user_id")
          .eq("token_id", token.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("products")
          .select("name")
          .eq("id", token.product_id)
          .single(),
      ]);

      const treeTokens = (treeRows as Token[]) ?? [];
      directChildren = (childRows as Token[]) ?? [];
      descendants = flattenDescendants(token.id, treeTokens);
      events = eventRows ?? [];
      purchase = purchaseRow;
      productName = product?.name ?? "Product";

      const treeIds = treeTokens.map((t) => t.id);
      if (treeIds.length > 0) {
        const { data: purchaseRows } = await supabase
          .from("purchases")
          .select("token_id, status, created_at")
          .in("token_id", treeIds)
          .order("created_at", { ascending: false });

        for (const row of purchaseRows ?? []) {
          if (!purchaseByTokenId.has(row.token_id)) {
            purchaseByTokenId.set(row.token_id, row.status);
          }
        }
      }
    }
  }

  function purchaseMark(tokenId: string) {
    const status = purchaseByTokenId.get(tokenId);
    if (!status) return null;
    return (
      <span
        className="ml-1 font-sans font-semibold text-amber-700"
        title={`Purchase on this token (${status})`}
      >
        (P)
      </span>
    );
  }

  const expired = token
    ? new Date(token.expires_at).getTime() <= Date.now()
    : false;

  const maxDescDepth =
    descendants.length > 0
      ? Math.max(...descendants.map((d) => d.token.depth))
      : token?.depth ?? 0;

  return (
    <main className="flex flex-1 flex-col px-6 py-10">
      <div className="mx-auto w-full max-w-3xl">
        <Link href="/admin" className="text-sm text-emerald-700 underline">
          ← Admin overview
        </Link>

        <div className="mb-6 mt-4">
          <h1 className="text-2xl font-semibold text-zinc-900">
            Referral Assist
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            Look up any referral code to see its full lifecycle (User IDs only).
          </p>
        </div>

        <DashboardNav current="/admin/assist" links={ADMIN_NAV} />

        <AssistLookupForm initialCode={code ?? ""} />

        {code && !token && (
          <p className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            No token found for code <span className="font-mono">{code}</span>.
          </p>
        )}

        {token && (
          <div className="mt-6 space-y-5">
            <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <h2 className="font-semibold text-zinc-900">Referral details</h2>
              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-zinc-500">Code</dt>
                  <dd className="font-mono font-medium">
                    {token.code}
                    {purchaseMark(token.id)}
                  </dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Product</dt>
                  <dd>{productName}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Current User ID</dt>
                  <dd className="font-mono">
                    {toPublicUserId(token.holder_user_id)}
                  </dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Parent User ID</dt>
                  <dd className="font-mono">
                    {token.parent_token_id
                      ? toPublicUserId(
                          ancestors[ancestors.length - 2]?.holder_user_id,
                        )
                      : "— (originator)"}
                  </dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Originator User ID</dt>
                  <dd className="font-mono">
                    {toPublicUserId(ancestors[0]?.holder_user_id)}
                  </dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Depth</dt>
                  <dd>{token.depth}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Created</dt>
                  <dd>{new Date(token.created_at).toLocaleString()}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Expires</dt>
                  <dd>{new Date(token.expires_at).toLocaleString()}</dd>
                </div>
              </dl>
            </section>

            <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <h2 className="font-semibold text-zinc-900">Current status</h2>
              <ul className="mt-3 space-y-1 text-sm text-zinc-700">
                <li>
                  Opened:{" "}
                  {events.some((e) => e.event_type === "opened")
                    ? "Yes"
                    : "Unknown / not logged"}
                </li>
                <li>
                  Claimed:{" "}
                  {events.some((e) => e.event_type === "claimed") ||
                  token.claim_lat != null
                    ? "Yes"
                    : "No"}
                </li>
                <li>
                  Redeemed:{" "}
                  {purchase
                    ? `${purchase.status} (₹${Number(purchase.amount).toFixed(2)})`
                    : "No"}
                </li>
                <li>Expired: {expired ? "Yes" : "No"}</li>
                <li>Active: {!expired && !purchase ? "Yes" : "No"}</li>
                <li>Direct child shares: {directChildren.length}</li>
                <li>
                  All downstream tokens: {descendants.length}
                  {descendants.length > 0
                    ? ` (deepest depth ${maxDescDepth})`
                    : ""}
                </li>
              </ul>
            </section>

            <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <h2 className="font-semibold text-zinc-900">
                Antecedents (upstream)
              </h2>
              <p className="mt-1 text-xs text-zinc-500">
                <span className="font-semibold text-amber-700">(P)</span> =
                purchase recorded on that token.
              </p>
              <ol className="mt-3 space-y-2 text-sm">
                {ancestors.map((a, i) => (
                  <li key={a.id} className="font-mono text-zinc-800">
                    {i === 0 ? "Originator" : `Depth ${a.depth}`}:{" "}
                    {toPublicUserId(a.holder_user_id)} · {a.code}
                    {purchaseMark(a.id)} ·{" "}
                    {new Date(a.created_at).toLocaleString()}
                  </li>
                ))}
              </ol>
            </section>

            <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <h2 className="font-semibold text-zinc-900">
                Descendants (full downstream tree)
              </h2>
              <p className="mt-1 text-xs text-zinc-500">
                Indented by generation: child → grandchild → great-grandchild →
                depth 4.{" "}
                <span className="font-semibold text-amber-700">(P)</span> =
                purchase on that token.
              </p>
              {descendants.length === 0 ? (
                <p className="mt-2 text-sm text-zinc-500">No downstream shares yet.</p>
              ) : (
                <ul className="mt-3 space-y-1.5 text-sm">
                  {descendants.map(({ token: d, indent }) => (
                    <li
                      key={d.id}
                      className="font-mono text-zinc-800"
                      style={{ paddingLeft: indent * 16 }}
                    >
                      {indent > 0 ? "└ " : ""}
                      {toPublicUserId(d.holder_user_id)} · {d.code}
                      {purchaseMark(d.id)} · depth {d.depth}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <h2 className="font-semibold text-zinc-900">Timeline</h2>
              <ul className="mt-3 space-y-2 text-sm text-zinc-700">
                <li>
                  {new Date(token.created_at).toLocaleString()} — Token created
                  for {toPublicUserId(token.holder_user_id)}
                </li>
                {events.map((e, i) => (
                  <li key={`${e.created_at}-${i}`}>
                    {new Date(e.created_at).toLocaleString()} — {e.event_type}
                    {e.actor_user_id
                      ? ` · ${toPublicUserId(e.actor_user_id)}`
                      : ""}
                  </li>
                ))}
                {purchase && (
                  <li>
                    {new Date(purchase.created_at).toLocaleString()} — Purchase{" "}
                    {purchase.status} by{" "}
                    {toPublicUserId(purchase.buyer_user_id)} · ₹
                    {Number(purchase.amount).toFixed(2)}
                  </li>
                )}
              </ul>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
