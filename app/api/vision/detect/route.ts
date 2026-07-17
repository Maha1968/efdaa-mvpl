import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { detectFromPhotos } from "@/lib/vision/detect-from-photos";
import { MAX_TOKEN_PHOTOS } from "@/config/categories";

export const runtime = "nodejs";

/**
 * POST multipart: fields `photo` (1–5 files).
 * Returns vision JSON soft-fail shape — never blocks the client create flow.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({
      ok: false,
      category: null,
      visible_store_name: null,
      store_name_confidence: null,
      error: "bad_form",
    });
  }

  const files = form
    .getAll("photo")
    .filter((f): f is File => f instanceof File && f.size > 0)
    .slice(0, MAX_TOKEN_PHOTOS);

  const images: { mediaType: string; base64: string }[] = [];
  for (const file of files) {
    try {
      const buf = Buffer.from(await file.arrayBuffer());
      // Cap ~4MB raw; client also compresses — still skip absurd payloads
      if (buf.length > 4_000_000) continue;
      images.push({
        mediaType: file.type || "image/jpeg",
        base64: buf.toString("base64"),
      });
    } catch {
      // skip bad file
    }
  }

  const result = await detectFromPhotos(images);
  return NextResponse.json(result);
}
