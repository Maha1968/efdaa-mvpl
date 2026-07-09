import type { SupabaseClient } from "@supabase/supabase-js";

/** True if this token already has a pending or validated purchase (redeem once). */
export async function hasTokenBeenRedeemed(
  supabase: SupabaseClient,
  tokenId: string,
) {
  const { count, error } = await supabase
    .from("purchases")
    .select("id", { count: "exact", head: true })
    .eq("token_id", tokenId)
    .in("status", ["pending", "validated"]);

  if (error) return false;
  return (count ?? 0) > 0;
}
