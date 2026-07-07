"use server";

import { createClient } from "@/lib/supabase/server";
import { TOKEN_VALIDITY_HOURS } from "@/config/rewards";
import { generateTokenCode } from "@/lib/utils/token-code";
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

export async function createOriginatorToken(input: CreateTokenInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in to create a token." };
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
