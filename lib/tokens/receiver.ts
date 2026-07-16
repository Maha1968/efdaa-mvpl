import type { SupabaseClient } from "@supabase/supabase-js";
import type { Offer, Product, Token, TokenPhoto } from "@/types/database";

export type ReceiverPayload = {
  token: Token;
  photos: string[];
  senderFirstName: string;
  product: Pick<Product, "name" | "price" | "barcode"> | null;
  offer: Pick<Offer, "name" | "base_reward_pct"> | null;
};

export function firstNameFrom(fullName: string | null | undefined) {
  const trimmed = (fullName ?? "").trim();
  if (!trimmed) return "A friend";
  return trimmed.split(/\s+/)[0] ?? "A friend";
}

/** Load token + sender finds for the receiver screen (works with user or service client). */
export async function loadReceiverPayload(
  supabase: SupabaseClient,
  code: string,
): Promise<ReceiverPayload | null> {
  const { data: token } = await supabase
    .from("tokens")
    .select("*")
    .eq("code", code)
    .maybeSingle();

  if (!token) return null;

  const [{ data: photos }, { data: holder }, { data: product }, { data: offer }] =
    await Promise.all([
      supabase
        .from("token_photos")
        .select("url, sort_order")
        .eq("token_id", token.id)
        .order("sort_order", { ascending: true }),
      supabase
        .from("users")
        .select("name")
        .eq("id", token.holder_user_id)
        .maybeSingle(),
      token.product_id
        ? supabase
            .from("products")
            .select("name, price, barcode")
            .eq("id", token.product_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from("offers")
        .select("name, base_reward_pct")
        .eq("id", token.offer_id)
        .maybeSingle(),
    ]);

  const photoUrls =
    (photos as Pick<TokenPhoto, "url" | "sort_order">[] | null)?.map(
      (p) => p.url,
    ) ?? [];

  if (photoUrls.length === 0 && token.product_photo_url) {
    photoUrls.push(token.product_photo_url);
  }

  return {
    token: token as Token,
    photos: photoUrls,
    senderFirstName: firstNameFrom(holder?.name),
    product: product ?? null,
    offer: offer ?? null,
  };
}
