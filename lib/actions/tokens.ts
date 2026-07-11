"use server";

import { createClient } from "@/lib/supabase/server";
import { TOKEN_VALIDITY_HOURS } from "@/config/rewards";
import { generateTokenCode } from "@/lib/utils/token-code";
import { logReferralEvent } from "@/lib/actions/events";
import { isAdminUser } from "@/lib/auth/admin";
import { redirect } from "next/navigation";

export type CreateTokenInput = {
  productId: string;
  offerId: string;
  scannedBarcode: string;
  productPhotoUrl: string;
  barcodePhotoUrl: string;
  claimLat: number;
  claimLng: number;
  claimLocationText?: string;
};

export type ForwardTokenInput = {
  parentCode: string;
  claimLat: number;
  claimLng: number;
  claimLocationText?: string;
};

export async function createOriginatorToken(input: CreateTokenInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in to create a token." };
  }

  if (await isAdminUser()) {
    return { error: "Administrators cannot create or recommend tokens." };
  }

  const expiresAt = new Date(
    Date.now() + TOKEN_VALIDITY_HOURS * 60 * 60 * 1000,
  ).toISOString();

  let code = generateTokenCode();
  let attempts = 0;

  while (attempts < 5) {
    const { data: token, error: insertError } = await supabase
      .from("tokens")
      .insert({
        code,
        holder_user_id: user.id,
        parent_token_id: null,
        root_token_id: null,
        depth: 0,
        product_id: input.productId,
        offer_id: input.offerId,
        scanned_barcode: input.scannedBarcode,
        product_photo_url: input.productPhotoUrl,
        barcode_photo_url: input.barcodePhotoUrl,
        claim_lat: input.claimLat,
        claim_lng: input.claimLng,
        claim_location_text: input.claimLocationText || null,
        expires_at: expiresAt,
      })
      .select("id")
      .single();

    if (insertError) {
      if (insertError.code === "23505") {
        code = generateTokenCode();
        attempts++;
        continue;
      }
      return { error: insertError.message };
    }

    const { error: updateError } = await supabase
      .from("tokens")
      .update({ root_token_id: token.id })
      .eq("id", token.id);

    if (updateError) {
      return { error: updateError.message };
    }

    redirect(`/create/${code}`);
  }

  return { error: "Could not generate a unique token code. Please try again." };
}

export async function forwardToken(input: ForwardTokenInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in to forward a token." };
  }

  if (await isAdminUser()) {
    return { error: "Administrators cannot share or claim tokens." };
  }

  const { data: parent, error: parentError } = await supabase
    .from("tokens")
    .select("*")
    .eq("code", input.parentCode)
    .single();

  if (parentError || !parent) {
    return { error: "Token not found." };
  }

  if (new Date(parent.expires_at).getTime() <= Date.now()) {
    return { error: "This offer has expired." };
  }

  if (parent.depth >= 4) {
    return { error: "This chain has reached its maximum length." };
  }

  let code = generateTokenCode();
  let attempts = 0;

  while (attempts < 5) {
    const { data: child, error: insertError } = await supabase
      .from("tokens")
      .insert({
        code,
        holder_user_id: user.id,
        parent_token_id: parent.id,
        root_token_id: parent.root_token_id ?? parent.id,
        depth: parent.depth + 1,
        product_id: parent.product_id,
        offer_id: parent.offer_id,
        scanned_barcode: parent.scanned_barcode,
        product_photo_url: parent.product_photo_url,
        barcode_photo_url: parent.barcode_photo_url,
        claim_lat: input.claimLat,
        claim_lng: input.claimLng,
        claim_location_text: input.claimLocationText || null,
        expires_at: parent.expires_at,
      })
      .select("id, code")
      .single();

    if (insertError) {
      if (insertError.code === "23505") {
        code = generateTokenCode();
        attempts++;
        continue;
      }
      return { error: insertError.message };
    }

    await logReferralEvent({
      tokenId: parent.id,
      eventType: "claimed",
      actorUserId: user.id,
    });
    await logReferralEvent({
      tokenId: child.id,
      eventType: "shared",
      actorUserId: user.id,
      meta: { parent_code: parent.code },
    });

    return { code: child.code };
  }

  return { error: "Could not generate a unique token code. Please try again." };
}
