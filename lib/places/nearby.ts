import {
  STORE_MATCH_MAX_DISTANCE_M,
  STORE_SUGGEST_MAX_RESULTS,
  STORE_SUGGEST_RADIUS_M,
} from "@/config/rewards";
import { placeTypesForCategory } from "@/config/categories";
import { haversineMeters } from "@/lib/geo/haversine";
import { storeNamesMatch } from "@/lib/places/name-match";
import type {
  NearbyPlaceSuggestion,
  PartnerStoreInput,
} from "@/lib/places/types";

export type { NearbyPlaceSuggestion, PartnerStoreInput };

type GoogleNearbyResult = {
  place_id: string;
  name: string;
  vicinity?: string;
  geometry?: { location?: { lat: number; lng: number } };
};

async function fetchNearbyByType(
  lat: number,
  lng: number,
  type: string,
  apiKey: string,
): Promise<GoogleNearbyResult[]> {
  const url = new URL(
    "https://maps.googleapis.com/maps/api/place/nearbysearch/json",
  );
  url.searchParams.set("location", `${lat},${lng}`);
  url.searchParams.set("radius", String(STORE_SUGGEST_RADIUS_M));
  url.searchParams.set("type", type);
  url.searchParams.set("key", apiKey);

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) return [];
  const data = (await res.json()) as {
    status: string;
    results?: GoogleNearbyResult[];
  };
  if (data.status !== "OK" && data.status !== "ZERO_RESULTS") return [];
  return data.results ?? [];
}

function matchPartner(
  place: { name: string; lat: number; lng: number },
  partners: PartnerStoreInput[],
): string | null {
  for (const p of partners) {
    if (storeNamesMatch(place.name, p.name)) return p.id;
    if (
      p.lat != null &&
      p.lng != null &&
      haversineMeters(place.lat, place.lng, p.lat, p.lng) <=
        STORE_MATCH_MAX_DISTANCE_M
    ) {
      return p.id;
    }
  }
  return null;
}

/**
 * Nearby Search (server). Soft-fails to [] when key missing or API errors.
 */
export async function fetchNearbyPlaces(input: {
  lat: number;
  lng: number;
  category: string;
  partners: PartnerStoreInput[];
}): Promise<{
  places: NearbyPlaceSuggestion[];
  ok: boolean;
  error?: string;
}> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return { places: [], ok: false, error: "missing_key" };
  }

  try {
    const types = placeTypesForCategory(input.category);
    const batches = await Promise.all(
      types.map((t) => fetchNearbyByType(input.lat, input.lng, t, apiKey)),
    );

    const byId = new Map<string, GoogleNearbyResult>();
    for (const batch of batches) {
      for (const r of batch) {
        if (r.place_id && !byId.has(r.place_id)) byId.set(r.place_id, r);
      }
    }

    const places: NearbyPlaceSuggestion[] = [];
    for (const r of byId.values()) {
      const plat = r.geometry?.location?.lat;
      const plng = r.geometry?.location?.lng;
      if (plat == null || plng == null || !r.name) continue;
      const distanceM = Math.round(
        haversineMeters(input.lat, input.lng, plat, plng),
      );
      if (distanceM > STORE_SUGGEST_RADIUS_M) continue;
      places.push({
        placeId: r.place_id,
        name: r.name,
        address: r.vicinity ?? null,
        lat: plat,
        lng: plng,
        distanceM,
        partnerStoreId: matchPartner(
          { name: r.name, lat: plat, lng: plng },
          input.partners,
        ),
      });
    }

    places.sort((a, b) => a.distanceM - b.distanceM);

    return {
      places: places.slice(0, STORE_SUGGEST_MAX_RESULTS),
      ok: true,
    };
  } catch {
    return { places: [], ok: false, error: "request_failed" };
  }
}

/** Find best Places hit for a photo-detected store name. */
export function autoMatchVisibleName(
  visibleStoreName: string | null | undefined,
  places: NearbyPlaceSuggestion[],
): NearbyPlaceSuggestion | null {
  if (!visibleStoreName?.trim() || !places.length) return null;
  for (const p of places) {
    if (storeNamesMatch(visibleStoreName, p.name)) return p;
  }
  return null;
}
