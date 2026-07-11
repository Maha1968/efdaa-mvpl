"use server";

import { createClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/lib/auth/admin";
import { applyPurchaseValidation } from "@/lib/purchases/apply-validation";
import { hasTokenBeenRedeemed } from "@/lib/tokens/redemption";
import { logReferralEvent } from "@/lib/actions/events";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

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

  if (await isAdminUser()) {
    return { error: "Administrators cannot redeem tokens or earn points." };
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

  await logReferralEvent({
    tokenId: token.id,
    eventType: "redeemed",
    actorUserId: user.id,
    meta: { purchase_id: purchase.id },
  });

  revalidatePath(`/t/${input.tokenCode}`);
  revalidatePath(`/redeem/${input.tokenCode}`);

  redirect(`/redeem/${input.tokenCode}/submitted?id=${purchase.id}`);
}

export async function validatePurchase(purchaseId: string) {
  if (!(await isAdminUser())) {
    return { error: "Not authorized." };
  }

  const supabase = await createClient();
  const applied = await applyPurchaseValidation(supabase, purchaseId);

  if (!applied.ok) {
    return { error: applied.error };
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
