import type { Token, Product, Offer } from "@/types/database";

export type TokenWithDetails = Token & {
  product: Pick<Product, "name" | "price" | "barcode"> | null;
  offer: Pick<Offer, "name" | "base_reward_pct"> | null;
  category?: string | null;
};

export function isTokenExpired(expiresAt: string) {
  return new Date(expiresAt).getTime() <= Date.now();
}

export function canForwardToken(depth: number) {
  return depth < 4;
}
