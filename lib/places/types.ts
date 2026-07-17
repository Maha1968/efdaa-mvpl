export type NearbyPlaceSuggestion = {
  placeId: string;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  distanceM: number;
  /** Partner `stores.id` when this place maps to one of ours. */
  partnerStoreId: string | null;
};

export type PartnerStoreInput = {
  id: string;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
};
