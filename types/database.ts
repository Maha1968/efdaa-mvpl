/**
 * Database types — mirror the Supabase tables defined in supabase/schema.sql (from SPEC.md).
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
  phone: string | null;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  barcode: string;
}

export interface Offer {
  id: string;
  name: string;
  base_reward_pct: number;
}

export interface Store {
  id: string;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
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
  scanned_barcode: string | null;
  product_photo_url: string | null;
  barcode_photo_url: string | null;
  claim_lat: number | null;
  claim_lng: number | null;
  claim_location_text: string | null;
  expires_at: string;
  created_at: string;
}

export interface Purchase {
  id: string;
  token_id: string;
  buyer_user_id: string;
  store_id: string | null;
  purchase_lat: number | null;
  purchase_lng: number | null;
  amount: number;
  receipt_image_url: string | null;
  receipt_barcode: string | null;
  status: PurchaseStatus;
  barcode_match: boolean | null;
  store_match: boolean | null;
  within_window: boolean | null;
  time_to_purchase_hours: number | null;
  min_hop_distance_m: number | null;
  min_hop_time_minutes: number | null;
  genuineness_score: number | null;
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
