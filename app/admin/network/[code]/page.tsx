import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/lib/auth/admin";
import { toPublicUserId } from "@/lib/privacy/user-id";
import { collectDescendants } from "@/lib/dashboard/analytics";
import { notFound, redirect } from "next/navigation";
import type { Token } from "@/types/database";

type PageProps = {
  params: Promise<{ code: string }>;
};

type TreeNode = {
  token: Token;
  children: TreeNode[];
  purchases: number;
  purchaseValue: number;
  rewardValue: number;
};

function buildTree(
  root: Token,
  all: Token[],
  purchases: { token_id: string; amount: number }[],
  rewardsByPurchase: Map<string, number>,
  purchaseIdByToken: Map<string, string[]>,
): TreeNode {
  const children = all
    .filter((t) => t.parent_token_id === root.id)
    .map((child) =>
      buildTree(child, all, purchases, rewardsByPurchase, purchaseIdByToken),
    );

  const tokenPurchases = purchases.filter((p) => p.token_id === root.id);
  const purchaseValue = tokenPurchases.reduce((s, p) => s + Number(p.amount), 0);
  let rewardValue = 0;
  for (const pid of purchaseIdByToken.get(root.id) ?? []) {
    rewardValue += rewardsByPurchase.get(pid) ?? 0;
  }

  return {
    token: root,
    children,
    purchases: tokenPurchases.length,
    purchaseValue,
    rewardValue,
  };
}

function TreeNodeView({ node, depth }: { node: TreeNode; depth: number }) {
  const hasPurchase = node.purchases > 0;
  return (
    <li className="mt-3">
      <div
        className="rounded-xl border border-border bg-white p-4 shadow-sm"
        style={{ marginLeft: Math.min(depth, 5) * 12 }}
      >
        <p className="text-xs font-medium uppercase tracking-wide text-primary">
          Level {node.token.depth}
          {hasPurchase ? (
            <span
              className="ml-2 font-sans font-semibold normal-case text-amber-700"
              title="Purchase recorded on this token"
            >
              (P)
            </span>
          ) : null}
        </p>
        <p className="mt-1 font-mono text-sm font-semibold text-text-primary">
          {toPublicUserId(node.token.holder_user_id)}
        </p>
        <p className="mt-1 text-xs text-text-muted">
          Code{" "}
          <span className="font-mono">
            {node.token.code}
            {hasPurchase ? (
              <span
                className="ml-1 font-sans font-semibold text-amber-700"
                title="Purchase recorded on this token"
              >
                (P)
              </span>
            ) : null}
          </span>
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-text-secondary sm:grid-cols-4">
          <span>Forwards: {node.children.length}</span>
          <span>Purchases: {node.purchases}</span>
          <span>Value: ₹{node.purchaseValue.toFixed(0)}</span>
          <span>Rewards: ₹{node.rewardValue.toFixed(0)}</span>
        </div>
      </div>
      {node.children.length > 0 && (
        <ul>
          {node.children.map((child) => (
            <TreeNodeView key={child.token.id} node={child} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

export default async function AdminNetworkTreePage({ params }: PageProps) {
  if (!(await isAdminUser())) notFound();

  const { code } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/admin/network/${code}`);

  const { data: root } = await supabase
    .from("tokens")
    .select("*")
    .eq("code", code)
    .single();

  if (!root || root.depth !== 0) notFound();

  const [{ data: tokens }, { data: purchases }, { data: rewards }, { data: product }] =
    await Promise.all([
      supabase.from("tokens").select("*"),
      supabase.from("purchases").select("id, token_id, amount").eq("status", "validated"),
      supabase.from("rewards").select("purchase_id, amount"),
      supabase.from("products").select("name").eq("id", root.product_id).single(),
    ]);

  const all = (tokens as Token[]) ?? [];
  const treeTokens = collectDescendants(root.id, all);
  const purchaseIdByToken = new Map<string, string[]>();
  for (const p of purchases ?? []) {
    const list = purchaseIdByToken.get(p.token_id) ?? [];
    list.push(p.id);
    purchaseIdByToken.set(p.token_id, list);
  }
  const rewardsByPurchase = new Map<string, number>();
  for (const r of rewards ?? []) {
    rewardsByPurchase.set(
      r.purchase_id,
      (rewardsByPurchase.get(r.purchase_id) ?? 0) + Number(r.amount),
    );
  }

  const tree = buildTree(
    root as Token,
    treeTokens,
    purchases ?? [],
    rewardsByPurchase,
    purchaseIdByToken,
  );

  return (
    <main className="flex flex-1 flex-col px-6 py-10">
      <div className="mx-auto w-full max-w-3xl">
        <Link href="/admin/network" className="text-sm text-primary underline">
          ← Network
        </Link>

        <div className="mb-6 mt-4">
          <h1 className="text-2xl font-semibold text-text-primary">
            Referral tree
          </h1>
          <p className="mt-2 text-sm text-text-secondary">
            {product?.name ?? "Product"} · Originator{" "}
            <span className="font-mono">
              {toPublicUserId(root.holder_user_id)}
            </span>
          </p>
          <p className="mt-1 text-xs text-text-muted">
            <span className="font-semibold text-amber-700">(P)</span> = purchase
            recorded on that token.
          </p>
        </div>

        <ul>
          <TreeNodeView node={tree} depth={0} />
        </ul>
      </div>
    </main>
  );
}
