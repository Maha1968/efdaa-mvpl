"use server";

import { createClient } from "@/lib/supabase/server";
import { TOKEN_VALIDITY_HOURS } from "@/config/rewards";
import type { StoreResolution } from "@/config/categories";
import { generateTokenCode } from "@/lib/utils/token-code";
import { logReferralEvent } from "@/lib/actions/events";
import { isAdminUser } from "@/lib/auth/admin";
import { redirect } from "next/navigation";

export type CreateTokenInput = {
  /** 1–5 product/range photo public URLs */
  photoUrls: string[];
  /** Optional barcode number (never required). */
  scannedBarcode?: string;
  /** Optional barcode photo URL. */
  barcodePhotoUrl?: string;
  /** Optional store signage photo URL. */
  storeSignagePhotoUrl?: string;
  category: string;
  claimLat: number;
  claimLng: number;
  claimLocationText?: string;
  /** Partner store id when user picked one from list/suggestions. */
  originatorStoreId?: string;
  /** Free-text store when none matched. */
  storeNameText?: string;
  storeResolution: StoreResolution;
  offerId: string;
  /** Optional catalog product link (legacy / demo). */
  productId?: string;
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

  if (!input.photoUrls.length || input.photoUrls.length > 5) {
    return { error: "Please add between 1 and 5 photos." };
  }

  if (!input.category.trim()) {
    return { error: "Please choose a category." };
  }

  if (!input.originatorStoreId && !input.storeNameText?.trim()) {
    return { error: "Please pick or enter the store you are recommending from." };
  }

  const expiresAt = new Date(
    Date.now() + TOKEN_VALIDITY_HOURS * 60 * 60 * 1000,
  ).toISOString();

  const barcode = input.scannedBarcode?.trim() || null;
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
        product_id: input.productId || null,
        offer_id: input.offerId,
        scanned_barcode: barcode,
        product_photo_url: input.photoUrls[0] ?? null,
        barcode_photo_url: input.barcodePhotoUrl || null,
        store_signage_photo_url: input.storeSignagePhotoUrl || null,
        claim_lat: input.claimLat,
        claim_lng: input.claimLng,
        claim_location_text: input.claimLocationText || null,
        originator_store_id: input.originatorStoreId || null,
        category: input.category.trim(),
        store_name_text: input.storeNameText?.trim() || null,
        store_resolution: input.storeResolution,
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

    const photoRows = input.photoUrls.map((url, i) => ({
      token_id: token.id,
      url,
      sort_order: i,
    }));

    const { error: photosError } = await supabase
      .from("token_photos")
      .insert(photoRows);

    if (photosError) {
      // Column/table missing until schema_stage7j.sql is run — still keep token.
      console.error("token_photos insert:", photosError.message);
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
        store_signage_photo_url: parent.store_signage_photo_url,
        claim_lat: input.claimLat,
        claim_lng: input.claimLng,
        claim_location_text: input.claimLocationText || null,
        originator_store_id: parent.originator_store_id,
        category: parent.category,
        store_name_text: parent.store_name_text,
        store_resolution: parent.store_resolution,
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

    const { data: parentPhotos } = await supabase
      .from("token_photos")
      .select("url, sort_order")
      .eq("token_id", parent.id)
      .order("sort_order");

    if (parentPhotos?.length) {
      await supabase.from("token_photos").insert(
        parentPhotos.map((p) => ({
          token_id: child.id,
          url: p.url,
          sort_order: p.sort_order,
        })),
      );
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
