import type { SupabaseClient } from "@supabase/supabase-js";
import { computePurchaseSignalFlags } from "@/lib/purchases/validation";
import { computeGenuinenessScore } from "@/lib/purchases/genuineness";
import {
  computeBasePool,
  computeRewardSplit,
  roundRewardAmount,
  type RewardAllocation,
} from "@/lib/purchases/rewards";
import { buildTokenChain } from "@/lib/purchases/chain";
import type { Token } from "@/types/database";
import type { GenuinenessResult } from "@/lib/purchases/genuineness";
import type { SignalFlags } from "@/lib/purchases/validation";

export type ValidationApplyResult = {
  flags: SignalFlags;
  genuineness: GenuinenessResult;
  basePool: number;
  scoredPool: number;
  usedZeroScoreFloor: boolean;
  payable: RewardAllocation[];
  amount: number;
  offerPct: number;
};

/**
 * Run the real genuineness + reward engine on a pending purchase and persist results.
 * Shared by admin Validate and demo seeding — no hard-coded scores or amounts.
 */
export async function applyPurchaseValidation(
  supabase: SupabaseClient,
  purchaseId: string,
  options?: { isDemo?: boolean },
): Promise<{ ok: true; result: ValidationApplyResult } | { ok: false; error: string }> {
  const { data: purchase, error: purchaseError } = await supabase
    .from("purchases")
    .select("*")
    .eq("id", purchaseId)
    .single();

  if (purchaseError || !purchase) {
    return { ok: false, error: "Purchase not found." };
  }

  if (purchase.status !== "pending") {
    return { ok: false, error: "Purchase is not pending." };
  }

  const { data: token, error: tokenError } = await supabase
    .from("tokens")
    .select("*")
    .eq("id", purchase.token_id)
    .single();

  if (tokenError || !token) {
    return { ok: false, error: "Token not found." };
  }

  // Invariant: receipt purchase time ≥ buyer claim time.
  const purchasedAt = purchase.receipt_purchased_at
    ? new Date(purchase.receipt_purchased_at)
    : new Date(purchase.created_at);
  if (purchasedAt.getTime() < new Date(token.created_at).getTime()) {
    return {
      ok: false,
      error: "Receipt purchase time cannot be before the buyer’s coupon claim.",
    };
  }

  const fetchParentToken = async (parentId: string) => {
    const { data } = await supabase
      .from("tokens")
      .select("*")
      .eq("id", parentId)
      .single();
    return data as Token | null;
  };

  const chain = await buildTokenChain(token, fetchParentToken);
  const root = chain[0];
  const originatorStoreId =
    root.originator_store_id ?? token.originator_store_id ?? purchase.store_id;

  const [{ data: product }, { data: originatorStore }, { data: offer }] =
    await Promise.all([
      supabase.from("products").select("*").eq("id", token.product_id).single(),
      originatorStoreId
        ? supabase
            .from("stores")
            .select("*")
            .eq("id", originatorStoreId)
            .single()
        : Promise.resolve({ data: null }),
      supabase.from("offers").select("*").eq("id", token.offer_id).single(),
    ]);

  if (!product) return { ok: false, error: "Product not found." };
  if (!offer) return { ok: false, error: "Offer not found." };

  const flags = await computePurchaseSignalFlags({
    purchase,
    token,
    product,
    originatorStore: originatorStore ?? null,
    fetchParentToken,
  });

  const genuineness = computeGenuinenessScore(flags, chain, purchase);

  const amount = Number(purchase.amount);
  const offerPct = Number(offer.base_reward_pct);
  const pool = computeBasePool({
    amount,
    baseRewardPct: offerPct,
    genuinenessScore: genuineness.genuineness_score,
  });

  const allocations = computeRewardSplit({
    chain,
    buyerUserId: purchase.buyer_user_id,
    basePool: pool.basePool,
  });

  const recipientIds = [...new Set(allocations.map((a) => a.user_id))];
  const { data: recipientProfiles } = await supabase
    .from("users")
    .select("id, role")
    .in("id", recipientIds);

  const adminIds = new Set(
    (recipientProfiles ?? [])
      .filter((p) => p.role === "admin")
      .map((p) => p.id),
  );

  let payable = allocations.filter((a) => !adminIds.has(a.user_id));
  const payableWeight = payable.reduce((sum, a) => sum + a.weight, 0);
  if (payableWeight > 0 && pool.basePool > 0) {
    payable = payable.map((a) => ({
      ...a,
      amount: roundRewardAmount((pool.basePool * a.weight) / payableWeight),
    }));
  } else {
    payable = [];
  }

  const { error: updateError } = await supabase
    .from("purchases")
    .update({
      status: "validated",
      barcode_match: flags.barcode_match,
      store_match: flags.store_match,
      within_window: flags.within_window,
      time_to_purchase_hours: flags.time_to_purchase_hours,
      min_hop_distance_m: flags.min_hop_distance_m,
      min_hop_time_minutes: flags.min_hop_time_minutes,
      genuineness_score: genuineness.genuineness_score,
    })
    .eq("id", purchaseId);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  if (payable.length > 0) {
    const { error: rewardsError } = await supabase.from("rewards").insert(
      payable.map((a) => ({
        purchase_id: purchaseId,
        user_id: a.user_id,
        role: a.role,
        amount: a.amount,
        ...(options?.isDemo ? { is_demo: true } : {}),
      })),
    );

    if (rewardsError) {
      return { ok: false, error: rewardsError.message };
    }
  }

  return {
    ok: true,
    result: {
      flags,
      genuineness,
      basePool: pool.basePool,
      scoredPool: pool.scoredPool,
      usedZeroScoreFloor: pool.usedZeroScoreFloor,
      payable,
      amount,
      offerPct,
    },
  };
}
