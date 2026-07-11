"use server";

import { createClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/lib/auth/admin";
import { computePurchaseSignalFlags } from "@/lib/purchases/validation";
import { computeGenuinenessScore } from "@/lib/purchases/genuineness";
import { computeRewardSplit } from "@/lib/purchases/rewards";
import { buildTokenChain } from "@/lib/purchases/chain";
import { hasTokenBeenRedeemed } from "@/lib/tokens/redemption";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Token } from "@/types/database";

export type CreatePurchaseInput = {
  tokenCode: string;
  storeId: string;
  amount: number;
  receiptBarcode: string;
  receiptImageUrl: string;
  purchaseLat: number;
  purchaseLng: number;
};

export async function createPurchase(input: CreatePurchaseInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in to submit a purchase." };
  }

  const { data: token, error: tokenError } = await supabase
    .from("tokens")
    .select("*")
    .eq("code", input.tokenCode)
    .single();

  if (tokenError || !token) {
    return { error: "Token not found." };
  }

  if (new Date(token.expires_at).getTime() <= Date.now()) {
    return { error: "This offer has expired." };
  }

  if (await hasTokenBeenRedeemed(supabase, token.id)) {
    return { error: "This token has already been redeemed." };
  }

  const { data: rootToken } = await supabase
    .from("tokens")
    .select("created_at")
    .eq("id", token.root_token_id ?? token.id)
    .single();

  const originTime = rootToken?.created_at ?? token.created_at;
  const timeToPurchaseHours = Number(
    ((Date.now() - new Date(originTime).getTime()) / 3_600_000).toFixed(2),
  );

  const { data: purchase, error: insertError } = await supabase
    .from("purchases")
    .insert({
      token_id: token.id,
      buyer_user_id: user.id,
      store_id: input.storeId,
      purchase_lat: input.purchaseLat,
      purchase_lng: input.purchaseLng,
      amount: input.amount,
      receipt_image_url: input.receiptImageUrl,
      receipt_barcode: input.receiptBarcode.trim(),
      status: "pending",
      time_to_purchase_hours: timeToPurchaseHours,
      genuineness_score: 1.0,
    })
    .select("id")
    .single();

  if (insertError) {
    return { error: insertError.message };
  }

  revalidatePath(`/t/${input.tokenCode}`);
  revalidatePath(`/redeem/${input.tokenCode}`);

  redirect(`/redeem/${input.tokenCode}/submitted?id=${purchase.id}`);
}

export async function validatePurchase(purchaseId: string) {
  if (!(await isAdminUser())) {
    return { error: "Not authorized." };
  }

  const supabase = await createClient();

  const { data: purchase, error: purchaseError } = await supabase
    .from("purchases")
    .select("*")
    .eq("id", purchaseId)
    .single();

  if (purchaseError || !purchase) {
    return { error: "Purchase not found." };
  }

  if (purchase.status !== "pending") {
    return { error: "Purchase is not pending." };
  }

  const { data: token, error: tokenError } = await supabase
    .from("tokens")
    .select("*")
    .eq("id", purchase.token_id)
    .single();

  if (tokenError || !token) {
    return { error: "Token not found." };
  }

  const [{ data: product }, { data: store }, { data: offer }] =
    await Promise.all([
      supabase.from("products").select("*").eq("id", token.product_id).single(),
      purchase.store_id
        ? supabase.from("stores").select("*").eq("id", purchase.store_id).single()
        : Promise.resolve({ data: null }),
      supabase.from("offers").select("*").eq("id", token.offer_id).single(),
    ]);

  if (!product) {
    return { error: "Product not found." };
  }

  if (!offer) {
    return { error: "Offer not found." };
  }

  const fetchParentToken = async (parentId: string) => {
    const { data } = await supabase
      .from("tokens")
      .select("*")
      .eq("id", parentId)
      .single();
    return data as Token | null;
  };

  const flags = await computePurchaseSignalFlags({
    purchase,
    token,
    product,
    store: store ?? null,
    fetchParentToken,
  });

  const chain = await buildTokenChain(token, fetchParentToken);

  const genuineness = computeGenuinenessScore(flags, chain, purchase);

  const amount = Number(purchase.amount);
  const basePool = Number(
    (
      amount *
      Number(offer.base_reward_pct) *
      genuineness.genuineness_score
    ).toFixed(2),
  );

  const allocations = computeRewardSplit({
    chain,
    buyerUserId: purchase.buyer_user_id,
    basePool,
  });

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
    return { error: updateError.message };
  }

  // Only write rewards for a validated purchase (SPEC). Skip zero-pool edge case inserts of all zeros.
  if (allocations.length > 0) {
    const { error: rewardsError } = await supabase.from("rewards").insert(
      allocations.map((a) => ({
        purchase_id: purchaseId,
        user_id: a.user_id,
        role: a.role,
        amount: a.amount,
      })),
    );

    if (rewardsError) {
      return { error: rewardsError.message };
    }
  }

  revalidatePath("/admin/purchases");
  revalidatePath(`/admin/purchases/${purchaseId}`);
  redirect(`/admin/purchases/${purchaseId}`);
}

export async function rejectPurchase(purchaseId: string) {
  if (!(await isAdminUser())) {
    return { error: "Not authorized." };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("purchases")
    .update({ status: "rejected" })
    .eq("id", purchaseId)
    .eq("status", "pending");

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/purchases");
  return { success: true };
}
