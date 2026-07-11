import type { SupabaseClient } from "@supabase/supabase-js";
import { TOKEN_VALIDITY_HOURS } from "@/config/rewards";
import { applyPurchaseValidation } from "@/lib/purchases/apply-validation";
import { toPublicUserId } from "@/lib/privacy/user-id";
import type { ValidationApplyResult } from "@/lib/purchases/apply-validation";

/** Demo emails — never overlap ADMIN_EMAIL. Domain is reserved for seed accounts. */
export const DEMO_EMAIL_DOMAIN = "efdaa.demo";

/**
 * Convenience login for the main demo originator (DEMOT1A / person key t1a).
 * Other seeded people stay on @efdaa.demo.
 */
export const DEMO_LOGIN = {
  key: "t1a",
  email: "demo_user@efdaa.com",
  password: "demo_user",
  name: "Demo User",
} as const;

const PLACEHOLDER_PRODUCT =
  "https://placehold.co/800x600/png?text=Demo+Product";
const PLACEHOLDER_BARCODE =
  "https://placehold.co/800x400/png?text=Demo+Barcode";
const PLACEHOLDER_RECEIPT =
  "https://placehold.co/600x900/png?text=Demo+Receipt";

/** Bengaluru places for claim hops — kilometres apart (not the partner store). */
const PLACES = [
  { lat: 12.99705, lng: 77.69645, text: "Phoenix Marketcity, Whitefield" },
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
  { lat: 12.9718, lng: 77.6412, text: "Domlur" },
] as const;

/**
 * Partner store where recommendations originate and purchases redeem.
 * store_match = purchase GPS within STORE_MATCH_MAX_DISTANCE_M (50m) of this store.
 */
const STORE = {
  lat: 12.93522,
  lng: 77.62448,
  text: "EFDAA Partner Store, Koramangala",
} as const;

/** Buyer claim ~8m from originator at the partner store (proximity demo). */
const PROX_BUYER = {
  lat: 12.93529,
  lng: 77.62448,
  text: "Near EFDAA Partner Store (~8m away)",
} as const;

/** Far claim place for genuine demo buyer (>1000m from Koramangala store). */
const GENUINE_BUYER_CLAIM = {
  lat: 12.9166,
  lng: 77.6101,
  text: "BTM Layout",
} as const;

type Place = { lat: number; lng: number; text: string };

const PRODUCTS = [
  { key: "tea", name: "Demo Himalayan Green Tea 500g", price: 2499, barcode: "890100DEMO0001" },
  { key: "coffee", name: "Demo Coorg Filter Coffee 250g", price: 899, barcode: "890100DEMO0002" },
  { key: "honey", name: "Demo Coorg Wild Honey 500g", price: 1299, barcode: "890100DEMO0003" },
  { key: "spice", name: "Demo Garam Masala Pack 200g", price: 349, barcode: "890100DEMO0004" },
  { key: "oil", name: "Demo Cold-Pressed Coconut Oil 1L", price: 599, barcode: "890100DEMO0005" },
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

type TokenRow = {
  id: string;
  code: string;
  holder_user_id: string;
  depth: number;
  expires_at: string;
  created_at: string;
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
  return PLACES[index % (PLACES.length - 1)];
}

/** Letter labels for depth: 0=A, 1=B, 2=C, 3=D, 4=E */
const DEPTH_LETTER = ["A", "B", "C", "D", "E"] as const;

async function ensureDemoCustomer(
  admin: SupabaseClient,
  key: string,
  emailCache: Map<string, string>,
): Promise<string> {
  const isPrimaryLogin = key.toLowerCase() === DEMO_LOGIN.key;
  const email = isPrimaryLogin
    ? DEMO_LOGIN.email
    : `demo.${key.toLowerCase()}@${DEMO_EMAIL_DOMAIN}`;
  const name = isPrimaryLogin ? DEMO_LOGIN.name : `Demo ${key}`;
  const password = isPrimaryLogin
    ? DEMO_LOGIN.password
    : `Demo-${key}-Seed-9x!`;

  const cached = emailCache.get(email.toLowerCase());
  if (cached) {
    await admin.from("users").upsert(
      { id: cached, name, phone: null, role: "customer", is_demo: true },
      { onConflict: "id" },
    );
    // Keep Auth password in sync for the primary demo login (Reset + Load).
    if (isPrimaryLogin) {
      await admin.auth.admin.updateUserById(cached, {
        password,
        email_confirm: true,
        user_metadata: { name },
      });
    }
    return cached;
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  });

  let userId = data?.user?.id;
  if (error || !userId) {
    // May already exist — refresh cache from list
    const { data: listed } = await admin.auth.admin.listUsers({ perPage: 1000 });
    for (const u of listed?.users ?? []) {
      if (u.email) emailCache.set(u.email.toLowerCase(), u.id);
    }
    userId = emailCache.get(email.toLowerCase());
    if (!userId) {
      throw new Error(`Failed to create ${email}: ${error?.message}`);
    }
    if (isPrimaryLogin) {
      await admin.auth.admin.updateUserById(userId, {
        password,
        email_confirm: true,
        user_metadata: { name },
      });
    }
  } else {
    emailCache.set(email.toLowerCase(), userId);
  }

  const { data: row } = await admin
    .from("users")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  if (row?.role === "admin") {
    throw new Error(`Refusing to use ${email}: already an administrator.`);
  }

  await admin.from("users").upsert(
    { id: userId, name, phone: null, role: "customer", is_demo: true },
    { onConflict: "id" },
  );

  return userId;
}

async function assertReferralEventsReady(admin: SupabaseClient) {
  const { error } = await admin
    .from("referral_events")
    .select("id", { count: "exact", head: true });
  if (error) {
    throw new Error(
      "referral_events table is missing (needed for Opens). In Supabase → SQL Editor, run supabase/schema_stage7a.sql, then supabase/schema_demo.sql, then supabase/schema_stage7h.sql (originator_store_id + receipt_purchased_at). After that, Reset + Load demo data again.",
    );
  }
}

async function insertEvent(
  admin: SupabaseClient,
  tokenId: string,
  eventType: string,
  actorUserId: string,
  at: Date,
) {
  const row = {
    token_id: tokenId,
    event_type: eventType,
    actor_user_id: actorUserId,
    created_at: at.toISOString(),
    is_demo: true,
  };
  const { error } = await admin.from("referral_events").insert(row);
  if (error) {
    // Fallback if is_demo column is missing on referral_events
    const { error: retryError } = await admin.from("referral_events").insert({
      token_id: tokenId,
      event_type: eventType,
      actor_user_id: actorUserId,
      created_at: at.toISOString(),
    });
    if (retryError) {
      throw new Error(
        `referral_events insert failed (${eventType}): ${retryError.message}`,
      );
    }
  }
}

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
  originatorStoreId: string;
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
      originator_store_id: input.originatorStoreId,
      expires_at: input.expiresAt.toISOString(),
      created_at: input.at.toISOString(),
      is_demo: true,
    })
    .select("id, code, holder_user_id, depth, expires_at, created_at")
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
    // Skip 'shared' events in bulk seed — claim+open are enough for Opens metric.
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
  if (input.at.getTime() <= new Date(leaf.created_at).getTime()) {
    throw new Error(
      `${input.label}: purchase time must be after buyer claim (${leaf.code})`,
    );
  }
  const { data: purchase, error } = await admin
    .from("purchases")
    .insert({
      token_id: leaf.id,
      buyer_user_id: leaf.holder_user_id,
      store_id: input.storeId,
      // Always at partner store GPS — store_match distance ≈ 0 m (not claim place).
      purchase_lat: STORE.lat,
      purchase_lng: STORE.lng,
      amount: input.amount,
      receipt_image_url: PLACEHOLDER_RECEIPT,
      receipt_barcode: input.barcode,
      receipt_purchased_at: input.at.toISOString(),
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
 * Grow a branching tree to depth 4:
 * parent → children → grandchildren → great-grandchildren → great-great-grandchildren
 *
 * `fanout[d]` = how many children each node at depth d creates (d = 0..3).
 * Example fanout [3,3,2,2] → 1 + 3 + 9 + 18 + 36 = 67 tokens.
 */
async function growDepth4Tree(input: {
  admin: SupabaseClient;
  emailCache: Map<string, string>;
  treeTag: string; // e.g. "T1"
  personPrefix: string; // e.g. "t1"
  product: { id: string; barcode: string; price: number };
  offerId: string;
  storeId: string;
  t0: Date;
  fanout: [number, number, number, number];
  /** Redeem every Nth depth-4 leaf (1 = all, 3 = every third) */
  redeemEveryNthLeaf: number;
  placeCounter: { n: number };
}): Promise<{ root: TokenRow; codes: string[]; reports: ChainSeedReport[] }> {
  const {
    admin,
    emailCache,
    treeTag,
    personPrefix,
    product,
    offerId,
    storeId,
    t0,
    fanout,
    redeemEveryNthLeaf,
    placeCounter,
  } = input;

  const need = async (key: string) =>
    ensureDemoCustomer(admin, key, emailCache);

  // Pre-create all person keys for this tree in parallel batches (faster / less timeout risk).
  const personKeys = new Set<string>([`${personPrefix}a`]);
  {
    let paths = [{ codePath: treeTag, personPath: personPrefix }];
    for (let depth = 0; depth < 4; depth++) {
      const childCount = fanout[depth];
      const next: typeof paths = [];
      for (const p of paths) {
        for (let i = 1; i <= childCount; i++) {
          const letter = DEPTH_LETTER[depth + 1];
          const personKey = `${p.personPath}${letter.toLowerCase()}${i}`;
          personKeys.add(personKey);
          next.push({
            codePath: `${p.codePath}${letter}${i}`,
            personPath: personKey,
          });
        }
      }
      paths = next;
    }
  }
  const keyList = [...personKeys];
  for (let i = 0; i < keyList.length; i += 8) {
    await Promise.all(keyList.slice(i, i + 8).map((k) => need(k)));
  }

  const nextPlace = () => placeAt(placeCounter.n++);
  const expiresAt = hoursAfter(t0, TOKEN_VALIDITY_HOURS);
  const codes: string[] = [];
  const reports: ChainSeedReport[] = [];
  const leaves: TokenRow[] = [];

  const rootCode = `DEMO${treeTag}A`;
  const root = await createTokenNode({
    admin,
    code: rootCode,
    holderUserId: await need(`${personPrefix}a`),
    parent: null,
    rootId: null,
    depth: 0,
    productId: product.id,
    offerId,
    barcode: product.barcode,
    // Originator recommends at the partner store; later hops may claim elsewhere.
    place: STORE,
    at: t0,
    expiresAt,
    originatorStoreId: storeId,
    shared: true,
  });
  codes.push(root.code);

  type NodeCtx = {
    token: TokenRow;
    codePath: string; // e.g. T1B2C1
    personPath: string; // e.g. t1b2c1
    lineageCodes: string[];
  };

  let frontier: NodeCtx[] = [
    {
      token: root,
      codePath: treeTag,
      personPath: personPrefix,
      lineageCodes: [root.code],
    },
  ];

  for (let depth = 0; depth < 4; depth++) {
    const childCount = fanout[depth];
    const nextFrontier: NodeCtx[] = [];
    let sibling = 0;

    for (const parent of frontier) {
      for (let i = 1; i <= childCount; i++) {
        sibling += 1;
        const letter = DEPTH_LETTER[depth + 1];
        const code = `DEMO${parent.codePath}${letter}${i}`;
        const personKey = `${parent.personPath}${letter.toLowerCase()}${i}`;
        const hoursOffset = 1.5 + depth * 3.5 + sibling * 0.15;

        const child = await createTokenNode({
          admin,
          code,
          holderUserId: await need(personKey),
          parent: parent.token,
          rootId: root.id,
          depth: depth + 1,
          productId: product.id,
          offerId,
          barcode: product.barcode,
          place: nextPlace(),
          at: hoursAfter(t0, hoursOffset),
          expiresAt,
          originatorStoreId: storeId,
          shared: depth + 1 < 4,
        });
        codes.push(child.code);

        const ctx: NodeCtx = {
          token: child,
          codePath: `${parent.codePath}${letter}${i}`,
          personPath: personKey,
          lineageCodes: [...parent.lineageCodes, child.code],
        };
        nextFrontier.push(ctx);
        if (depth + 1 === 4) leaves.push(child);
      }
    }
    frontier = nextFrontier;
  }

  // Redeem a sample of depth-4 leaves so Network shows purchases/rewards
  let leafIdx = 0;
  for (const leaf of leaves) {
    leafIdx += 1;
    if (leafIdx % redeemEveryNthLeaf !== 0) continue;
    // Purchase must be after this leaf's claim (~25 min), and still inside the window.
    const afterClaim = minutesAfter(new Date(leaf.created_at), 25);
    const safeAt =
      afterClaim.getTime() < expiresAt.getTime()
        ? afterClaim
        : minutesAfter(expiresAt, -15);
    if (safeAt.getTime() <= new Date(leaf.created_at).getTime()) continue;

    reports.push(
      await validateLeafPurchase({
        admin,
        label: `${treeTag} depth-4 leaf ${leaf.code}`,
        leaf,
        storeId,
        barcode: product.barcode,
        amount: product.price,
        at: safeAt,
        codes: [root.code, leaf.code],
      }),
    );
  }

  return { root, codes, reports };
}

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
    const email = u.email?.toLowerCase() ?? "";
    if (
      email.endsWith(`@${DEMO_EMAIL_DOMAIN}`) ||
      email === DEMO_LOGIN.email.toLowerCase()
    ) {
      await admin.auth.admin.deleteUser(u.id);
    }
  }
}

/**
 * Compact depth-4 branching trees (sized to finish on Vercel serverless).
 * Roots: DEMOT1A (tea), DEMOT2A (coffee), DEMOT3A (spice).
 */
export async function loadDemoData(admin: SupabaseClient): Promise<{
  reports: ChainSeedReport[];
  assistCodes: string[];
  summary: string;
}> {
  await assertReferralEventsReady(admin);
  await resetDemoData(admin);

  const emailCache = new Map<string, string>();
  const { data: listed } = await admin.auth.admin.listUsers({ perPage: 1000 });
  for (const u of listed?.users ?? []) {
    if (u.email) emailCache.set(u.email.toLowerCase(), u.id);
  }

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
      name: "EFDAA Partner Store Koramangala",
      address: `${STORE.text}, Bengaluru`,
      lat: STORE.lat,
      lng: STORE.lng,
      is_demo: true,
    })
    .select("*")
    .single();
  if (storeError || !store) throw new Error(storeError?.message ?? "store");

  const reports: ChainSeedReport[] = [];
  const rootCodes: string[] = [];
  const placeCounter = { n: 0 };
  let tokenCount = 0;

  // Modest fanout so Load finishes within Vercel limits (~31 tokens/tree).
  const trees: {
    treeTag: string;
    personPrefix: string;
    productKey: keyof typeof productByKey;
    hoursAgoStart: number;
    fanout: [number, number, number, number];
    redeemEveryNthLeaf: number;
  }[] = [
    {
      treeTag: "T1",
      personPrefix: "t1",
      productKey: "tea",
      hoursAgoStart: 21,
      fanout: [2, 2, 2, 2],
      redeemEveryNthLeaf: 4,
    },
    {
      treeTag: "T2",
      personPrefix: "t2",
      productKey: "coffee",
      hoursAgoStart: 19,
      fanout: [2, 2, 2, 2],
      redeemEveryNthLeaf: 5,
    },
    {
      treeTag: "T3",
      personPrefix: "t3",
      productKey: "spice",
      hoursAgoStart: 17,
      fanout: [2, 2, 2, 1],
      redeemEveryNthLeaf: 3,
    },
  ];

  for (const tree of trees) {
    const grown = await growDepth4Tree({
      admin,
      emailCache,
      treeTag: tree.treeTag,
      personPrefix: tree.personPrefix,
      product: productByKey[tree.productKey],
      offerId: offer.id,
      storeId: store.id,
      t0: hoursAgo(tree.hoursAgoStart),
      fanout: tree.fanout,
      redeemEveryNthLeaf: tree.redeemEveryNthLeaf,
      placeCounter,
    });
    rootCodes.push(grown.root.code);
    tokenCount += grown.codes.length;
    reports.push(...grown.reports);
  }

  // Chain A — short genuine path for /demo (km hops, hours apart)
  {
    const product = productByKey.tea;
    const t0 = hoursAgo(18);
    const expiresAt = hoursAfter(t0, TOKEN_VALIDITY_HOURS);
    const A = await createTokenNode({
      admin,
      code: "DEMOGEN0",
      holderUserId: await ensureDemoCustomer(admin, "gena", emailCache),
      parent: null,
      rootId: null,
      depth: 0,
      productId: product.id,
      offerId: offer.id,
      barcode: product.barcode,
      place: STORE,
      at: t0,
      expiresAt,
      originatorStoreId: store.id,
      shared: true,
    });
    const B = await createTokenNode({
      admin,
      code: "DEMOGEN1",
      holderUserId: await ensureDemoCustomer(admin, "genb", emailCache),
      parent: A,
      rootId: A.id,
      depth: 1,
      productId: product.id,
      offerId: offer.id,
      barcode: product.barcode,
      place: placeAt(placeCounter.n++),
      at: hoursAfter(t0, 3),
      expiresAt,
      originatorStoreId: store.id,
      shared: true,
    });
    const C = await createTokenNode({
      admin,
      code: "DEMOGEN2",
      holderUserId: await ensureDemoCustomer(admin, "genc", emailCache),
      parent: B,
      rootId: A.id,
      depth: 2,
      productId: product.id,
      offerId: offer.id,
      barcode: product.barcode,
      // Buyer CLAIM far + 8h later → no proximity penalty; receipt is separate.
      place: GENUINE_BUYER_CLAIM,
      at: hoursAfter(t0, 8),
      expiresAt,
      originatorStoreId: store.id,
    });
    rootCodes.push(A.code);
    tokenCount += 3;
    reports.push(
      await validateLeafPurchase({
        admin,
        label: "Genuine chain (tea)",
        leaf: C,
        storeId: store.id,
        barcode: product.barcode,
        amount: product.price,
        // Purchase after buyer claim (~25 min), at partner store GPS.
        at: minutesAfter(hoursAfter(t0, 8), 25),
        codes: [A.code, B.code, C.code],
      }),
    );
  }

  // Proximity contrast (short)
  {
    const product = productByKey.honey;
    const t0 = hoursAgo(2);
    const expiresAt = hoursAfter(t0, TOKEN_VALIDITY_HOURS);
    const A = await createTokenNode({
      admin,
      code: "DEMOPRX0",
      holderUserId: await ensureDemoCustomer(admin, "prxa", emailCache),
      parent: null,
      rootId: null,
      depth: 0,
      productId: product.id,
      offerId: offer.id,
      barcode: product.barcode,
      // Recommends from partner store; claim GPS also at that store.
      place: STORE,
      at: t0,
      expiresAt,
      originatorStoreId: store.id,
      shared: true,
    });
    const B = await createTokenNode({
      admin,
      code: "DEMOPRX1",
      holderUserId: await ensureDemoCustomer(admin, "prxb", emailCache),
      parent: A,
      rootId: A.id,
      depth: 1,
      productId: product.id,
      offerId: offer.id,
      barcode: product.barcode,
      // Buyer CLAIM ~8m / 2 min from originator claim → proximity ×0.01.
      // Receipt purchase later at the same store does NOT feed proximity.
      place: PROX_BUYER,
      at: minutesAfter(t0, 2),
      expiresAt,
      originatorStoreId: store.id,
    });
    rootCodes.push(A.code);
    tokenCount += 2;
    reports.push(
      await validateLeafPurchase({
        admin,
        label: "Proximity pair (honey)",
        leaf: B,
        storeId: store.id,
        barcode: product.barcode,
        amount: product.price,
        // Receipt ~25 min after claim; store_match OK; score from claim proximity only.
        at: minutesAfter(t0, 2 + 25),
        codes: [A.code, B.code],
      }),
    );
  }

  // Expired small branch (floor)
  {
    const product = productByKey.honey;
    const t0 = hoursAgo(72);
    const expiresAt = hoursAfter(t0, TOKEN_VALIDITY_HOURS);
    const A = await createTokenNode({
      admin,
      code: "DEMOEXP0",
      holderUserId: await ensureDemoCustomer(admin, "expa", emailCache),
      parent: null,
      rootId: null,
      depth: 0,
      productId: product.id,
      offerId: offer.id,
      barcode: product.barcode,
      place: STORE,
      at: t0,
      expiresAt,
      originatorStoreId: store.id,
      shared: true,
    });
    const B = await createTokenNode({
      admin,
      code: "DEMOEXPB1",
      holderUserId: await ensureDemoCustomer(admin, "expb1", emailCache),
      parent: A,
      rootId: A.id,
      depth: 1,
      productId: product.id,
      offerId: offer.id,
      barcode: product.barcode,
      place: placeAt(placeCounter.n++),
      at: hoursAfter(t0, 4),
      expiresAt,
      originatorStoreId: store.id,
      shared: true,
    });
    const C = await createTokenNode({
      admin,
      code: "DEMOEXPB1C1",
      holderUserId: await ensureDemoCustomer(admin, "expb1c1", emailCache),
      parent: B,
      rootId: A.id,
      depth: 2,
      productId: product.id,
      offerId: offer.id,
      barcode: product.barcode,
      place: placeAt(placeCounter.n++),
      at: hoursAfter(t0, 20),
      expiresAt,
      originatorStoreId: store.id,
    });
    rootCodes.push(A.code);
    tokenCount += 3;
    reports.push(
      await validateLeafPurchase({
        admin,
        label: "Expired branch (honey floor)",
        leaf: C,
        storeId: store.id,
        barcode: product.barcode,
        amount: product.price,
        // After claim, but after chain expiry → score 0 + floor.
        at: minutesAfter(expiresAt, 45),
        codes: [A.code, B.code, C.code],
      }),
    );
  }

  return {
    reports,
    assistCodes: rootCodes,
    summary: `Seeded ${tokenCount} tokens. Open Network/Assist on: ${rootCodes.join(", ")}. Customer login (DEMOT1A originator): ${DEMO_LOGIN.email} / ${DEMO_LOGIN.password}.`,
  };
}
