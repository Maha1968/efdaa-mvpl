import { TOKEN_CATEGORIES, type TokenCategory } from "@/config/categories";
import { VISION_TIMEOUT_MS } from "@/config/rewards";

export type VisionDetectResult = {
  category: TokenCategory | null;
  visible_store_name: string | null;
  store_name_confidence: "high" | "low" | null;
  /** True when vision ran and returned usable JSON (even if store name is null). */
  ok: boolean;
  error?: string;
};

type ImageInput = {
  mediaType: string;
  base64: string;
};

const SYSTEM = `You analyze product / store photos from a shopper. Reply ONLY with strict JSON, no markdown, no other text:
{
  "category": one of ${JSON.stringify([...TOKEN_CATEGORIES])},
  "visible_store_name": string or null,
  "store_name_confidence": "high" | "low"
}
Rules for visible_store_name: it must be a RETAILER/STORE name clearly readable in the photos (signage, storefront, shelf branding, receipt header, carry bag). A brand printed on the product itself may or may not be the store — if the name could just be the product's brand, still return it but with confidence "low". Only return "high" when it clearly looks like the store the person is standing in (e.g. storefront signage). If nothing readable, use null and "low".`;

function stripJsonFences(text: string) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  return (fenced?.[1] ?? trimmed).trim();
}

function parseVisionJson(raw: string): Omit<VisionDetectResult, "ok"> | null {
  try {
    const parsed = JSON.parse(stripJsonFences(raw)) as {
      category?: string;
      visible_store_name?: string | null;
      store_name_confidence?: string;
    };
    const cat = parsed.category?.trim() ?? "";
    const category = TOKEN_CATEGORIES.includes(cat as TokenCategory)
      ? (cat as TokenCategory)
      : null;
    const visible =
      typeof parsed.visible_store_name === "string" &&
      parsed.visible_store_name.trim()
        ? parsed.visible_store_name.trim()
        : null;
    const conf =
      parsed.store_name_confidence === "high" ||
      parsed.store_name_confidence === "low"
        ? parsed.store_name_confidence
        : null;
    return {
      category,
      visible_store_name: visible,
      store_name_confidence: conf,
    };
  } catch {
    return null;
  }
}

/**
 * One Anthropic vision call for category + any visible store name.
 * Soft-fails (ok: false) when key missing, timeout, or bad JSON — never throws for callers.
 */
export async function detectFromPhotos(
  images: ImageInput[],
): Promise<VisionDetectResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      category: null,
      visible_store_name: null,
      store_name_confidence: null,
      ok: false,
      error: "missing_key",
    };
  }
  if (!images.length) {
    return {
      category: null,
      visible_store_name: null,
      store_name_confidence: null,
      ok: false,
      error: "no_images",
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), VISION_TIMEOUT_MS);

  try {
    const content: Array<
      | { type: "text"; text: string }
      | {
          type: "image";
          source: {
            type: "base64";
            media_type: string;
            data: string;
          };
        }
    > = [
      {
        type: "text",
        text: "Detect category and any visible retailer/store name from these photos.",
      },
    ];

    for (const img of images.slice(0, 5)) {
      const media =
        img.mediaType === "image/png" ||
        img.mediaType === "image/gif" ||
        img.mediaType === "image/webp"
          ? img.mediaType
          : "image/jpeg";
      content.push({
        type: "image",
        source: {
          type: "base64",
          media_type: media,
          data: img.base64,
        },
      });
    }

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 256,
        system: SYSTEM,
        messages: [{ role: "user", content }],
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        category: null,
        visible_store_name: null,
        store_name_confidence: null,
        ok: false,
        error: `anthropic_${res.status}:${body.slice(0, 120)}`,
      };
    }

    const data = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const text = data.content?.find((c) => c.type === "text")?.text ?? "";
    const parsed = parseVisionJson(text);
    if (!parsed) {
      return {
        category: null,
        visible_store_name: null,
        store_name_confidence: null,
        ok: false,
        error: "parse_failed",
      };
    }
    return { ...parsed, ok: true };
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    return {
      category: null,
      visible_store_name: null,
      store_name_confidence: null,
      ok: false,
      error: aborted ? "timeout" : "request_failed",
    };
  } finally {
    clearTimeout(timer);
  }
}
