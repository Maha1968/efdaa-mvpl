# EFDAA — MVP Build Playbook & Cursor Prompts (v3)

A step-by-step guide for a non-technical founder to build the EFDAA MVP using Cursor.
Save this file inside your project folder as `SPEC.md` so Cursor can always read it.

> v3 adds: the originator never has to buy; location is captured at every claim (open);
> and a proximity-time anti-collusion signal in the genuineness score. Still pilot-simple, no ML.
> Location = free GPS coordinates + an optional place-name text field. No maps service needed
> for the pilot (the genuineness math runs on coordinates + timestamps alone). The smart
> "you're at X" place suggestion is a Phase 1 addition once the core loop works.

---

## 0. What we are building (the one-paragraph version)

EFDAA is an **offline referral-attribution platform**. An *originator* — who does **not** have to
buy anything — finds a product, **photographs the product and its barcode tag**, has their
**location captured**, and generates a shareable **token** which they send (via WhatsApp) to
contacts. Anyone who opens the link **claims** it (which captures *their* location and time) and
can then **redeem** it (buy for themselves), **forward** it (pass it on), or **do both**. Every
forward creates a *new child token* that remembers its *parent*, its *root* (the originator), and
the claimer's location/time. Chains can be up to **5 people deep** and the whole chain **expires**
a set number of hours after the originator created it (default 24h). When someone buys within the
window they **upload the receipt**; we check the receipt's **barcode**, the **store/location**,
the **timing**, and how much **real gap in space and time** exists between the people in the chain
— then pay a **reward pool** split across the chain. The record of "who caused whom to buy, for
which product, where, when, and how genuinely" is the real product: the **influence graph**.

---

## 1. The tools (accounts to create — all free for the pilot)

| Tool | What it does | Why | Cost (pilot) |
|------|--------------|-----|--------------|
| **Cursor** | AI code editor (you have this) | Writes the code | — |
| **GitHub** | Stores your code online | Bridge between Cursor and hosting | Free |
| **Supabase** | Database + login + file storage | Runs the influence graph, plus photo & receipt uploads | Free |
| **Vercel** | Hosting / deployment | Puts your app on the internet | Free |

**Do NOT use yet:** graph database (Neo4j), paid WhatsApp API, automatic barcode/receipt reading
(OCR), a maps/place-name service, any ML. These are Phase 2. In the pilot: barcodes and receipt
details are entered/checked manually, and location is captured as raw GPS coordinates (free) plus
an optional place-name the user can type.

---

## 2. The tech stack (what Cursor will build with)

- **Next.js** (App Router) + **TypeScript** — one codebase.
- **Supabase** — database (Postgres), auth (login), storage (product photos, barcode photos,
  receipt images).
- **Tailwind CSS** — clean styling.
- **Browser Geolocation API** — free GPS capture on the phone (no maps service).
- **Vercel** — deployment.

You never write code. You describe what you want; Cursor writes it. Your job is to **test,
describe problems clearly, and approve.**

---

## 3. The data model (the most important section)

Copy this into Cursor as-is.

### Tables

**users** — `id`, `name`, `phone`, `role` (`customer` | `admin` | null until first login), `created_at`

Roles are **permanent**: assigned once on first login (`ADMIN_EMAIL` → admin, otherwise customer).
A customer can never become an administrator later, and an administrator can never become a
customer. Administrators only use the admin dashboard — they cannot create/share/redeem tokens
or earn points. Only customers see recommendations, points, and the create-token flow.

**products** — `id`, `name`, `price`, `barcode` (canonical barcode/SKU to match receipts against)

**offers** — `id`, `name`, `base_reward_pct` (e.g. 5%)

**stores** — `id`, `name`, `address`, `lat`, `lng`

**tokens** — the core of everything. Each row is one token held by one person, stamped with WHERE
and WHEN that person claimed/created it.
- `id`
- `code` — the short shareable code inside the WhatsApp link
- `holder_user_id`
- `parent_token_id` — the token this was forwarded FROM (NULL if originator's token)
- `root_token_id` — the originator's original token (same for the whole chain)
- `depth` — 0 for originator, then 1..4. **Max depth 4 → chain of 5.**
- `product_id` (nullable for photo-first recommendations), `offer_id`
- `scanned_barcode` — OPTIONAL barcode at share time. Absence → purchase
  `barcode_match = not_provided` (no genuineness penalty).
- `product_photo_url`, `barcode_photo_url` — legacy single URLs; Stage 7J also uses
  **`token_photos`** (1–5 recommendation photos).
- `store_signage_photo_url` — OPTIONAL storefront/signage photo
- `category` — inferred or manually chosen category
- `store_name_text` — when no partner store row was matched
- `store_resolution` — `matched` | `suggested` | `user_entered`
- `claim_lat`, `claim_lng` — WHERE this person was when they claimed/created this token
- `claim_location_text` — OPTIONAL place name the user typed (e.g. "Phoenix Mall")
- `originator_store_id` — partner store the originator recommended from (set on root;
  copied to every child). Purchase GPS is scored against this store.
- `expires_at` — inherited from the root (root.created_at + validity window). Same for the chain.
- `created_at` — WHEN this token was claimed/created (used for claim-duration / proximity)

**token_photos** — `id`, `token_id`, `url`, `sort_order`, `created_at` (1–5 photos per token)

**purchases** (the uploaded receipt)
- `id`, `token_id`, `buyer_user_id`, `store_id` (originator's store when matched)
- `purchase_lat`, `purchase_lng` — where the purchase happened (GPS at checkout)
- `amount`, `receipt_image_url`, `receipt_barcode` (manual in pilot)
- `receipt_purchased_at` — **date/time printed on the receipt** (required). Source of
  purchase duration, validity window, and hop-to-purchase times. Not app submit time.
- `status` — `pending` | `validated` | `rejected`
- Signal flags (computed at validation):
  - `barcode_match` — **`match` | `mismatch` | `not_provided`**. `not_provided` when the
    originator token has no `scanned_barcode` — **never** apply `BARCODE_MISS_MULTIPLIER`.
  - `store_match`, `within_window`
  - `time_to_purchase_hours` — hours from **originator share** to **`receipt_purchased_at`**.
    Always ≥ the originator→buyer-claim gap (`receipt_purchased_at` ≥ buyer claim).
  - `min_hop_distance_m` — distance (m) between **originator claim** and **buyer token claim**
    (the proximity scoring gap; not consecutive mid-chain hops)
  - `min_hop_time_minutes` — time gap (minutes) for that same originator ↔ buyer-claim pair
- `genuineness_score` — 0.0–1.0, from Section 4
- `created_at` — when the purchase was submitted to EFDAA (audit only)

**rewards** — `id`, `purchase_id`, `user_id`, `role`
(`originator` | `forwarder` | `last_referrer` | `buyer`), `amount`, `created_at`

### The lineage & expiry rules (enforce in code)
1. **Originator** token: `parent_token_id = NULL`, `root_token_id = its own id`, `depth = 0`,
   `expires_at = created_at + TOKEN_VALIDITY_HOURS`, **`originator_store_id` = selected partner
   store**. Claim location = originator's GPS. The originator does NOT buy.
2. **Claim (open a link):** capture the claimer's GPS location + current time (anywhere).
3. **Forward:** create a NEW token — `parent_token_id = received token`,
   `root_token_id = parent's root`, `depth = parent.depth + 1`, `expires_at = parent's expires_at`,
   `originator_store_id = parent's originator_store_id`,
   `claim_lat/lng` and `created_at` = the claimer's captured location + time.
4. **Reject forwards where `depth > 4`.**
5. **Reject any action after `expires_at`.** An expired link shows "This offer has expired."
6. **Reject purchase if `receipt_purchased_at` is before the redeemed token’s claim
   (`token.created_at`).** Timeline: Originator share → Buyer claim → Receipt purchase time.
7. Trace a chain: from the redeemed token follow `parent_token_id` up to the root (recursive CTE).

---

## 4. Reward & genuineness logic (encode this exactly)

### Step A — Genuineness score (deterministic, pilot version)
Genuineness rewards purchases that look like real, independent word-of-mouth and penalizes ones
that look self-dealing. Start at `1.0`, then apply these configurable adjustments:

- If `within_window` is **false** → `genuineness_score = 0` (scored pool is 0; pilot still pays
  the zero-score floor — see Step B). Window uses **`receipt_purchased_at`** vs `expires_at`.
- If `barcode_match` is **`mismatch`** → × `BARCODE_MISS_MULTIPLIER` (0.5).
- If `barcode_match` is **`not_provided`** (token had no barcode at share time) → **do not
  apply** `BARCODE_MISS_MULTIPLIER`. A barcode-free but otherwise genuine referral scores
  **1.00** on this factor.
- If `barcode_match` is **`match`** → no barcode penalty.
- If `store_match` is **false** → × `STORE_MISS_MULTIPLIER` (**0.01**). `store_match` means
  purchase GPS is within `STORE_MATCH_MAX_DISTANCE_M` (**50 m**) of the **originator’s store**
  GPS (and `store_id` is that store). Claim/open may be elsewhere; purchase should be at the
  originator’s store. Miss is a harsh score cut, not a hard reject.
- **Proximity-time check (anti-collusion) — THE CLAIM only:** Intermediate shares may be
  tracked for display, but they do **not** change the score. The score uses **one** comparison:
  **originator claim** ↔ **buyer claim** (redeemed token `claim_lat/lng` + `created_at` vs the
  originator’s). If that pair is **both** too near (`distance < MIN_GENUINE_DISTANCE_METERS`,
  default **1000**) **and** too fast (`gap < MIN_GENUINE_TIME_MINUTES`, default **60**), apply
  × `PROXIMITY_PENALTY_MULTIPLIER` (**0.01**) once. Far apart **or** enough time clears the check.
  **Rationale:** a genuine buyer is persuaded by the coupon *before* they go to the store; a
  claim next to the originator minutes later is collusion.
- **THE PURCHASE (from receipt) never feeds proximity:** `purchase_lat/lng` and
  `receipt_purchased_at` are for store_match, within_window, and purchase duration only.

**Durations (same originator baseline):**
- Claim duration = buyer claim time − originator share time
- Purchase duration = `receipt_purchased_at` − originator share time

Distance uses the Haversine formula on two lat/lng points (Cursor knows it). No maps service is
needed — only the coordinates and timestamps already captured.

### Step B — Reward pool & split
When a purchase is marked **validated**:
1. `scored_pool = purchase.amount × offer.base_reward_pct × genuineness_score`
2. If `scored_pool` is **0**, apply the pilot floor:
   `base_pool = purchase.amount × ZERO_SCORE_FLOOR_REWARD_PCT` (default **0.1%** = `0.001`).
   Otherwise `base_pool = scored_pool`.
3. Walk the token chain from the buyer's token up to the originator → ordered list of people.
4. Roles: `buyer`, `last_referrer` (referred the buyer), `originator`, middle = `forwarder`.
5. Split by weights: `buyer 4, last_referrer 3, originator 2, forwarder 1`.
6. Each reward = `base_pool × (their weight ÷ sum of weights)`.
7. Round/store/display reward amounts to `REWARD_DISPLAY_DECIMALS` (default **2**).
8. One `rewards` row per eligible **customer** (admins never earn points). **No validated
   purchase → no rewards.**

### Config file (single place to tune everything)
- `TOKEN_VALIDITY_HOURS` = 24
- `BARCODE_MISS_MULTIPLIER` = 0.5
- `STORE_MISS_MULTIPLIER` = 0.01
- `STORE_MATCH_MAX_DISTANCE_M` = 50
- `MIN_GENUINE_DISTANCE_METERS` = 1000
- `MIN_GENUINE_TIME_MINUTES` = 60
- `PROXIMITY_PENALTY_MULTIPLIER` = 0.01
- reward weights: `buyer 4, last_referrer 3, originator 2, forwarder 1`
- `base_reward_pct` (also stored per offer)
- `ZERO_SCORE_FLOOR_REWARD_PCT` = 0.001 (0.1% of purchase when score/pool is 0) — change after launch
- `REWARD_DISPLAY_DECIMALS` = 2 — change after launch if needed

---

## 5. How to work with Cursor

- Use **Agent mode**. Paste ONE stage at a time (Section 7).
- After each stage: test, then tell Cursor to "commit and push to GitHub." Vercel auto-deploys.
- Describe problems like a user; paste any red error text.
- If Cursor drifts: "Re-read SPEC.md and continue."

---

## 6. Master context prompt (paste this FIRST, once)

```
You are helping me build the MVP for EFDAA, an offline referral-attribution web app.
I am non-technical, so:
- Explain what you are about to do in one plain sentence before each step.
- Choose sensible defaults; do not ask me technical questions I can't answer.
- Build a mobile-friendly web app using Next.js (App Router), TypeScript, Tailwind CSS,
  and Supabase (database + auth + storage). Deploy target is Vercel.

Read SPEC.md in this project (data model, lineage rules, expiry rules, and reward + genuineness
logic) and follow it exactly. Key points:
- The ORIGINATOR does not buy; they only photograph a product + its barcode and share.
- A chain is at most 5 people deep (depth 0-4). Reject deeper forwards.
- The chain expires TOKEN_VALIDITY_HOURS after the originator created it; after that, reject
  actions and show expired links as expired.
- Opening a link is a "claim" that captures the person's GPS location + time. Forwards create a
  child token stamped with that location/time; it stores parent_token_id, root_token_id, and
  inherits expires_at.
- Location is captured as free GPS coordinates via the browser Geolocation API, plus an optional
  place-name text field. Do NOT use a paid maps service in the pilot.
- Purchases upload a receipt and record store, location, and the receipt barcode.
- Rewards are only created for a 'validated' purchase, and the pool is scaled by a deterministic
  genuineness_score: barcode match, store match, within window, and a proximity-time
  anti-collusion penalty (too near AND too fast between **originator claim** and **buyer token
  claim** only — intermediate shares do not change the score).

Set up the project structure now. Do not build features yet — scaffold, install dependencies,
confirm it runs, then wait.
```

---

## 7. The build, stage by stage (paste one block per turn)

### Stage 0 — Scaffold & first deploy
```
Create the Next.js + TypeScript + Tailwind project and get it running locally. Then walk me,
step by step in plain language, through: (1) pushing to a new GitHub repository, and
(2) connecting that repo to Vercel for a live URL. Give exact buttons to click. Confirm live.
```

### Stage 1 — Connect Supabase & log in
```
Connect the app to my Supabase project. Tell me exactly which values to copy from my Supabase
dashboard and where to paste them (.env.local). Then build a simple phone-or-email login/signup
with Supabase Auth and a logged-in home screen showing the user's name. Mobile-first.
```

### Stage 2 — Create the database tables & config
```
Using the data model in SPEC.md, generate the SQL to create all tables (users, products, offers,
stores, tokens, purchases, rewards) with the exact columns, including barcode, photo URLs,
claim_lat/lng, claim_location_text, expires_at, purchase location, the signal flags, and
genuineness_score. Tell me exactly where to paste the SQL in Supabase. Set up Storage buckets for
product photos, barcode photos, and receipts. Create the config file from SPEC.md Section 4 with
all the tunable numbers. Insert 2 sample products (each with a barcode), 1 sample offer (5%), and
1 sample store with a location, for testing.
```

### Stage 3 — Originator creates & shares a token (no purchase needed)
```
Build the "create a token" flow. The originator does NOT buy anything. They: pick a product/offer,
take/upload a photo of the product and a photo of its barcode, enter or capture the barcode number,
and the app captures their current GPS location via the browser Geolocation API (ask permission),
plus an OPTIONAL free-text field for the place name (e.g. "Phoenix Mall"). Create a token with
parent_token_id = NULL, root_token_id = its own id, depth = 0, the barcode, the two photo URLs,
claim_lat/lng, claim_location_text, and expires_at = now + TOKEN_VALIDITY_HOURS. Then show a
"Share on WhatsApp" button (wa.me link) whose message contains a link to our app with the token
code. Mobile-first. Do not use any paid maps service — just raw coordinates.
```

### Stage 4 — Claim a token: capture location, then Redeem / Forward / Both
```
Build the screen shown when a person opens a shared token link. First check expiry: if now is past
expires_at, show "This offer has expired" and stop. Otherwise show a "Claim" step that captures the
person's current GPS location + time (browser Geolocation, ask permission) and an OPTIONAL
place-name field. After claiming, offer three choices: Redeem, Forward, or Redeem + Forward.
- Forward: create a NEW token with parent_token_id = the received token, root_token_id = parent's
  root, depth = parent.depth + 1, expires_at = parent's expires_at, and claim_lat/lng + created_at
  set to this claimer's captured location + time. Block if depth would exceed 4 ("This chain has
  reached its maximum length"). Then show a WhatsApp share button.
- Redeem: go to the purchase flow (next stage).
Every new token must remember its parent, root, expiry, and the claimer's location + time.
```

### Stage 5 — Purchase & receipt upload (manual validation)
```
Build the purchase flow for a redeemed token: the buyer purchases at the **originator’s store**
(locked in the UI), the app captures their current GPS location, they enter the **date/time
printed on the receipt**, the amount, the barcode on the receipt, and upload a photo of the
receipt (Supabase Storage). Create a purchases row with status 'pending',
`receipt_purchased_at`, and `time_to_purchase_hours` (originator share → receipt time). Then
build a simple admin page (only visible to me) listing pending purchases with the receipt image
and captured details, with Validate / Reject buttons. On Validate, compute the signal flags
(barcode_match, store_match vs originator store within 50m, within_window from receipt time)
and the originator↔buyer-claim distance/time (stored as min_hop_*) before running rewards.
```

### Stage 6 — Genuineness, attribution & reward split
```
When a purchase is set to 'validated', follow SPEC.md Section 4 exactly:
A) Compute genuineness_score: if within_window is false, score = 0; else start at 1.0, then
   × BARCODE_MISS_MULTIPLIER if barcode doesn't match, × STORE_MISS_MULTIPLIER (0.01) if
   purchase GPS is not within STORE_MATCH_MAX_DISTANCE_M (50m) of the originator’s store, and
   × PROXIMITY_PENALTY_MULTIPLIER if originator claim ↔ buyer token claim is BOTH closer than
   MIN_GENUINE_DISTANCE_METERS AND faster than MIN_GENUINE_TIME_MINUTES (Haversine on claim
   coordinates; intermediate shares do not affect the score).
B) base_pool = amount × offer.base_reward_pct × genuineness_score.
C) Walk the chain to the root (recursive query), assign roles (buyer, last_referrer, originator,
   forwarder), and split base_pool by weights (buyer 4, last_referrer 3, originator 2, forwarder 1).
D) Write one rewards row per person. Read all tunable numbers from the config file.
Show me the genuineness_score, the hop distances/times that drove it, and who got paid what.
```

### Stage 7 — See the chain (simple dashboard)
```
Build a dashboard where I can: view any token's full chain from originator to buyer (product,
barcode, each person's location + time, and expiry); see all validated purchases with their
genuineness_score (and why) and rewards paid; and a leaderboard of users by total reward earned.
Clean and readable. This is the seed of the influence graph.
```

### Stage 7A — Privacy-first Customer & Admin dashboards
```
Redesign dashboards with Privacy by Design. Use platform-generated User IDs everywhere in
operational views — never show customer names, phones, emails, or other PII on dashboards.

CUSTOMER DASHBOARD (recommendation creator):
- Only products THEY personally recommended (their originator tokens).
- Must NOT see: other people's tokens/codes, names, User IDs of recipients, individual paths.
- Per product: recommendation date, campaign status (Active / Expired / Completed), total
  purchases, total reward points, total reward value.
- Referral performance by depth (1–5): purchases, reward points, reward value — aggregates only.

ADMINISTRATOR DASHBOARD:
- Full operational visibility using User IDs only (no PII).
- Filters: date range, campaign/offer, product, Originator User ID, Customer User ID, referral
  code, referral status.
- Originator summary: User ID, product/campaign, date, opens, claims, forwards, purchases,
  purchase value, reward points, reward value.
- Network analytics by depth 1–5: referrals, opens, claims, forwards, purchases, values, rewards.
- Graphical referral tree (Originator → L1…L5); each node shows User ID + activity counts.
- Aggregate analytics: totals, conversion by depth, top originators/products/campaigns (by ID).
- Customer Purchase View: buyer User ID, products, value, date, originating recommendation, and
  downstream purchases/rewards by depth.
- Referral Assist: look up any token code → lifecycle, antecedents (User IDs), descendants,
  status, chronological timeline. No PII.

Privacy: customers see only own recommendations + own rewards + depth aggregates.
Admins see User IDs + referral structure + codes + analytics — never contactable PII.
```

### Stage 7B — Permanent admin vs customer separation
```
Administrators cannot recommend products or own/earn points. An administrator account only
sees the administrator dashboard (and an admin home that links there).

Only non-administrators (customers) can create tokens, claim/share/redeem, see My
recommendations, and see My EFDAA points.

Roles are permanent and mutually exclusive:
- Once someone is a customer they cannot later be made an administrator.
- Once someone is an administrator they cannot later be made a customer.
Role is assigned once on first login (ADMIN_EMAIL → admin; all others → customer) and locked
in the database (immutable after set). Use a separate login for admin vs customer testing.
```

### Stage 7C — Zero-score reward floor & 2-decimal points
```
Pilot rule: even when genuineness_score is 0 (so the normal scored pool is ₹0), still pay a
minimum reward pool of ZERO_SCORE_FLOOR_REWARD_PCT of the purchase amount (default 0.1% =
0.001). Example: ₹2499 purchase with score 0 → base_pool ≈ ₹2.50, then split by role weights
among eligible customers (admins still earn nothing).

Show and store reward/points amounts with REWARD_DISPLAY_DECIMALS (default 2). After the
product is live, change percentages and decimal places only in config/rewards.ts (and this
SPEC) — no logic rewrite required.

Update Section 4 Step B to match. Keep genuineness_score itself unchanged (still 0 when
out of window); only the payout floor changes.
```

### Stage 7D — EFDAAgifts entry from points page
```
On the customer EFDAA Points page (/rewards), add a clear link/button labelled
"Buy using EFDAA points". When clicked (while signed in as a customer), open /efdaagifts
— a page branded EFDAAgifts where users will later spend points on catalog items (each with
an EFDAA points price).

For this stage only: show the button and a placeholder EFDAAgifts page with a banner titled
"EFDAAgifts". Do not build the gift catalog, cart, or redemption yet — that comes later and
will plug into this same button/route. Admins must not access EFDAAgifts.
```

### Stage 7E — Demo seed data (branching trees + admin Load/Reset)
```
Re-read SPEC.md first. We are preparing this app for a live demo. Do NOT change any existing
business logic, reward maths, genuineness logic, or role rules — only ADD seed data and an
admin-only way to load and reset it.

Build a "Demo Data" panel on the ADMIN overview with "Load demo data" and "Reset demo data"
(wipes only seeded demo rows, leaves real data alone). Tag every seeded row with is_demo so
reset can remove it cleanly. Requires SUPABASE_SERVICE_ROLE_KEY.

HARD RULES FOR THE SEED
- Seed CUSTOMERS only. Never seed an administrator. Roles stay permanent (ADMIN_EMAIL on first
  login). The seed must not write or alter any admin role.
- Rewards must be produced by CALLING THE REAL reward + genuineness functions on seeded
  purchases (applyPurchaseValidation). Do NOT hard-code genuineness scores or reward amounts.
- Privacy-by-Design: seeded people shown by platform User ID only on admin views.
- Respect max depth 4, TOKEN_VALIDITY_HOURS, and expires_at inheritance from originator.
- Realistic Bengaluru coordinates, multiple demo products, one partner store
  (originator recommends from that store via `originator_store_id`; recipients may claim
  anywhere; purchases redeem at that same store GPS — store_match within 50m), placeholder
  images.
- **Invariant:** `receipt_purchased_at` is always **after** the redeemed token’s claim time
  (typically ~20–30 minutes later in the short /demo chains). Purchase GPS is the partner
  store coordinates (≈ 0 m vs store), not the buyer’s claim place. Display purchase timing
  from the **originator** baseline using receipt time (e.g. claim at +8 h → receipt at
  +8 h 25 min), so the checkout gap is always greater than the claim gap.

SEED SHAPE (Vercel-safe compact fanouts)
- Branching depth-4 trees: parent → child → grandchild → great-grandchild.
- Roots: DEMOT1A (tea), DEMOT2A (coffee), DEMOT3A (spice). Plus DEMOGEN0 (short genuine chain
  for /demo), DEMOPRX0 (proximity contrast), DEMOEXP0 (expired / floor contrast).
- Partner store: EFDAA Partner Store, Koramangala — originators recommend from / claim there;
  purchases redeem there (store_match = purchase GPS within 50m of that store).
- Intermediate claims may be elsewhere (km hops). Proximity demo: buyer claims ~10m from
  originator at the same store and too soon, then checks out at that store. Genuine demo:
  buyer claims far / with enough time (e.g. BTM), then buys at the store ~25 min after claim
  (receipt time). Expired demo: claim inside window, receipt after expiry → score 0 + floor.
- Sample depth-4 leaves redeem via the real validation path so Network / Purchases / Rewards
  show engine-computed numbers.
- Seed logs referral_events (opened on depth≥1 tokens, claimed, redeemed). Opens on Overview
  count those rows — requires supabase/schema_stage7a.sql (referral_events table) plus
  schema_demo.sql (is_demo columns) plus schema_stage7h.sql (originator_store_id,
  receipt_purchased_at). Load fails early with a clear error if the table is missing.

ADMIN UI ADDITIONS FOR THE DEMO
- Referral Assist: full nested descendants (not only direct children); mark tokens that have a
  purchase with (P) next to the code (antecedents, current token, descendants).
- Network tree: same (P) marker on tokens that have a validated purchase.
- Purchase view: show the purchase token code with (P) and depth; "Purchases in this referral
  tree by depth" uses absolute depth from the originator (so leaf purchases are visible — relative
  "deeper than this buyer" is empty for depth-4 leaves); plus rewards from this purchase by
  recipient depth.
- Overview Opens metric depends on referral_events; after creating the table, Reset + Load again.
- Convenience customer login for DEMOT1A originator: demo_user@efdaa.com / demo_user
  (other seed people remain on @efdaa.demo).
```

### Stage 7F — Customer points dashboard (my recommendations & my earnings)
```
Build the CUSTOMER-facing points dashboard at /rewards. Administrators must never see or access
it (redirect to /admin) and never earn points. Do not change reward, genuineness, or role logic —
read-only presentation of engine-computed rewards. Amounts use REWARD_DISPLAY_DECIMALS.

TOP — headline "You have X EFDAA points" (lifetime total) plus three clickable cards that scroll
to sections: As Originator / As Forwarder / As Buyer. Group rewards by role: originator; forwarder
+ last_referrer (card total); buyer. Detail views label last_referrer accurately. Keep Stage 7D
"Buy using EFDAA points" → /efdaagifts prominent.

SECTION 1 — AS ORIGINATOR: each depth-0 token the customer started — product name + photo,
date, status (Active/Expired/Completed), purchase count, points earned. Expand for performance
by level 1–5: forwards, purchases, purchase value, points attributable to that level. Aggregates
only — no names, phones, emails, User IDs, or token codes of anyone downstream.

SECTION 2 — AS FORWARDER: each of their depth>0 tokens that earned forwarder/last_referrer
points — product, date forwarded, converted flag, points, earn-as label. No level tree; no
originator or other people in the chain.

SECTION 3 — AS BUYER: each validated purchase they made — product, store, date, amount, buyer
points.

PRIVACY: only own recommendations, forwards, purchases, points, and depth aggregates for chains
they originated. Never genuineness/fraud internals. Friendly empty states per section.
Verify with Stage 7E demo login: demo_user@efdaa.com / demo_user (DEMOT1A originator).
```

### Stage 7G — Presentation-quality /demo page + mobile polish
```
Build a public, read-only /demo page for retailers/investors (no login). It shows ONLY Stage 7E
is_demo seeded chains — never real customer data. No hard-coded scores or rewards; read from DB
(and recompute hop evidence from stored claim/purchase locations). Use service-role server reads.

TOP: thesis headline (offline word-of-mouth, made measurable), three live stat tiles (chains,
purchases, rewards), framing line for the three-way contrast.

MAIN: three columns on wide screens (stack on mobile) —
  Chain A Genuine (DEMOGEN0), Chain B Suspicious proximity (DEMOPRX0), Chain C Out of window
  (DEMOEXP0). Each shows:
  - Claim chain: role-labelled nodes + User IDs + claim place/time (last node = **Buyer claim** —
    where/when they opened the coupon).
  - Consecutive hop distances/times between claims (display only).
  - Highlighted **Scores genuineness** hop: originator claim ↔ buyer claim (what drives the
    proximity penalty; thresholds from config).
  - **The purchase (from invoice):** product, barcode, receipt thumbnail, **store name + address**
    of the **originator’s store**, **distance from purchase GPS to that store** (≈ 0 m when at
    store — store_match within 50m), **receipt time**, **purchase duration from originator
    share** (always ≥ claim gap), amount.
  - Optional **Checkout vs originator** hop: distance = buyer claim place → store; **time =
    originator share → receipt time**.
  - Large colour-coded genuineness score; plain-English pass/fail checks; reward pool and role
    split. Explicit copy that expired chains keep a full attribution record and still pay the floor.

CLOSING: every rupee traces to one validated transaction; every purchase traces to who caused it.

Design: presentation-grade, large type, generous whitespace, hops + scores as heroes.

MOBILE: polish /demo, /rewards, /t claim, /create, /redeem, /efdaagifts, /login for 375px —
no horizontal scroll, thumb-sized sticky primary actions, clear location/upload errors, no
hover-only info. Seed adds short DEMOGEN* chain for Chain A contrast.
```

### Stage 7H — Proximity penalty to 0.01, and make the claim-vs-receipt distinction explicit
```
Re-read SPEC.md. Change ONE config value, tighten the wording so the claim/receipt distinction can
never be confused again, and re-seed the demo. Do NOT touch role logic, lineage, expiry,
base_reward_pct, store-match logic, role weights, or the zero-score floor.

CONFIG CHANGE (config/rewards.ts):
- PROXIMITY_PENALTY_MULTIPLIER: 0.4 → 0.01
- Leave MIN_GENUINE_DISTANCE_METERS = 1000 and MIN_GENUINE_TIME_MINUTES = 60 (already correct).
Update SPEC.md Section 4 and the config list to read 0.01.

THE RULE — state it in the code comments and on /demo exactly this way, because these are TWO
DIFFERENT EVENTS and must never be mixed:

  THE CLAIM (drives the fraud/genuineness score, and nothing else):
    - WHERE and WHEN the buyer OPENED the coupon.
    - Source: the redeemed token's claim_lat / claim_lng / created_at.
    - Scoring comparison: originator's claim ↔ buyer's claim. If they are BOTH within
      MIN_GENUINE_DISTANCE_METERS (1000m) AND within MIN_GENUINE_TIME_MINUTES (60 min),
      multiply the genuineness score by PROXIMITY_PENALTY_MULTIPLIER (0.01), once.
    - Rationale: a genuine buyer is persuaded by the coupon BEFORE they go to the store. A claim
      made right next to the originator, minutes later, means the buyer never needed persuading —
      that is collusion.

  THE PURCHASE (drives validation and store-match — NEVER the proximity score):
    - WHERE and WHEN the purchase happened, taken from the RECEIPT.
    - Source: purchase_lat / purchase_lng and receipt_purchased_at.
    - Used for: store_match, within_window, and purchase duration.
    - The purchase location/time must NOT feed the proximity check.

Intermediate hops remain display-only and never affect the score.

THEN RE-SEED the Stage 7E demo chains and re-run the REAL validation path
(applyPurchaseValidation). Do not hard-code any score or reward:
- DEMOGEN0 (Genuine): buyer's CLAIM well over 1000m and well over 60 minutes later; purchase at
  partner store. Score 1.00, full 5% pool.
- DEMOPRX0 (Suspicious): buyer's CLAIM ~8–10m from originator, a few minutes later. Penalty →
  score 0.01. On ₹1,299 ≈ ₹0.65 total.
- DEMOEXP0 (Expired): receipt time after expires_at → score 0 → zero-score floor.

ON /demo: label BUYER CLAIMED vs PURCHASE (from receipt) separately; scoring hop =
"this is what scores genuineness"; purchase marked "confirms the purchase; does not affect the
fraud score".
```

### Stage 7J — New create flow: multi-photo, optional barcode, deferred GPS + store suggestion
```
Re-read SPEC.md. This REPLACES the Stage 3 create flow. Do NOT change lineage, expiry, reward,
or proximity/genuineness rules — only the capture flow and the fields it writes (plus the
barcode_match tri-state so not_provided is neutral).

ORDER (photos first, GPS last):
1. Create screen: "What would you like to recommend?"
2. User takes 1–5 PHOTOS (max 5; thumbnails, delete/retake). Barcode photo OPTIONAL.
   Store-signage photo OPTIONAL.
3. On "I want to share": capture GPS; category dropdown (vision API optional later);
   suggest nearby partner stores from GPS or type store name.
4. Create token with token_photos, optional barcode, category, originator_store_id or
   store_name_text + store_resolution, claim GPS, expires_at. Then WhatsApp share.

BARCODE OPTIONAL — not_provided is NEUTRAL:
- barcode_match = match | mismatch | not_provided
- No barcode on token → not_provided → do NOT apply BARCODE_MISS_MULTIPLIER
- Only mismatch applies ×0.5

Manual fallbacks so the pilot works with ZERO paid APIs. Mobile-first.
SQL: supabase/schema_stage7j.sql
```

---

## 8. Testing checklist (do after each stage)

- [ ] Stage 0: Live Vercel URL loads.
- [ ] Stage 1: I can sign up, log in, see my name.
- [ ] Stage 2: All tables + storage buckets + config exist, with sample data.
- [ ] Stage 3: I can create a token as originator (no purchase) with product photo, barcode photo,
      GPS location, optional place name, and expiry — and share it.
- [ ] Stage 4: Claiming captures my location + time; forwarding creates a new token; depth
      increases; the 5-person cap blocks; an EXPIRED link shows as expired and does nothing.
- [ ] Stage 5: A receipt uploads with originator store locked, GPS, receipt date/time, barcode;
      I can validate/reject.
- [ ] Stage 6: Genuineness scores correctly — proximity uses originator claim ↔ buyer token claim
      only (&lt;1000m AND &lt;60 min → ×0.01); store_match = within 50m of originator store
      (miss → ×0.01); window/duration from receipt_purchased_at; floor when score 0.
- [ ] Stage 7: I can trace any full chain and see the leaderboard.
- [ ] Stage 7A: Customer dashboard shows only my products + depth aggregates (no others' tokens
      or identities). Admin dashboards use User IDs only (no names/phones/emails). Referral Assist
      traces a code with antecedents/descendants/timeline. Purchase view shows cascading depth
      impact without PII.
- [ ] Stage 7B: Admin cannot open /create, /dashboard, /rewards, claim, or redeem. Customer cannot
      open /admin. Role cannot be flipped after first assignment. Admin earns no reward points.
- [ ] Stage 7C: A validated purchase with genuineness_score 0 still pays ~0.1% of amount split to
      customers; points display to 2 decimal places. Tunables live in config/rewards.ts.
- [ ] Stage 7D: Points page shows "Buy using EFDAA points"; link opens /efdaagifts with EFDAAgifts
      banner (catalog later). Admins cannot open it.
- [ ] Stage 7E: Admin Demo Data Load seeds DEMOT1A/2A/3A + DEMOGEN0/DEMOPRX0/DEMOEXP0;
      genuineness + rewards from real engine; reset removes only is_demo rows; Opens > 0 after
      schema_stage7a + schema_demo + schema_stage7h + Load; Assist/Network show (P); Purchase
      view shows tree-by-depth totals; demo_user@efdaa.com / demo_user is DEMOT1A originator.
- [ ] Stage 7F: /rewards shows lifetime points + Originator/Forwarder/Buyer cards and sections;
      originator expand has level aggregates only (no PII/codes); forwarder/buyer lists privacy-safe;
      Buy using EFDAA points still links to /efdaagifts; admins redirected away.
- [ ] Stage 7G: Public /demo shows Genuine / Proximity / Expired; purchase at originator store
      (≤50m); receipt time drives purchase duration (≥ claim gap); scoring hop =
      originator↔buyer claim; mobile at 375px.
- [ ] Stage 7H: PROXIMITY_PENALTY_MULTIPLIER = 0.01; /demo labels BUYER CLAIMED vs PURCHASE
      (from receipt) separately; DEMOPRX score 0.01 (~₹0.65 on ₹1299); claim never uses receipt.
- [ ] Stage 7J: Create flow is photos-first (1–5), barcode optional, GPS on "I want to share";
      barcode_match not_provided does not apply ×0.5; schema_stage7j.sql applied.

---

## 9. What comes AFTER the pilot

- **Phase 1:** The smart "you're at X" place suggestion (via a maps/place service, snapping to
  known stores), fraud rules beyond proximity (self-referral rings, repeated pairs), a retailer
  dashboard, and scaling to more stores.
- **Phase 2:** Automatic barcode + receipt reading (OCR/vision), a learned genuineness model,
  multi-touch attribution, and a graph database if the influence graph grows very large.

Keep this file as your single source of truth. At the start of any new Cursor session, tell it to
re-read SPEC.md first.