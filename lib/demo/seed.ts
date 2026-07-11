import type { SupabaseClient } from "@supabase/supabase-js";
import { TOKEN_VALIDITY_HOURS } from "@/config/rewards";
import { applyPurchaseValidation } from "@/lib/purchases/apply-validation";
import { toPublicUserId } from "@/lib/privacy/user-id";
import type { ValidationApplyResult } from "@/lib/purchases/apply-validation";

/** Demo emails — never overlap ADMIN_EMAIL. Domain is reserved for seed accounts. */
export const DEMO_EMAIL_DOMAIN = "efdaa.demo";

const PLACEHOLDER_PRODUCT =
  "https://placehold.co/800x600/png?text=Demo+Product";
const PLACEHOLDER_BARCODE =
  "https://placehold.co/800x400/png?text=Demo+Barcode";
const PLACEHOLDER_RECEIPT =
  "https://placehold.co/600x900/png?text=Demo+Receipt";

/** Bengaluru places — kilometres apart for genuine hops. */
const PLACES = [
  { lat: 12.99705, lng: 77.69645, text: "Phoenix Marketcity, Whitefield" },
  { lat: 12.93522, lng: 77.62448, text: "Koramangala 5th Block" },
  { lat: 12.97842, lng: 77.64082, text: "Indiranagar 100 Feet Road" },
  { lat: 12.9304, lng: 77.5838, text: "Jayanagar 4th Block" },
  { lat: 12.9121, lng: 77.6446, text: "HSR Layout Sector 2" },
  { lat: 12.925, lng: 77.546, text: "Banashankari" },
  { lat: 12.9698, lng: 77.75, text: "Whitefield Main Road" },
  { lat: 13.0055, lng: 77.5692, text: "Malleshwaram" },
  { lat: 12.8399, lng: 77.677, text: "Electronic City" },
  { lat: 13.0358, lng: 77.597, text: "Hebbal" },
  { lat: 12.9063, lng: 77.5857, text: "JP Nagar" },
  { lat: 13.1005, lng: 77.5963, text: "Yelahanka" },
  { lat: 12.9166, lng: 77.6101, text: "BTM Layout" },
  { lat: 12.97855, lng: 77.64095, text: "EFDAA Partner Store, Indiranagar" },
] as const;

const STORE = PLACES[PLACES.length - 1];
const PROX_A = { lat: 12.9716, lng: 77.5946, text: "Near MG Road" };
const PROX_B = { lat: 12.97169, lng: 77.5946, text: "Near MG Road (~10m away)" };

type Place = { lat: number; lng: number; text: string };

const PRODUCTS = [
  { key: "tea", name: "Demo Himalayan Green Tea 500g", price: 2499, barcode: "890100DEMO0001" },
  { key: "coffee", name: "Demo Coorg Filter Coffee 250g", price: 899, barcode: "890100DEMO0002" },
  { key: "honey", name: "Demo Coorg Wild Honey 500g", price: 1299, barcode: "890100DEMO0003" },
  { key: "spice", name: "Demo Garam Masala Pack 200g", price: 349, barcode: "890100DEMO0004" },
] as const;

export type ChainSeedReport = {
  label: string;
  codes: string[];
  genuinenessScore: number;
  reasons: string[];
  hops: {
    fromLabel: string;
    toLabel: string;
    distance_m: number | null;
    time_minutes: number | null;
    suspicious: boolean;
  }[];
  flags: {
    barcode_match: boolean;
    store_match: boolean;
    within_window: boolean;
  };
  amount: number;
  basePool: number;
  scoredPool: number;
  usedZeroScoreFloor: boolean;
  rewards: { role: string; userId: string; publicId: string; amount: number }[];
};

function hoursAgo(h: number) {
  return new Date(Date.now() - h * 3_600_000);
}

function minutesAfter(base: Date, minutes: number) {
  return new Date(base.getTime() + minutes * 60_000);
}

function hoursAfter(base: Date, hours: number) {
  return new Date(base.getTime() + hours * 3_600_000);
}

function placeAt(index: number): Place {
  return PLACES[index % (PLACES.length - 1)]; // avoid always picking store
}

function person(key: string) {
  return {
    key,
    email: `demo.${key.toLowerCase()}@${DEMO_EMAIL_DOMAIN}`,
    name: `Demo ${key}`,
  };
}

async function ensureDemoCustomer(
  admin: SupabaseClient,
  key: string,
): Promise<string> {
  const p = person(key);
  const password = `Demo-${key}-Seed-9x!`;

  const { data: listed } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const existing = listed?.users?.find(
    (u) => u.email?.toLowerCase() === p.email.toLowerCase(),
  );

  let userId = existing?.id;

  if (!userId) {
    const { data, error } = await admin.auth.admin.createUser({
      email: p.email,
      password,
      email_confirm: true,
      user_metadata: { name: p.name },
    });
    if (error || !data.user) {
      throw new Error(`Failed to create ${p.email}: ${error?.message}`);
    }
    userId = data.user.id;
  }

  const { data: row } = await admin
    .from("users")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (row?.role === "admin") {
    throw new Error(`Refusing to use ${p.email}: already an administrator.`);
  }

  const { error: upsertError } = await admin.from("users").upsert(
    {
      id: userId,
      name: p.name,
      phone: null,
      role: "customer",
      is_demo: true,
    },
    { onConflict: "id" },
  );

  if (upsertError) {
    const { error: patchError } = await admin
      .from("users")
      .update({ name: p.name, is_demo: true, role: "customer" })
      .eq("id", userId)
      .neq("role", "admin");
    if (patchError) {
      throw new Error(`Failed to tag demo user ${p.email}: ${patchError.message}`);
    }
  }

  return userId;
}

async function insertEvent(
  admin: SupabaseClient,
  tokenId: string,
  eventType: string,
  actorUserId: string,
  at: Date,
) {
  await admin.from("referral_events").insert({
    token_id: tokenId,
    event_type: eventType,
    actor_user_id: actorUserId,
    created_at: at.toISOString(),
    is_demo: true,
  });
}

type TokenRow = {
  id: string;
  code: string;
  holder_user_id: string;
  depth: number;
  expires_at: string;
};

async function createTokenNode(input: {
  admin: SupabaseClient;
  code: string;
  holderUserId: string;
  parent: TokenRow | null;
  rootId: string | null;
  depth: number;
  productId: string;
  offerId: string;
  barcode: string;
  place: Place;
  at: Date;
  expiresAt: Date;
  shared?: boolean;
}): Promise<TokenRow> {
  const { admin } = input;
  const { data, error } = await admin
    .from("tokens")
    .insert({
      code: input.code,
      holder_user_id: input.holderUserId,
      parent_token_id: input.parent?.id ?? null,
      root_token_id: input.rootId,
      depth: input.depth,
      product_id: input.productId,
      offer_id: input.offerId,
      scanned_barcode: input.barcode,
      product_photo_url: PLACEHOLDER_PRODUCT,
      barcode_photo_url: PLACEHOLDER_BARCODE,
      claim_lat: input.place.lat,
      claim_lng: input.place.lng,
      claim_location_text: input.place.text,
      expires_at: input.expiresAt.toISOString(),
      created_at: input.at.toISOString(),
      is_demo: true,
    })
    .select("id, code, holder_user_id, depth, expires_at")
    .single();

  if (error || !data) {
    throw new Error(`Token ${input.code}: ${error?.message}`);
  }

  if (!input.rootId) {
    await admin.from("tokens").update({ root_token_id: data.id }).eq("id", data.id);
  }

  await insertEvent(admin, data.id, "claimed", input.holderUserId, input.at);
  if (input.depth > 0) {
    await insertEvent(admin, data.id, "opened", input.holderUserId, input.at);
  }
  if (input.shared) {
    await insertEvent(
      admin,
      data.id,
      "shared",
      input.holderUserId,
      minutesAfter(input.at, 5),
    );
  }

  return data as TokenRow;
}

function reportFromValidation(
  label: string,
  codes: string[],
  result: ValidationApplyResult,
): ChainSeedReport {
  return {
    label,
    codes,
    genuinenessScore: result.genuineness.genuineness_score,
    reasons: result.genuineness.reasons,
    hops: result.genuineness.hops.map((h) => ({
      fromLabel: h.fromLabel,
      toLabel: h.toLabel,
      distance_m: h.distance_m,
      time_minutes: h.time_minutes,
      suspicious: h.suspicious,
    })),
    flags: {
      barcode_match: result.flags.barcode_match,
      store_match: result.flags.store_match,
      within_window: result.flags.within_window,
    },
    amount: result.amount,
    basePool: result.basePool,
    scoredPool: result.scoredPool,
    usedZeroScoreFloor: result.usedZeroScoreFloor,
    rewards: result.payable.map((p) => ({
      role: p.role,
      userId: p.user_id,
      publicId: toPublicUserId(p.user_id),
      amount: p.amount,
    })),
  };
}

async function validateLeafPurchase(input: {
  admin: SupabaseClient;
  label: string;
  leaf: TokenRow;
  storeId: string;
  barcode: string;
  amount: number;
  at: Date;
  codes: string[];
}): Promise<ChainSeedReport> {
  const { admin, leaf } = input;
  const { data: purchase, error } = await admin
    .from("purchases")
    .insert({
      token_id: leaf.id,
      buyer_user_id: leaf.holder_user_id,
      store_id: input.storeId,
      purchase_lat: STORE.lat,
      purchase_lng: STORE.lng,
      amount: input.amount,
      receipt_image_url: PLACEHOLDER_RECEIPT,
      receipt_barcode: input.barcode,
      status: "pending",
      created_at: input.at.toISOString(),
      is_demo: true,
    })
    .select("id")
    .single();

  if (error || !purchase) {
    throw new Error(`${input.label} purchase: ${error?.message}`);
  }

  await insertEvent(admin, leaf.id, "redeemed", leaf.holder_user_id, input.at);

  const applied = await applyPurchaseValidation(admin, purchase.id, {
    isDemo: true,
  });
  if (!applied.ok) {
    throw new Error(`${input.label} validate: ${applied.error}`);
  }

  return reportFromValidation(input.label, input.codes, applied.result);
}

/**
 * Wipe only is_demo rows. Never deletes non-demo data or admin accounts.
 */
export async function resetDemoData(admin: SupabaseClient) {
  await admin.from("rewards").delete().eq("is_demo", true);
  await admin.from("purchases").delete().eq("is_demo", true);
  await admin.from("referral_events").delete().eq("is_demo", true);

  for (const depth of [4, 3, 2, 1, 0]) {
    await admin.from("tokens").delete().eq("is_demo", true).eq("depth", depth);
  }
  await admin.from("tokens").delete().eq("is_demo", true);

  await admin.from("products").delete().eq("is_demo", true);
  await admin.from("offers").delete().eq("is_demo", true);
  await admin.from("stores").delete().eq("is_demo", true);

  const { data: demoUsers } = await admin
    .from("users")
    .select("id, role")
    .eq("is_demo", true);

  for (const u of demoUsers ?? []) {
    if (u.role === "admin") continue;
    await admin.auth.admin.deleteUser(u.id);
  }

  await admin.from("users").delete().eq("is_demo", true).neq("role", "admin");

  const { data: listed } = await admin.auth.admin.listUsers({ perPage: 1000 });
  for (const u of listed?.users ?? []) {
    if (u.email?.toLowerCase().endsWith(`@${DEMO_EMAIL_DOMAIN}`)) {
      await admin.auth.admin.deleteUser(u.id);
    }
  }
}

/**
 * Branching demo trees — children multiply under each parent.
 *
 * Tree 1 (tea) root DEMOT1A:
 *   A → B1, B2, B3
 *   B1 → B1C1, B1C2
 *   B2 → B2C1, B2C2, B2C3
 *        B2C2 → B2C2D1, B2C2D2
 *   B3 → B3C1, B3C2
 *
 * Tree 2 (coffee) root DEMOT2A — similar fan-out
 * Tree 3 (spice)  root DEMOT3A — smaller branch + depth
 * Plus one proximity pair and one expired branch for scoring contrast.
 */
export async function loadDemoData(admin: SupabaseClient): Promise<{
  reports: ChainSeedReport[];
  assistCodes: string[];
}> {
  await resetDemoData(admin);

  const ids = new Map<string, string>();
  const need = async (key: string) => {
    if (!ids.has(key)) ids.set(key, await ensureDemoCustomer(admin, key));
    return ids.get(key)!;
  };

  const productByKey: Record<string, { id: string; barcode: string; price: number }> =
    {};
  for (const p of PRODUCTS) {
    const { data, error } = await admin
      .from("products")
      .insert({
        name: p.name,
        price: p.price,
        barcode: p.barcode,
        is_demo: true,
      })
      .select("*")
      .single();
    if (error || !data) throw new Error(`Product ${p.key}: ${error?.message}`);
    productByKey[p.key] = {
      id: data.id,
      barcode: data.barcode,
      price: Number(data.price),
    };
  }

  const { data: offer, error: offerError } = await admin
    .from("offers")
    .insert({
      name: "Demo 5% Referral Offer",
      base_reward_pct: 0.05,
      is_demo: true,
    })
    .select("*")
    .single();
  if (offerError || !offer) throw new Error(offerError?.message ?? "offer");

  const { data: store, error: storeError } = await admin
    .from("stores")
    .insert({
      name: "EFDAA Partner Store Indiranagar",
      address: `${STORE.text}, Bengaluru`,
      lat: STORE.lat,
      lng: STORE.lng,
      is_demo: true,
    })
    .select("*")
    .single();
  if (storeError || !store) throw new Error(storeError?.message ?? "store");

  const reports: ChainSeedReport[] = [];
  const assistCodes: string[] = [];
  let placeIdx = 0;
  const nextPlace = () => placeAt(placeIdx++);

  // ========== TREE 1 — Green Tea (wide branching) ==========
  {
    const product = productByKey.tea;
    const t0 = hoursAgo(20);
    const expiresAt = hoursAfter(t0, TOKEN_VALIDITY_HOURS);

    const A = await createTokenNode({
      admin,
      code: "DEMOT1A",
      holderUserId: await need("t1a"),
      parent: null,
      rootId: null,
      depth: 0,
      productId: product.id,
      offerId: offer.id,
      barcode: product.barcode,
      place: nextPlace(),
      at: t0,
      expiresAt,
      shared: true,
    });
    assistCodes.push(A.code);

    // A → B1, B2, B3
    const B1 = await createTokenNode({
      admin,
      code: "DEMOT1B1",
      holderUserId: await need("t1b1"),
      parent: A,
      rootId: A.id,
      depth: 1,
      productId: product.id,
      offerId: offer.id,
      barcode: product.barcode,
      place: nextPlace(),
      at: hoursAfter(t0, 2),
      expiresAt,
      shared: true,
    });
    const B2 = await createTokenNode({
      admin,
      code: "DEMOT1B2",
      holderUserId: await need("t1b2"),
      parent: A,
      rootId: A.id,
      depth: 1,
      productId: product.id,
      offerId: offer.id,
      barcode: product.barcode,
      place: nextPlace(),
      at: hoursAfter(t0, 3),
      expiresAt,
      shared: true,
    });
    const B3 = await createTokenNode({
      admin,
      code: "DEMOT1B3",
      holderUserId: await need("t1b3"),
      parent: A,
      rootId: A.id,
      depth: 1,
      productId: product.id,
      offerId: offer.id,
      barcode: product.barcode,
      place: nextPlace(),
      at: hoursAfter(t0, 4),
      expiresAt,
      shared: true,
    });
    assistCodes.push(B1.code, B2.code, B3.code);

    // B1 → B1C1, B1C2
    const B1C1 = await createTokenNode({
      admin,
      code: "DEMOT1B1C1",
      holderUserId: await need("t1b1c1"),
      parent: B1,
      rootId: A.id,
      depth: 2,
      productId: product.id,
      offerId: offer.id,
      barcode: product.barcode,
      place: nextPlace(),
      at: hoursAfter(t0, 8),
      expiresAt,
    });
    const B1C2 = await createTokenNode({
      admin,
      code: "DEMOT1B1C2",
      holderUserId: await need("t1b1c2"),
      parent: B1,
      rootId: A.id,
      depth: 2,
      productId: product.id,
      offerId: offer.id,
      barcode: product.barcode,
      place: nextPlace(),
      at: hoursAfter(t0, 9),
      expiresAt,
      shared: true,
    });
    assistCodes.push(B1C1.code, B1C2.code);

    // B2 → B2C1, B2C2, B2C3
    const B2C1 = await createTokenNode({
      admin,
      code: "DEMOT1B2C1",
      holderUserId: await need("t1b2c1"),
      parent: B2,
      rootId: A.id,
      depth: 2,
      productId: product.id,
      offerId: offer.id,
      barcode: product.barcode,
      place: nextPlace(),
      at: hoursAfter(t0, 7),
      expiresAt,
    });
    const B2C2 = await createTokenNode({
      admin,
      code: "DEMOT1B2C2",
      holderUserId: await need("t1b2c2"),
      parent: B2,
      rootId: A.id,
      depth: 2,
      productId: product.id,
      offerId: offer.id,
      barcode: product.barcode,
      place: nextPlace(),
      at: hoursAfter(t0, 10),
      expiresAt,
      shared: true,
    });
    const B2C3 = await createTokenNode({
      admin,
      code: "DEMOT1B2C3",
      holderUserId: await need("t1b2c3"),
      parent: B2,
      rootId: A.id,
      depth: 2,
      productId: product.id,
      offerId: offer.id,
      barcode: product.barcode,
      place: nextPlace(),
      at: hoursAfter(t0, 11),
      expiresAt,
    });
    assistCodes.push(B2C1.code, B2C2.code, B2C3.code);

    // B2C2 → B2C2D1, B2C2D2 (depth 3)
    const B2C2D1 = await createTokenNode({
      admin,
      code: "DEMOT1B2C2D1",
      holderUserId: await need("t1b2c2d1"),
      parent: B2C2,
      rootId: A.id,
      depth: 3,
      productId: product.id,
      offerId: offer.id,
      barcode: product.barcode,
      place: nextPlace(),
      at: hoursAfter(t0, 15),
      expiresAt,
    });
    const B2C2D2 = await createTokenNode({
      admin,
      code: "DEMOT1B2C2D2",
      holderUserId: await need("t1b2c2d2"),
      parent: B2C2,
      rootId: A.id,
      depth: 3,
      productId: product.id,
      offerId: offer.id,
      barcode: product.barcode,
      place: nextPlace(),
      at: hoursAfter(t0, 16),
      expiresAt,
      shared: true,
    });
    assistCodes.push(B2C2D1.code, B2C2D2.code);

    // B2C2D2 → one depth-4 leaf
    const B2C2D2E1 = await createTokenNode({
      admin,
      code: "DEMOT1B2C2D2E1",
      holderUserId: await need("t1b2c2d2e1"),
      parent: B2C2D2,
      rootId: A.id,
      depth: 4,
      productId: product.id,
      offerId: offer.id,
      barcode: product.barcode,
      place: nextPlace(),
      at: hoursAfter(t0, 18),
      expiresAt,
    });
    assistCodes.push(B2C2D2E1.code);

    // B3 → B3C1, B3C2
    const B3C1 = await createTokenNode({
      admin,
      code: "DEMOT1B3C1",
      holderUserId: await need("t1b3c1"),
      parent: B3,
      rootId: A.id,
      depth: 2,
      productId: product.id,
      offerId: offer.id,
      barcode: product.barcode,
      place: nextPlace(),
      at: hoursAfter(t0, 12),
      expiresAt,
    });
    const B3C2 = await createTokenNode({
      admin,
      code: "DEMOT1B3C2",
      holderUserId: await need("t1b3c2"),
      parent: B3,
      rootId: A.id,
      depth: 2,
      productId: product.id,
      offerId: offer.id,
      barcode: product.barcode,
      place: nextPlace(),
      at: hoursAfter(t0, 13),
      expiresAt,
    });
    assistCodes.push(B3C1.code, B3C2.code);

    // Redeem a few leaves so rewards/analytics light up
    reports.push(
      await validateLeafPurchase({
        admin,
        label: "Tree1 leaf B1C1 (tea)",
        leaf: B1C1,
        storeId: store.id,
        barcode: product.barcode,
        amount: product.price,
        at: minutesAfter(hoursAfter(t0, 8), 50),
        codes: [A.code, B1.code, B1C1.code],
      }),
    );
    reports.push(
      await validateLeafPurchase({
        admin,
        label: "Tree1 leaf B2C2D2E1 depth4 (tea)",
        leaf: B2C2D2E1,
        storeId: store.id,
        barcode: product.barcode,
        amount: product.price,
        at: minutesAfter(hoursAfter(t0, 18), 40),
        codes: [A.code, B2.code, B2C2.code, B2C2D2.code, B2C2D2E1.code],
      }),
    );
    reports.push(
      await validateLeafPurchase({
        admin,
        label: "Tree1 leaf B3C2 (tea)",
        leaf: B3C2,
        storeId: store.id,
        barcode: product.barcode,
        amount: product.price,
        at: minutesAfter(hoursAfter(t0, 13), 35),
        codes: [A.code, B3.code, B3C2.code],
      }),
    );
  }

  // ========== TREE 2 — Coffee (branching) ==========
  {
    const product = productByKey.coffee;
    const t0 = hoursAgo(18);
    const expiresAt = hoursAfter(t0, TOKEN_VALIDITY_HOURS);

    const A = await createTokenNode({
      admin,
      code: "DEMOT2A",
      holderUserId: await need("t2a"),
      parent: null,
      rootId: null,
      depth: 0,
      productId: product.id,
      offerId: offer.id,
      barcode: product.barcode,
      place: nextPlace(),
      at: t0,
      expiresAt,
      shared: true,
    });
    assistCodes.push(A.code);

    const Bs = [];
    for (let i = 1; i <= 3; i++) {
      const B = await createTokenNode({
        admin,
        code: `DEMOT2B${i}`,
        holderUserId: await need(`t2b${i}`),
        parent: A,
        rootId: A.id,
        depth: 1,
        productId: product.id,
        offerId: offer.id,
        barcode: product.barcode,
        place: nextPlace(),
        at: hoursAfter(t0, i + 1),
        expiresAt,
        shared: true,
      });
      Bs.push(B);
      assistCodes.push(B.code);
    }

    // B1 → 2 children; B2 → 3; B3 → 2
    const childCounts = [2, 3, 2];
    let redeemLeaf: TokenRow | null = null;
    for (let bi = 0; bi < Bs.length; bi++) {
      for (let ci = 1; ci <= childCounts[bi]; ci++) {
        const C = await createTokenNode({
          admin,
          code: `DEMOT2B${bi + 1}C${ci}`,
          holderUserId: await need(`t2b${bi + 1}c${ci}`),
          parent: Bs[bi],
          rootId: A.id,
          depth: 2,
          productId: product.id,
          offerId: offer.id,
          barcode: product.barcode,
          place: nextPlace(),
          at: hoursAfter(t0, 6 + bi * 2 + ci),
          expiresAt,
          shared: bi === 1 && ci === 2,
        });
        assistCodes.push(C.code);
        if (bi === 1 && ci === 2) {
          // B2C2 → two D children
          for (let di = 1; di <= 2; di++) {
            const D = await createTokenNode({
              admin,
              code: `DEMOT2B2C2D${di}`,
              holderUserId: await need(`t2b2c2d${di}`),
              parent: C,
              rootId: A.id,
              depth: 3,
              productId: product.id,
              offerId: offer.id,
              barcode: product.barcode,
              place: nextPlace(),
              at: hoursAfter(t0, 14 + di),
              expiresAt,
            });
            assistCodes.push(D.code);
            if (di === 1) redeemLeaf = D;
          }
        }
        if (bi === 0 && ci === 1) redeemLeaf = redeemLeaf ?? C;
      }
    }

    if (redeemLeaf) {
      reports.push(
        await validateLeafPurchase({
          admin,
          label: "Tree2 leaf (coffee)",
          leaf: redeemLeaf,
          storeId: store.id,
          barcode: product.barcode,
          amount: product.price,
          at: minutesAfter(new Date(redeemLeaf.expires_at), -120),
          codes: [A.code, redeemLeaf.code],
        }),
      );
    }
  }

  // ========== TREE 3 — Spice (medium branch) ==========
  {
    const product = productByKey.spice;
    const t0 = hoursAgo(16);
    const expiresAt = hoursAfter(t0, TOKEN_VALIDITY_HOURS);

    const A = await createTokenNode({
      admin,
      code: "DEMOT3A",
      holderUserId: await need("t3a"),
      parent: null,
      rootId: null,
      depth: 0,
      productId: product.id,
      offerId: offer.id,
      barcode: product.barcode,
      place: nextPlace(),
      at: t0,
      expiresAt,
      shared: true,
    });
    assistCodes.push(A.code);

    const B1 = await createTokenNode({
      admin,
      code: "DEMOT3B1",
      holderUserId: await need("t3b1"),
      parent: A,
      rootId: A.id,
      depth: 1,
      productId: product.id,
      offerId: offer.id,
      barcode: product.barcode,
      place: nextPlace(),
      at: hoursAfter(t0, 2),
      expiresAt,
      shared: true,
    });
    const B2 = await createTokenNode({
      admin,
      code: "DEMOT3B2",
      holderUserId: await need("t3b2"),
      parent: A,
      rootId: A.id,
      depth: 1,
      productId: product.id,
      offerId: offer.id,
      barcode: product.barcode,
      place: nextPlace(),
      at: hoursAfter(t0, 3),
      expiresAt,
      shared: true,
    });
    assistCodes.push(B1.code, B2.code);

    for (let i = 1; i <= 3; i++) {
      const C = await createTokenNode({
        admin,
        code: `DEMOT3B2C${i}`,
        holderUserId: await need(`t3b2c${i}`),
        parent: B2,
        rootId: A.id,
        depth: 2,
        productId: product.id,
        offerId: offer.id,
        barcode: product.barcode,
        place: nextPlace(),
        at: hoursAfter(t0, 6 + i),
        expiresAt,
      });
      assistCodes.push(C.code);
      if (i === 3) {
        reports.push(
          await validateLeafPurchase({
            admin,
            label: "Tree3 leaf B2C3 (spice)",
            leaf: C,
            storeId: store.id,
            barcode: product.barcode,
            amount: product.price,
            at: minutesAfter(hoursAfter(t0, 9), 30),
            codes: [A.code, B2.code, C.code],
          }),
        );
      }
    }

    const B1C1 = await createTokenNode({
      admin,
      code: "DEMOT3B1C1",
      holderUserId: await need("t3b1c1"),
      parent: B1,
      rootId: A.id,
      depth: 2,
      productId: product.id,
      offerId: offer.id,
      barcode: product.barcode,
      place: nextPlace(),
      at: hoursAfter(t0, 5),
      expiresAt,
    });
    assistCodes.push(B1C1.code);
  }

  // ========== Proximity contrast (honey) — short branch ==========
  {
    const product = productByKey.honey;
    const t0 = hoursAgo(2);
    const expiresAt = hoursAfter(t0, TOKEN_VALIDITY_HOURS);
    const A = await createTokenNode({
      admin,
      code: "DEMOPRX0",
      holderUserId: await need("prxa"),
      parent: null,
      rootId: null,
      depth: 0,
      productId: product.id,
      offerId: offer.id,
      barcode: product.barcode,
      place: PROX_A,
      at: t0,
      expiresAt,
      shared: true,
    });
    const B = await createTokenNode({
      admin,
      code: "DEMOPRX1",
      holderUserId: await need("prxb"),
      parent: A,
      rootId: A.id,
      depth: 1,
      productId: product.id,
      offerId: offer.id,
      barcode: product.barcode,
      place: PROX_B,
      at: minutesAfter(t0, 2),
      expiresAt,
    });
    assistCodes.push(A.code, B.code);
    reports.push(
      await validateLeafPurchase({
        admin,
        label: "Proximity pair (honey)",
        leaf: B,
        storeId: store.id,
        barcode: product.barcode,
        amount: product.price,
        at: minutesAfter(t0, 3),
        codes: [A.code, B.code],
      }),
    );
  }

  // ========== Expired branch (honey) ==========
  {
    const product = productByKey.honey;
    const t0 = hoursAgo(72);
    const expiresAt = hoursAfter(t0, TOKEN_VALIDITY_HOURS);
    const A = await createTokenNode({
      admin,
      code: "DEMOEXP0",
      holderUserId: await need("expa"),
      parent: null,
      rootId: null,
      depth: 0,
      productId: product.id,
      offerId: offer.id,
      barcode: product.barcode,
      place: nextPlace(),
      at: t0,
      expiresAt,
      shared: true,
    });
    const B1 = await createTokenNode({
      admin,
      code: "DEMOEXPB1",
      holderUserId: await need("expb1"),
      parent: A,
      rootId: A.id,
      depth: 1,
      productId: product.id,
      offerId: offer.id,
      barcode: product.barcode,
      place: nextPlace(),
      at: hoursAfter(t0, 3),
      expiresAt,
      shared: true,
    });
    const B2 = await createTokenNode({
      admin,
      code: "DEMOEXPB2",
      holderUserId: await need("expb2"),
      parent: A,
      rootId: A.id,
      depth: 1,
      productId: product.id,
      offerId: offer.id,
      barcode: product.barcode,
      place: nextPlace(),
      at: hoursAfter(t0, 5),
      expiresAt,
    });
    const C = await createTokenNode({
      admin,
      code: "DEMOEXPB1C1",
      holderUserId: await need("expb1c1"),
      parent: B1,
      rootId: A.id,
      depth: 2,
      productId: product.id,
      offerId: offer.id,
      barcode: product.barcode,
      place: nextPlace(),
      at: hoursAfter(t0, 12),
      expiresAt,
    });
    assistCodes.push(A.code, B1.code, B2.code, C.code);
    reports.push(
      await validateLeafPurchase({
        admin,
        label: "Expired branch leaf (honey floor)",
        leaf: C,
        storeId: store.id,
        barcode: product.barcode,
        amount: product.price,
        at: hoursAfter(t0, 30),
        codes: [A.code, B1.code, C.code],
      }),
    );
  }

  return { reports, assistCodes };
}
