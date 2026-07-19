import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/lib/auth/admin";
import { toPublicUserId } from "@/lib/privacy/user-id";
import { collectDescendants } from "@/lib/dashboard/analytics";
import { notFound, redirect } from "next/navigation";
import type { Token } from "@/types/database";

type SearchParams = Promise<{
  product?: string;
  originator?: string;
  status?: string;
}>;

export default async function AdminNetworkPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  if (!(await isAdminUser())) notFound();

  const filters = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin/network");

  const [{ data: tokens }, { data: products }, { data: purchases }] =
    await Promise.all([
      supabase.from("tokens").select("*").order("created_at", { ascending: false }),
      supabase.from("products").select("id, name"),
      supabase.from("purchases").select("*").eq("status", "validated"),
    ]);

  let roots = ((tokens as Token[]) ?? []).filter((t) => t.depth === 0);

  if (filters.product) {
    roots = roots.filter((t) => t.product_id === filters.product);
  }
  if (filters.originator) {
    const q = filters.originator.replace(/^U-/i, "").toLowerCase();
    roots = roots.filter((t) =>
      t.holder_user_id.replace(/-/g, "").toLowerCase().startsWith(q),
    );
  }
  if (filters.status === "active") {
    roots = roots.filter((t) => new Date(t.expires_at) > new Date());
  } else if (filters.status === "expired") {
    roots = roots.filter((t) => new Date(t.expires_at) <= new Date());
  }

  const allTokens = (tokens as Token[]) ?? [];

  const rows = roots.map((root) => {
    const tree = collectDescendants(root.id, allTokens);
    const tokenIds = new Set(tree.map((t) => t.id));
    const treePurchases = (purchases ?? []).filter((p) =>
      tokenIds.has(p.token_id),
    );
    const forwards = tree.filter((t) => t.depth > 0).length;
    const purchaseValue = treePurchases.reduce(
      (s, p) => s + Number(p.amount),
      0,
    );
    const product = products?.find((p) => p.id === root.product_id);

    const byDepth = [1, 2, 3, 4, 5].map((depth) => ({
      depth,
      referrals: tree.filter((t) => t.depth === depth).length,
      purchases: treePurchases.filter((p) => {
        const tok = tree.find((t) => t.id === p.token_id);
        return tok && (tok.depth === depth || (depth === 1 && tok.depth === 0));
      }).length,
    }));

    return {
      root,
      productName: product?.name ?? "Product",
      forwards,
      purchases: treePurchases.length,
      purchaseValue,
      byDepth,
    };
  });

  return (
    <main className="flex flex-1 flex-col px-6 py-10">
      <div className="mx-auto w-full max-w-3xl">
        <Link href="/admin" className="text-sm text-primary underline">
          ← Admin overview
        </Link>

        <div className="mb-6 mt-4">
          <h1 className="text-2xl font-semibold text-text-primary">
            Referral network
          </h1>
          <p className="mt-2 text-sm text-text-secondary">
            Originators and depth analytics — User IDs only.
          </p>
        </div>

        <form className="mb-6 grid gap-3 rounded-2xl border border-border bg-surface p-4 sm:grid-cols-3">
          <div>
            <label className="text-xs text-text-muted">Product</label>
            <select
              name="product"
              defaultValue={filters.product ?? ""}
              className="mt-1 w-full rounded-xl border border-border-strong px-3 py-2 text-sm"
            >
              <option value="">All</option>
              {(products ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-text-muted">Originator User ID</label>
            <input
              name="originator"
              defaultValue={filters.originator ?? ""}
              placeholder="U-XXXXXXXX"
              className="mt-1 w-full rounded-xl border border-border-strong px-3 py-2 text-sm font-mono"
            />
          </div>
          <div>
            <label className="text-xs text-text-muted">Status</label>
            <select
              name="status"
              defaultValue={filters.status ?? ""}
              className="mt-1 w-full rounded-xl border border-border-strong px-3 py-2 text-sm"
            >
              <option value="">All</option>
              <option value="active">Active</option>
              <option value="expired">Expired</option>
            </select>
          </div>
          <button
            type="submit"
            className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white sm:col-span-3"
          >
            Apply filters
          </button>
        </form>

        <ul className="space-y-4">
          {rows.map(({ root, productName, forwards, purchases, purchaseValue, byDepth }) => (
            <li
              key={root.id}
              className="rounded-2xl border border-border bg-surface p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-mono text-sm font-semibold text-text-primary">
                    {toPublicUserId(root.holder_user_id)}
                  </p>
                  <p className="mt-1 text-sm text-text-secondary">{productName}</p>
                  <p className="mt-1 text-xs text-text-muted">
                    {new Date(root.created_at).toLocaleString()} · code{" "}
                    <span className="font-mono">{root.code}</span>
                    {purchases > 0
                      ? ` · ${purchases} purchase${purchases === 1 ? "" : "s"} in tree`
                      : ""}
                  </p>
                </div>
                <Link
                  href={`/admin/network/${root.code}`}
                  className="text-sm text-primary underline"
                >
                  View tree
                </Link>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-lg bg-surface-muted py-2">
                  <p className="text-text-muted">Forwards</p>
                  <p className="font-semibold">{forwards}</p>
                </div>
                <div className="rounded-lg bg-surface-muted py-2">
                  <p className="text-text-muted">Purchases</p>
                  <p className="font-semibold">{purchases}</p>
                </div>
                <div className="rounded-lg bg-surface-muted py-2">
                  <p className="text-text-muted">Value</p>
                  <p className="font-semibold">₹{purchaseValue.toFixed(0)}</p>
                </div>
              </div>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-text-muted">
                      <th className="py-1">Depth</th>
                      <th>Referrals</th>
                      <th>Purchases</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byDepth.map((d) => (
                      <tr key={d.depth} className="border-t border-border">
                        <td className="py-1">{d.depth}</td>
                        <td>{d.referrals}</td>
                        <td>{d.purchases}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
