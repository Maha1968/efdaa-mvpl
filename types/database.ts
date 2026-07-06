/**
 * Database types — will be aligned with Supabase tables from SPEC.md.
 * Regenerate from Supabase CLI in a later stage when tables exist.
 */

export type PurchaseStatus = "pending" | "validated" | "rejected";

export type RewardRole =
  | "originator"
  | "forwarder"
  | "last_referrer"
  | "buyer";

export interface User {
  id: string;
  name: string;
  phone: string;
  created_at: string;
}

export interface Token {
  id: string;
  code: string;
  holder_user_id: string;
  parent_token_id: string | null;
  root_token_id: string;
  depth: number;
  product_id: string;
  offer_id: string;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  price: number;
}

export interface Offer {
  id: string;
  name: string;
  base_reward_pct: number;
}

export interface Store {
  id: string;
  name: string;
  location: string;
}

export interface Purchase {
  id: string;
  token_id: string;
  buyer_user_id: string;
  store_id: string;
  amount: number;
  bill_image_url: string;
  status: PurchaseStatus;
  genuineness_score: number;
  created_at: string;
}

export interface Reward {
  id: string;
  purchase_id: string;
  user_id: string;
  role: RewardRole;
  amount: number;
  created_at: string;
}
