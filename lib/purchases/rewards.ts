import type { RewardRole, Token } from "@/types/database";
import { ROLE_WEIGHTS } from "@/config/rewards";

export type RewardAllocation = {
  user_id: string;
  role: RewardRole;
  weight: number;
  amount: number;
};

/**
 * Assign roles for people in the influence chain and split base_pool by weights.
 * Chain is ordered originator → ... → redeemed token.
 * One row per unique person; if someone qualifies for multiple roles, keep the highest weight.
 */
export function computeRewardSplit(input: {
  chain: Token[];
  buyerUserId: string;
  basePool: number;
}): RewardAllocation[] {
  const { chain, buyerUserId, basePool } = input;

  const roleByUser = new Map<string, RewardRole>();

  const setRole = (userId: string, role: RewardRole) => {
    const existing = roleByUser.get(userId);
    if (!existing || ROLE_WEIGHTS[role] > ROLE_WEIGHTS[existing]) {
      roleByUser.set(userId, role);
    }
  };

  // Buyer always gets buyer role.
  setRole(buyerUserId, "buyer");

  if (chain.length > 0) {
    const originatorId = chain[0].holder_user_id;
    setRole(originatorId, "originator");

    // Last referrer = holder of the redeemed token, unless that is the buyer
    // (self-redeem), then use the parent holder.
    let lastReferrerId = chain[chain.length - 1].holder_user_id;
    if (lastReferrerId === buyerUserId && chain.length >= 2) {
      lastReferrerId = chain[chain.length - 2].holder_user_id;
    }
    if (lastReferrerId !== buyerUserId) {
      setRole(lastReferrerId, "last_referrer");
    }

    // Middle holders = forwarders
    for (let i = 1; i < chain.length - 1; i++) {
      const holderId = chain[i].holder_user_id;
      if (
        holderId !== buyerUserId &&
        holderId !== originatorId &&
        holderId !== lastReferrerId
      ) {
        setRole(holderId, "forwarder");
      }
    }
  }

  const entries = Array.from(roleByUser.entries()).map(([user_id, role]) => ({
    user_id,
    role,
    weight: ROLE_WEIGHTS[role],
  }));

  const weightSum = entries.reduce((sum, e) => sum + e.weight, 0);
  if (weightSum === 0 || basePool <= 0) {
    return entries.map((e) => ({ ...e, amount: 0 }));
  }

  return entries.map((e) => ({
    ...e,
    amount: Number(((basePool * e.weight) / weightSum).toFixed(2)),
  }));
}
