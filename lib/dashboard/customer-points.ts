import {
  collectDescendants,
  emptyDepthStats,
} from "@/lib/dashboard/analytics";
import { roundRewardAmount } from "@/lib/purchases/rewards";
import type { Purchase, Reward, RewardRole, Token } from "@/types/database";

export type PointsRoleGroup = "originator" | "forwarder" | "buyer";

export type CustomerPointsSummary = {
  lifetime: number;
  asOriginator: number;
  asForwarder: number;
  asBuyer: number;
};

export type OriginatorLevelRow = {
  level: number;
  forwards: number;
  purchases: number;
  purchaseValue: number;
  pointsEarned: number;
};

export type OriginatorRecommendation = {
  id: string;
  productName: string;
  productPhotoUrl: string | null;
  recommendedAt: string;
  status: "Active" | "Expired" | "Completed";
  totalPurchases: number;
  totalPoints: number;
  levels: OriginatorLevelRow[];
};

export type ForwarderContribution = {
  id: string;
  productName: string;
  forwardedAt: string;
  converted: boolean;
  points: number;
  /** Display role — last_referrer kept distinct from middle forwarder. */
  earnAs: "forwarder" | "last_referrer";
};

export type BuyerPurchaseRow = {
  id: string;
  productName: string;
  storeName: string;
  purchasedAt: string;
  amount: number;
  points: number;
};

export type CustomerPointsDashboardData = {
  summary: CustomerPointsSummary;
  originator: OriginatorRecommendation[];
  forwarder: ForwarderContribution[];
  buyer: BuyerPurchaseRow[];
};

function roleGroup(role: RewardRole): PointsRoleGroup {
  if (role === "originator") return "originator";
  if (role === "buyer") return "buyer";
  // forwarder + last_referrer
  return "forwarder";
}

function productNameOf(
  productId: string | null,
  products: { id: string; name: string }[],
) {
  if (!productId) return "Photo recommendation";
  return products.find((p) => p.id === productId)?.name ?? "Product";
}

/** Walk purchase token → root; return this user's deepest token in that chain (depth > 0). */
function myChainToken(
  purchaseTokenId: string,
  allTokens: Token[],
  userId: string,
): Token | null {
  const byId = new Map(allTokens.map((t) => [t.id, t]));
  let current = byId.get(purchaseTokenId) ?? null;
  let best: Token | null = null;
  while (current) {
    if (current.holder_user_id === userId && current.depth > 0) {
      if (!best || current.depth > best.depth) best = current;
    }
    if (!current.parent_token_id) break;
    current = byId.get(current.parent_token_id) ?? null;
  }
  return best;
}

export function buildCustomerPointsDashboard(input: {
  userId: string;
  allTokens: Token[];
  products: { id: string; name: string }[];
  purchases: Purchase[];
  rewards: Reward[];
  stores: { id: string; name: string }[];
}): CustomerPointsDashboardData {
  const { userId, allTokens, products, purchases, rewards, stores } = input;

  const myRewards = rewards.filter((r) => r.user_id === userId);

  let asOriginator = 0;
  let asForwarder = 0;
  let asBuyer = 0;
  for (const r of myRewards) {
    const amount = Number(r.amount);
    const g = roleGroup(r.role);
    if (g === "originator") asOriginator += amount;
    else if (g === "buyer") asBuyer += amount;
    else asForwarder += amount;
  }
  asOriginator = roundRewardAmount(asOriginator);
  asForwarder = roundRewardAmount(asForwarder);
  asBuyer = roundRewardAmount(asBuyer);
  const lifetime = roundRewardAmount(asOriginator + asForwarder + asBuyer);

  const validated = purchases.filter((p) => p.status === "validated");
  const purchaseById = new Map(validated.map((p) => [p.id, p]));

  // —— Section 1: originator recommendations ——
  const roots = allTokens.filter(
    (t) => t.depth === 0 && t.holder_user_id === userId,
  );

  const originator: OriginatorRecommendation[] = roots.map((root) => {
    const tree = collectDescendants(root.id, allTokens);
    const tokenIds = new Set(tree.map((t) => t.id));
    const treePurchases = validated.filter((p) => tokenIds.has(p.token_id));
    const purchaseIds = new Set(treePurchases.map((p) => p.id));
    const myOrigRewards = myRewards.filter(
      (r) => r.role === "originator" && purchaseIds.has(r.purchase_id),
    );

    const levels = emptyDepthStats().map((d) => ({
      level: d.depth,
      forwards: tree.filter((t) => t.depth === d.depth).length,
      purchases: 0,
      purchaseValue: 0,
      pointsEarned: 0,
    }));

    for (const p of treePurchases) {
      const tok = tree.find((t) => t.id === p.token_id);
      const depth = Math.min(Math.max(tok?.depth ?? 0, 0), 5);
      const bucket = depth === 0 ? 1 : depth;
      const row = levels.find((l) => l.level === bucket)!;
      row.purchases += 1;
      row.purchaseValue = roundRewardAmount(
        row.purchaseValue + Number(p.amount),
      );
    }

    for (const r of myOrigRewards) {
      const p = purchaseById.get(r.purchase_id);
      if (!p) continue;
      const tok = tree.find((t) => t.id === p.token_id);
      const depth = Math.min(Math.max(tok?.depth ?? 0, 0), 5);
      const bucket = depth === 0 ? 1 : depth;
      const row = levels.find((l) => l.level === bucket)!;
      row.pointsEarned = roundRewardAmount(
        row.pointsEarned + Number(r.amount),
      );
    }

    const totalPurchases = treePurchases.length;
    const totalPoints = roundRewardAmount(
      myOrigRewards.reduce((s, r) => s + Number(r.amount), 0),
    );

    let status: "Active" | "Expired" | "Completed" = "Active";
    if (totalPurchases > 0) status = "Completed";
    else if (new Date(root.expires_at).getTime() <= Date.now()) {
      status = "Expired";
    }

    return {
      id: root.id,
      productName: productNameOf(root.product_id, products),
      productPhotoUrl: root.product_photo_url,
      recommendedAt: root.created_at,
      status,
      totalPurchases,
      totalPoints,
      levels,
    };
  });

  // —— Section 2: forwarder / last_referrer ——
  const forwardRewards = myRewards.filter(
    (r) => r.role === "forwarder" || r.role === "last_referrer",
  );

  type Agg = {
    token: Token;
    productName: string;
    points: number;
    hasLastReferrer: boolean;
    hasForwarder: boolean;
  };
  const byToken = new Map<string, Agg>();

  for (const r of forwardRewards) {
    const purchase = purchaseById.get(r.purchase_id);
    if (!purchase) continue;
    const mine = myChainToken(purchase.token_id, allTokens, userId);
    if (!mine) continue;
    const existing = byToken.get(mine.id);
    if (existing) {
      existing.points = roundRewardAmount(existing.points + Number(r.amount));
      if (r.role === "last_referrer") existing.hasLastReferrer = true;
      if (r.role === "forwarder") existing.hasForwarder = true;
    } else {
      byToken.set(mine.id, {
        token: mine,
        productName: productNameOf(mine.product_id, products),
        points: roundRewardAmount(Number(r.amount)),
        hasLastReferrer: r.role === "last_referrer",
        hasForwarder: r.role === "forwarder",
      });
    }
  }

  const forwarder: ForwarderContribution[] = [...byToken.values()]
    .map((a) => ({
      id: a.token.id,
      productName: a.productName,
      forwardedAt: a.token.created_at,
      converted: true,
      points: a.points,
      earnAs: a.hasLastReferrer
        ? ("last_referrer" as const)
        : ("forwarder" as const),
    }))
    .sort(
      (a, b) =>
        new Date(b.forwardedAt).getTime() - new Date(a.forwardedAt).getTime(),
    );

  // —— Section 3: buyer ——
  const myPurchases = validated.filter((p) => p.buyer_user_id === userId);
  const buyer: BuyerPurchaseRow[] = myPurchases
    .map((p) => {
      const tok = allTokens.find((t) => t.id === p.token_id);
      const points = roundRewardAmount(
        myRewards
          .filter((r) => r.purchase_id === p.id && r.role === "buyer")
          .reduce((s, r) => s + Number(r.amount), 0),
      );
      const storeName =
        stores.find((s) => s.id === p.store_id)?.name ?? "Store";
      return {
        id: p.id,
        productName: tok
          ? productNameOf(tok.product_id, products)
          : "Product",
        storeName,
        purchasedAt: p.created_at,
        amount: Number(p.amount),
        points,
      };
    })
    .sort(
      (a, b) =>
        new Date(b.purchasedAt).getTime() - new Date(a.purchasedAt).getTime(),
    );

  return {
    summary: { lifetime, asOriginator, asForwarder, asBuyer },
    originator,
    forwarder,
    buyer,
  };
}
