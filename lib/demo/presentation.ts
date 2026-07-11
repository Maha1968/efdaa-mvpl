import type { SupabaseClient } from "@supabase/supabase-js";
import { buildTokenChain } from "@/lib/purchases/chain";
import { computeGenuinenessScore } from "@/lib/purchases/genuineness";
import { computeBasePool, formatRewardAmount } from "@/lib/purchases/rewards";
import { toPublicUserId } from "@/lib/privacy/user-id";
import type { Purchase, Reward, RewardRole, Token } from "@/types/database";
import {
  MIN_GENUINE_DISTANCE_METERS,
  MIN_GENUINE_TIME_MINUTES,
  ZERO_SCORE_FLOOR_REWARD_PCT,
} from "@/config/rewards";
import { STORE_MATCH_MAX_DISTANCE_M } from "@/lib/purchases/validation";

export type DemoChainKind = "genuine" | "proximity" | "expired";

export type DemoNode = {
  role: string;
  publicUserId: string;
  place: string;
  coords: string | null;
  at: string;
};

export type DemoHop = {
  distance_m: number | null;
  time_minutes: number | null;
  suspicious: boolean;
  scoresProximity: boolean;
  label: string;
};

export type DemoCheck = {
  label: string;
  pass: boolean;
  detail: string;
};

export type DemoRewardSplit = {
  role: RewardRole;
  amount: number;
  publicUserId: string;
};

export type DemoPresentationChain = {
  kind: DemoChainKind;
  title: string;
  subtitle: string;
  thesis: string;
  nodes: DemoNode[];
  hops: DemoHop[];
  productName: string;
  barcode: string;
  storeName: string;
  amount: number;
  receiptImageUrl: string | null;
  score: number;
  scoreBand: "strong" | "reduced" | "zero";
  checks: DemoCheck[];
  reasons: string[];
  basePool: number;
  scoredPool: number;
  usedZeroScoreFloor: boolean;
  rewards: DemoRewardSplit[];
};

export type DemoPresentationData = {
  stats: {
    chainsTracked: number;
    purchasesAttributed: number;
    rewardsPaid: number;
  };
  chains: DemoPresentationChain[];
  loaded: boolean;
};

const CHAIN_SPECS: {
  kind: DemoChainKind;
  rootCode: string;
  title: string;
  subtitle: string;
  thesis: string;
}[] = [
  {
    kind: "genuine",
    rootCode: "DEMOGEN0",
    title: "Chain A — Genuine",
    subtitle: "Kilometres and hours between people",
    thesis: "Pays in full — the hops clear the anti-collusion bar.",
  },
  {
    kind: "proximity",
    rootCode: "DEMOPRX0",
    title: "Chain B — Suspicious proximity",
    subtitle: "Same place, minutes apart",
    thesis: "Caught — proximity-time penalty cuts the reward.",
  },
  {
    kind: "expired",
    rootCode: "DEMOEXP0",
    title: "Chain C — Out of window",
    subtitle: "Purchase after the chain expired",
    thesis:
      "Score is zero — but the attribution record still exists, and the floor still pays.",
  },
];

function roleForTokenIndex(index: number, chainLen: number): string {
  if (index === 0) return "Originator";
  if (index === chainLen - 1) return "Last referrer";
  return "Forwarder";
}

function formatCoords(lat: number | null, lng: number | null) {
  if (lat == null || lng == null) return null;
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

function scoreBand(score: number): "strong" | "reduced" | "zero" {
  if (score <= 0) return "zero";
  if (score >= 0.8) return "strong";
  return "reduced";
}

async function loadOneChain(
  admin: SupabaseClient,
  spec: (typeof CHAIN_SPECS)[number],
): Promise<DemoPresentationChain | null> {
  const { data: root } = await admin
    .from("tokens")
    .select("*")
    .eq("code", spec.rootCode)
    .eq("is_demo", true)
    .maybeSingle();

  if (!root) return null;

  const rootId = root.root_token_id ?? root.id;

  const { data: treeTokens } = await admin
    .from("tokens")
    .select("*")
    .or(`id.eq.${rootId},root_token_id.eq.${rootId}`)
    .eq("is_demo", true);

  const tokens = (treeTokens as Token[]) ?? [];
  const tokenIds = tokens.map((t) => t.id);
  if (tokenIds.length === 0) return null;

  const { data: purchaseRow } = await admin
    .from("purchases")
    .select("*")
    .in("token_id", tokenIds)
    .eq("is_demo", true)
    .eq("status", "validated")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!purchaseRow) return null;
  const purchase = purchaseRow as Purchase;

  const leaf = tokens.find((t) => t.id === purchase.token_id);
  if (!leaf) return null;

  const byId = new Map(tokens.map((t) => [t.id, t]));
  const fetchParent = async (parentId: string) => byId.get(parentId) ?? null;
  const chain = await buildTokenChain(leaf, fetchParent);

  const { data: product } = await admin
    .from("products")
    .select("name, barcode")
    .eq("id", leaf.product_id)
    .maybeSingle();

  const { data: store } = purchase.store_id
    ? await admin
        .from("stores")
        .select("name")
        .eq("id", purchase.store_id)
        .maybeSingle()
    : { data: null };

  const { data: offer } = await admin
    .from("offers")
    .select("base_reward_pct")
    .eq("id", leaf.offer_id)
    .maybeSingle();

  const { data: rewardRows } = await admin
    .from("rewards")
    .select("*")
    .eq("purchase_id", purchase.id)
    .eq("is_demo", true);

  const flags = {
    barcode_match: Boolean(purchase.barcode_match),
    store_match: Boolean(purchase.store_match),
    within_window: Boolean(purchase.within_window),
  };

  const genuineness = computeGenuinenessScore(flags, chain, purchase);
  const score =
    purchase.genuineness_score != null
      ? Number(purchase.genuineness_score)
      : genuineness.genuineness_score;

  const offerPct = Number(offer?.base_reward_pct ?? 0.05);
  const pool = computeBasePool({
    amount: Number(purchase.amount),
    baseRewardPct: offerPct,
    genuinenessScore: score,
  });

  const nodes: DemoNode[] = chain.map((t, i) => ({
    role: roleForTokenIndex(i, chain.length),
    publicUserId: toPublicUserId(t.holder_user_id),
    place: t.claim_location_text?.trim() || "Claim location",
    coords: formatCoords(t.claim_lat, t.claim_lng),
    at: t.created_at,
  }));

  nodes.push({
    role: "Buyer",
    publicUserId: toPublicUserId(purchase.buyer_user_id),
    place: store?.name ?? "Partner store",
    coords: formatCoords(purchase.purchase_lat, purchase.purchase_lng),
    at: purchase.created_at,
  });

  const hops: DemoHop[] = genuineness.hops.map((h) => {
    const dist =
      h.distance_m != null
        ? h.distance_m < 1000
          ? `${Math.round(h.distance_m)} m`
          : `${(h.distance_m / 1000).toFixed(1)} km`
        : "—";
    const time =
      h.time_minutes != null
        ? h.time_minutes < 60
          ? `${Math.round(h.time_minutes)} min`
          : `${(h.time_minutes / 60).toFixed(1)} h`
        : "—";
    return {
      distance_m: h.distance_m,
      time_minutes: h.time_minutes,
      suspicious: h.suspicious,
      scoresProximity: h.scoresProximity,
      label: `${dist} · ${time}`,
    };
  });

  const suspiciousHop = genuineness.hops.find((h) => h.scoresProximity);
  const checks: DemoCheck[] = [
    {
      label: "Barcode match",
      pass: flags.barcode_match,
      detail: flags.barcode_match
        ? "Receipt barcode matches the recommended product"
        : "Barcode did not match",
    },
    {
      label: "Correct store",
      pass: flags.store_match,
      detail: flags.store_match
        ? `Purchase GPS within ${STORE_MATCH_MAX_DISTANCE_M}m of the selected partner store`
        : `Purchase GPS was farther than ${STORE_MATCH_MAX_DISTANCE_M}m from the selected partner store`,
    },
    {
      label: "Within validity window",
      pass: flags.within_window,
      detail: flags.within_window
        ? "Purchase before chain expiry"
        : "Purchase after the originator's 24h window",
    },
    {
      label: "Proximity–time (originator ↔ buyer claim)",
      pass: !genuineness.proximityPenaltyApplied,
      detail: genuineness.proximityPenaltyApplied
        ? `Flagged: buyer claimed within ${MIN_GENUINE_DISTANCE_METERS}m and ${MIN_GENUINE_TIME_MINUTES} min of the originator` +
          (suspiciousHop?.distance_m != null
            ? ` (${Math.round(suspiciousHop.distance_m)}m, ${suspiciousHop.time_minutes?.toFixed(0)} min)`
            : "")
        : `Cleared: buyer claim was not both <${MIN_GENUINE_DISTANCE_METERS}m and <${MIN_GENUINE_TIME_MINUTES} min from the originator`,
    },
  ];

  const rewards: DemoRewardSplit[] = ((rewardRows as Reward[]) ?? []).map(
    (r) => ({
      role: r.role,
      amount: Number(r.amount),
      publicUserId: toPublicUserId(r.user_id),
    }),
  );

  return {
    kind: spec.kind,
    title: spec.title,
    subtitle: spec.subtitle,
    thesis: spec.thesis,
    nodes,
    hops,
    productName: product?.name ?? "Product",
    barcode: product?.barcode ?? purchase.receipt_barcode ?? "—",
    storeName: store?.name ?? "Store",
    amount: Number(purchase.amount),
    receiptImageUrl: purchase.receipt_image_url,
    score,
    scoreBand: scoreBand(score),
    checks,
    reasons: genuineness.reasons,
    basePool: pool.basePool,
    scoredPool: pool.scoredPool,
    usedZeroScoreFloor: pool.usedZeroScoreFloor,
    rewards,
  };
}

export async function loadDemoPresentation(
  admin: SupabaseClient,
): Promise<DemoPresentationData> {
  const [
    { count: purchaseCount },
    { data: rewardSumRows },
    { count: rootCount },
  ] = await Promise.all([
    admin
      .from("purchases")
      .select("id", { count: "exact", head: true })
      .eq("is_demo", true)
      .eq("status", "validated"),
    admin.from("rewards").select("amount").eq("is_demo", true),
    admin
      .from("tokens")
      .select("id", { count: "exact", head: true })
      .eq("is_demo", true)
      .eq("depth", 0),
  ]);

  const rewardsPaid = (rewardSumRows ?? []).reduce(
    (s, r) => s + Number(r.amount),
    0,
  );

  const chains: DemoPresentationChain[] = [];
  for (const spec of CHAIN_SPECS) {
    const chain = await loadOneChain(admin, spec);
    if (chain) chains.push(chain);
  }

  return {
    stats: {
      chainsTracked: rootCount ?? 0,
      purchasesAttributed: purchaseCount ?? 0,
      rewardsPaid: Number(rewardsPaid.toFixed(2)),
    },
    chains,
    loaded: chains.length > 0,
  };
}

export { formatRewardAmount, ZERO_SCORE_FLOOR_REWARD_PCT };
