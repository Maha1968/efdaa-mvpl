"use server";

import { createClient } from "@/lib/supabase/server";

export type ReferralEventType =
  | "opened"
  | "claimed"
  | "shared"
  | "redeemed"
  | "rewarded";

/** Best-effort event log — ignores failures if the Stage 7A table is not installed yet. */
export async function logReferralEvent(input: {
  tokenId: string;
  eventType: ReferralEventType;
  actorUserId?: string | null;
  meta?: Record<string, unknown>;
}) {
  try {
    const supabase = await createClient();
    await supabase.from("referral_events").insert({
      token_id: input.tokenId,
      event_type: input.eventType,
      actor_user_id: input.actorUserId ?? null,
      meta: input.meta ?? null,
    });
  } catch {
    // Table may not exist yet — analytics still work from tokens/purchases.
  }
}
