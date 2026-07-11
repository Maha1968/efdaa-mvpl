import type { Purchase, Reward, Token } from "@/types/database";
import { roundRewardAmount } from "@/lib/purchases/rewards";

export type DepthStats = {
  depth: number;
  purchases: number;
  rewardPoints: number;
  rewardValue: number;
  referrals?: number;
  purchaseValue?: number;
};

export type OriginatorProductRow = {
  rootTokenId: string;
  rootCode: string;
  productId: string;
  productName: string;
  recommendedAt: string;
  expiresAt: string;
  status: "Active" | "Expired" | "Completed";
  totalPurchases: number;
  totalRewardPoints: number;
  totalRewardValue: number;
  byDepth: DepthStats[];
};

/** Collect all descendant tokens of a root (including root). */
export function collectDescendants(
  rootId: string,
  allTokens: Token[],
): Token[] {
  const byParent = new Map<string, Token[]>();
  for (const t of allTokens) {
    if (!t.parent_token_id) continue;
    const list = byParent.get(t.parent_token_id) ?? [];
    list.push(t);
    byParent.set(t.parent_token_id, list);
  }

  const result: Token[] = [];
  const queue = [rootId];
  const seen = new Set<string>();

  while (queue.length) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const token = allTokens.find((t) => t.id === id);
    if (token) result.push(token);
    for (const child of byParent.get(id) ?? []) {
      queue.push(child.id);
    }
  }

  return result;
}

export function emptyDepthStats(): DepthStats[] {
  return [1, 2, 3, 4, 5].map((depth) => ({
    depth,
    purchases: 0,
    rewardPoints: 0,
    rewardValue: 0,
    referrals: 0,
    purchaseValue: 0,
  }));
}

export function buildCustomerProductStats(input: {
  rootTokens: Token[];
  allTokens: Token[];
  products: { id: string; name: string }[];
  purchases: Purchase[];
  rewards: Reward[];
}): OriginatorProductRow[] {
  const productName = (id: string) =>
    products.find((p) => p.id === id)?.name ?? "Product";
  const { rootTokens, allTokens, products, purchases, rewards } = input;

  return rootTokens.map((root) => {
    const tree = collectDescendants(root.id, allTokens);
    const tokenIds = new Set(tree.map((t) => t.id));
    const treePurchases = purchases.filter(
      (p) => tokenIds.has(p.token_id) && p.status === "validated",
    );
    const purchaseIds = new Set(treePurchases.map((p) => p.id));
    const treeRewards = rewards.filter((r) => purchaseIds.has(r.purchase_id));

    // Customer only sees THEIR reward rows from those purchases
    const myRewards = treeRewards; // caller should already filter by user if needed

    const byDepth = emptyDepthStats();
    for (const purchase of treePurchases) {
      const token = tree.find((t) => t.id === purchase.token_id);
      const depth = Math.min(Math.max(token?.depth ?? 0, 0), 5);
      // Depth 0 purchase = attributed to depth 1 impact for display (buyer from originator share)
      const bucket = depth === 0 ? 1 : depth;
      const row = byDepth.find((d) => d.depth === bucket)!;
      row.purchases += 1;
    }

    for (const reward of myRewards) {
      const purchase = treePurchases.find((p) => p.id === reward.purchase_id);
      if (!purchase) continue;
      const token = tree.find((t) => t.id === purchase.token_id);
      const depth = Math.min(Math.max(token?.depth ?? 0, 0), 5);
      const bucket = depth === 0 ? 1 : depth;
      const row = byDepth.find((d) => d.depth === bucket)!;
      const amount = Number(reward.amount);
      row.rewardValue += amount;
      row.rewardPoints = roundRewardAmount(row.rewardPoints + amount);
    }

    const totalPurchases = treePurchases.length;
    const totalRewardValue = roundRewardAmount(
      myRewards.reduce((s, r) => s + Number(r.amount), 0),
    );

    let status: "Active" | "Expired" | "Completed" = "Active";
    if (totalPurchases > 0) status = "Completed";
    else if (new Date(root.expires_at).getTime() <= Date.now()) status = "Expired";

    return {
      rootTokenId: root.id,
      rootCode: root.code,
      productId: root.product_id,
      productName: productName(root.product_id),
      recommendedAt: root.created_at,
      expiresAt: root.expires_at,
      status,
      totalPurchases,
      totalRewardPoints: totalRewardValue,
      totalRewardValue,
      byDepth,
    };
  });
}
