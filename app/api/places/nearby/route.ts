import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  autoMatchVisibleName,
  fetchNearbyPlaces,
} from "@/lib/places/nearby";

export const runtime = "nodejs";

type Body = {
  lat?: number;
  lng?: number;
  category?: string;
  visibleStoreName?: string | null;
};

/**
 * POST JSON: { lat, lng, category, visibleStoreName? }
 * Returns nearby Places + optional autoMatch. Soft-fails when key missing.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({
      ok: false,
      places: [],
      autoMatch: null,
      error: "bad_json",
    });
  }

  const lat = Number(body.lat);
  const lng = Number(body.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({
      ok: false,
      places: [],
      autoMatch: null,
      error: "bad_coords",
    });
  }

  const { data: partners } = await supabase
    .from("stores")
    .select("id, name, address, lat, lng");

  const nearby = await fetchNearbyPlaces({
    lat,
    lng,
    category: body.category?.trim() || "Other",
    partners: partners ?? [],
  });

  const autoMatch = autoMatchVisibleName(
    body.visibleStoreName,
    nearby.places,
  );

  return NextResponse.json({
    ok: nearby.ok,
    places: nearby.places,
    autoMatch,
    error: nearby.error,
  });
}
