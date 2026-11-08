# ELcomputer — fresh-start handoff for Claude (checkpoint 7 Nov 2026, ~11:00 UTC)

> **Update 7 Nov 13:10 UTC:** work resumed and Phase 1 is deployed (roadmap E342).
> Live: release a6b67e993ba66830, schema 126, governorate prices on, stock timer off.
> 13:21: owner's 2 portal AWBs attached and tracking ("New Pickup"). Phase 1 complete.
> 13:51: Phase 2A deployed (roadmap E343): release d59d8bc017cb23ca, schema 127.
> 14:15: Phase 2B deployed (roadmap E344): release c5f0c87d99175bc1, schema 128. Order flow switches default Review first.
> Sections 2-4 and 7 below describe the state before this update.

Paste this whole file into a new conversation. It describes where the work stopped,
everything the owner asked for, what is live, what is built but not live, and the
exact next steps. Work is **paused at the owner's request**. Do nothing in production
until the owner says to continue.

---

## 0. How to work with this owner (keep this)

- The owner is not a developer. Use plain language, short answers and short reports.
- Work in your own lighter way. Codex/ChatGPT documents in the repo are references only.
  Do not copy their ceremony (sealed packets, approval phrases, long receipts) unless it
  adds real safety.
- Keep the real safety: back up before changing, read-only checks first, one-step
  rollback, never lose data, never fake payments, never print or copy keys/credentials,
  keep customer details out of reports.
- Ask before any production change unless the owner already said "deploy"/"do it" for
  that exact change. Approval for one release does not cover the next.
- No Git push without the owner asking.
- Store copy: short, natural sentences (usually under 12 words). Keep EN/AR, RTL,
  Light/Dark/System and responsive behavior. Keep the store's own look: navy `#08265c`,
  blue `#0654e9`, pale blue `#edf4ff`, yellow `#ffd54f`. No new themes.
- Read `AGENTS.md` in the repo. Record every milestone in
  `docs/ELCOMPUTER_MASTER_ROADMAP.md`, `PROJECT_STATE.md` and `CODEX_HANDOFF.md`
  (the latest entries are E335 to E341).
- When a phase is ready, deploy it (if it is not part of the next phase), then wait
  for the owner's confirmation before starting the next phase.

---

## 1. The owner's latest instructions (verbatim, the main brief)

> i didn't get it 'erp worker' as i said, stock and cost will be only within daftara, for now, i want the website to sell orders only, not taking care for erp stuff, unless later i enhance the ERP mode local one, and do a strict tests around, even if it will cost to build from scratch. for now, i told codex too many times to enable the selling even if stocks is not stored in dashboard erp, so i believe something is messed up, even it's working well now.
>
> anyway, what's now? for payments, if order is paid, the daftara should know that bill is paid, that's why if anyone paid an order for all ways except cod, the first bill should be automatically PAID.
>
> how to fix the 'no product matches' ? and 'wrong code used for orders'?
> i told you to fix the paid order matter.
> enable and fix the bill on my account and copy in email, we use brevo, connected and configurated.
> for point number 6, never mind for 'on demand' it's on daftara, the dashboard or nuxt doesn't matter for it if it's on demand or no, website is just for now a stati analysis and orders managment, no erp serious work will be.
>
> i'll do a new order once connection is ready and i'll pay, i want to receive sms, email with attached, and see daftara bill, and confirm the awb was sent to PDC, if weight is required you can just set 1kg as default.
>
> so i want the 0.5% extra fees for order value with OCD chosed as payment, that should be managed from dashboard not hardcoded, do it and activate it.
> also, as we have states in egypt, i want the shipping price to be dynamically, not fixed like know, it's already prepared in dashboard but should be corrected. i've in downloads 'PDC UPDATED FILE', for latest version of states. and folder contains 'ElComputer Proposal.pdf' for prices and cost, so based on shipping cost should be 'rounded too'.
> i said before that in dashboard there's should be something like supporting the shipping cost, so for example if it's like 100 egp, we support it to be 30egp on us and client pays 70egp, this is just an example, but should be done, for now, i beleive 25egp supports for shipping is good, update the list prices.
>
> ONE IMPORTANT THING, TRACKING SHOULD BE WORKING ALSO, INVESTIGATE IT FOR US.
> check in downloads folder for 'Customer Courier Integration Test V4.pdf' and make it working!
> we have a real orders being applied and they can't track the awb!
>
> based on that prompt, split them into 4 phases, do one phase and wait my confirmation to move for next.
> once phase is ready we should deploy it, if it's not part of next phase.

Later in the same session the owner said:
- "once you finish 'Phase 1: keep emails and PDC booking in Daftra mode' can you do a safe
  checkpoint and pause the work?"
- "Deploy the fix now, then stop." followed by "just stop after the 'Build and smoke-test
  the release' is completed. and end the prompt, i'll tell you later to continue the
  development and phases." (So the fix was **built and smoke-tested but NOT deployed**.)
- Earlier: "later i'll ask you to have a look for DB and backend, because codex might be
  missing something after a lot of explainings" (to-do `OWNER-DB-REVIEW-01`).
- Earlier: "the current role is recording purchases and warehouses on daftara ... when
  selecting daftara as erp provider, sales and bills with stock on daftara are good to be a
  safe choice until i enhance the erp system".
- Earlier: "i don't want to sync older orders because they're testing one. so i'm starting
  fresh right now".
- Earlier: "i want in dashboard to control the purchase lifecycle flow, I WANT TO HAVE
  control for changing the flow of everything, for now: i want, if order is paid > pdc awb
  is confirmed and daftara bill is ready. no need to review first before confirming both in
  'order confirmations' like before."
- Earlier: "i want to see how daftara will sync the pdf bill into 'my account' and how we
  could resend one with email attached? if there's a obstcle let me know."
- Owner offered the Vodafone SMS and Daftra API documents if needed (already implemented).

### What the owner means (clarified)
- The **website only sells and manages orders** (plus stats). Daftra owns stock, cost,
  purchases, warehouses and accounting. On-demand items are handled in Daftra; the website
  must keep selling even with no stock recorded (it already does: store setting
  `inventory_tracking_required=false`, `allow_out_of_stock_purchases=true`).
- The website must **not pull stock/cost** from Daftra. The 30-minute stock timer installed
  today must be turned off (Phase 1 step). The "ERP worker" the owner asked about is only
  the scheduler that sends each new order to Daftra as a bill; keep that one.
- Every successful **non-COD payment** (card, Apple Pay, InstaPay/transfer once verified)
  must create the Daftra bill **already marked PAID**.
- The customer must see the bill (PDF) in **My account / order details** and get it
  **attached to the email** (Brevo). Admin needs a **resend** option.
- Paid orders must flow automatically: **paid → PDC AWB created (1 kg default weight) →
  Daftra bill ready**, with no manual step in "Order confirmations". Dashboard switches to
  control this flow.
- **COD fee 0.5%** of order value when COD is chosen, managed in the Dashboard (not hard
  coded), then activated.
- **Shipping price by governorate** from the PDC proposal, rounded, minus store support
  (EGP 25 for now), managed in the Dashboard.
- **Tracking** must work for real orders (customers currently can't track AWBs).

---

## 2. The 4 phases (agreed split)

### Phase 1 — Shipping and tracking (IN PROGRESS, PAUSED)
1. Keep order emails and staff PDC booking working for Daftra-mode orders — **built and
   smoke-tested as release `b678fef5ee11be88`, NOT deployed** (see §4).
2. Attach AWBs booked in the PDC portal to open orders (incl. COD) so tracking works —
   code ready in local commit `5d2a325`, not deployed.
3. Shipping price by governorate (PDC zones + 14% VAT, rounded up to EGP 5, minus EGP 25
   store support), editable in Dashboard → Shipping companies — code ready in `5d2a325`.
4. Parcel weight defaults to 1 kg in the booking form — code ready in `5d2a325`.
5. Turn off the Daftra stock pull timer (`storefront-erp-stock.timer`) — not done yet.
6. After deploy: set the pricing on the checkout courier, attach AWBs for open orders,
   verify tracking end to end, confirm checkout shows governorate prices.

### Phase 2 — Paid orders automation + Daftra bills
- Auto-confirm paid orders (all non-COD): create PDC AWB at 1 kg and the Daftra bill.
- Daftra bill marked **PAID** for paid orders (record the payment on the invoice via the
  Daftra API; today invoices are created unpaid with the note "Payments require external
  reconciliation").
- Fix **product matching** (0 of 336 Daftra products match a website SKU) and the
  **wrong code** problem (order export uses the option code like `DEFAULT`, `BLACK`,
  `WP_7295` instead of the product). Plan: add a "Daftra product" mapping per product and
  per option, auto-match exact codes, owner confirms the rest in a mapping screen; Default
  options should use the product's mapping. Consider a fallback: bill lines as plain text
  items when unmapped, so a bill is always produced (but Daftra stock then won't deduct —
  discuss with owner).
- Allow automatic bill issuing (today any item with an option blocks auto-issue, and every
  item has an option).
- COD cash recording in Daftra mode (today `commerce_cod_cash_command` refuses non-built-in
  orders and writes the locked local treasury): mark the order paid on the website and send
  the payment to Daftra instead.
- Dashboard "Order flow" rules (e.g. Paid orders: confirm automatically → AWB + bill; COD:
  review first or automatic).

### Phase 3 — Customer bills
- Bill (Daftra PDF) in My account and order details. A local, never-deployed implementation
  exists ("candidate A": `server/utils/daftraInvoices.js`, `server/api/account/invoices/`,
  `app/pages/account/invoices/`, migration `20261104230000_daftra_customer_invoices.sql`) in
  `/Users/imac/Documents/ELcomputer/daftra-sms-20261104/source` (commit `b782b13`). It was
  built on an older base; port it to the live code.
- Attach the PDF to the order email (Brevo) and add a "Resend bill" button in the
  Dashboard order page. Optional "invoice ready" SMS (binding `invoice_available` exists,
  disabled).
- Then the owner places a real paid test order and expects: SMS, email with PDF, Daftra
  bill (paid), PDC AWB created.

### Phase 4 — COD fee
- 0.5% COD fee on order value when COD is chosen, configurable in the Dashboard, then
  switch it on. (There was earlier Codex work around a COD fee; check
  `customer_orders.payment_fee_amount` and the checkout fee code before building. Also
  re-check "coupon/COD parity", an older open item.)

---

## 3. Production state at the checkpoint (verified read-only ~10:20 UTC)

- Site: https://elcomputer.net — Nuxt 4 / Vue 3 / Tailwind 4 / Nitro, Supabase Postgres
  (RLS), VPS `168.231.104.25` (Hostinger), `storefront.service` (systemd), Caddy.
- Live app release: **`2f24ede840707369`** (source commit `eedffeb`), schema **124**.
  Releases live under `/srv/storefront/releases/<id>` with a `current` symlink.
- Release history today (all verified with the natural monitor run):
  `11f4396cea88df80` Modern product page + photo/switch choices + 12 WordPress link groups
  (02:43) → `da6e96476cba3404` product page restyle + centered heart (07:29) →
  `df81980e4b3d59f0` phone tab bar/categories sheet/sticky filters + first cart (08:13) →
  `2f24ede840707369` cart v2 (savings, chosen options, photo tiles, favorites, undo,
  payment logos) (08:45).
- Settings: product page **Modern**, checkout **Modern**, `erp_mode` **daftra** (owner
  switched at 09:18 UTC), Daftra connected (`elcomputerfortrade.daftra.com`, credential
  revision 1, test passed 09:18:32). An unconfirmed "switch and sync" review from 09:18
  remains in `erp_sync_runs` (harmless).
- Apple Pay: **public for all shoppers** since 08:53 UTC (hosted/redirect via Paymob,
  integration 6038812). The owner's live test order `ORD-[masked]` (EGP 16.37)
  was paid through Apple Pay and verified first. Backup of the old setting:
  `/var/lib/storefront-apple-public/20261107T085303Z/`.
- SMS (Vodafone): **on**, daily cap **200**. Regular worker `storefront-sms.timer` every
  60 s calls `/api/internal/sms/process` with `NUXT_SMS_WORKER_SECRET` (in
  `/etc/storefront/runtime.env`; backup `/var/lib/storefront-sms-regular/20261107T085711Z/`).
  Bindings on: `cod_confirmed`, `prepaid_confirmed`. Capture window restarted 08:57:04 UTC
  (no late SMS for older orders). Old pilot timer disabled (files kept). First real SMS
  sent for COD order `ORD-[masked]` at 09:14 (Vodafone SUBMITTED).
- Email: Brevo, working (`storefront-customer-email.timer`).
- ERP worker (installed 09:32 UTC, backup `/var/lib/storefront-erp-worker/20261107T093211Z/`):
  `storefront-erp.timer` (60 s, sends orders to Daftra) and `storefront-erp-stock.timer`
  (30 min, pulls stock — **owner does not want this; disable in Phase 1**). First stock pull:
  336 Daftra products scanned, 0 matched. Order exports fail safely before any Daftra write
  when an item is unmapped.
- Other timers: `commerce-monitor.timer`, `storefront-pdc-tracking.timer`. All 6 active,
  no failed units. Monitor status WARNING with known codes only
  (`CHECKOUT_OUTCOME_UNVERIFIED`, `OVERDUE_PAYMENT_UNVERIFIED`, `TERMINAL_PAYMENT_UNVERIFIED`).
- **Risk while paused:** in Daftra mode, new orders get **no order email** and **cannot be
  booked with PDC** from the order page (database rules accept only built-in-ERP orders).
  No order had arrived since 09:18 at the checkpoint, so no customer was affected yet.
  The fix is built (release `b678fef5ee11be88`) but not deployed.
- WordPress link groups: 7 held groups reviewed; 5 linked (VT9 PRO, MK-Box, STAR61, Rapoo
  1620/1630, Hero68 HE); laptop stands and G102 left unlinked. Owner then asked all 26
  products of those 7 groups to be **Draft**; done 08:20 via `catalog_bulk_products`
  'draft' (6 changed, 20 already Draft). No WordPress photos are missing (gaps were deleted
  attachments in WordPress).

---

## 4. Exactly where the work stopped

### 4a. Email + booking fix (Daftra mode) — BUILT, NOT DEPLOYED
- Code: branch `daftra-parity`, commit **`0193948`**, git worktree
  `/Users/imac/Documents/ELcomputer/product-modern-20261107/parity` (base `eedffeb`).
- Migration `supabase/migrations/20261107200000_daftra_mode_order_parity.sql`: removes only
  the built-in-ERP owner condition from `private.capture_order_email()`,
  `private.order_email_reason(public.order_email_events)` and
  `private.pdc_order_eligibility(uuid)` (asserts the anchor exists and that no `erp_owner`
  remains).
- App: `server/utils/pdcOrderShipping.js` and `server/api/admin-orders/[id].get.js` no longer
  require `erp_owner === 'built_in'` for staff PDC booking.
- Tests: `tests/daftra-order-parity.test.mjs` 2/2 pass (incl. native DB). Related suites
  (order emails, manual COD, manual COD PDC, policies) give identical results on the fix and
  on live: 86 pass, the same 8 known failures.
- Release workspace `/Users/imac/Documents/ELcomputer/product-modern-20261107/release5`:
  typecheck/build PASS, package PASS, canonical archive PASS, compiled smoke PASS
  (6,760 asset hashes, 19 API checks). Release id **`b678fef5ee11be88`**.
- Not done: `operator.mjs prepare`, `check`, `approve`, `apply`, `verify`.
- The release5 operator was adapted: applies the migration in one transaction between stage
  and cutover (schema 124 → 125), pauses/resumes all 6 timers, accepts public
  `express=[{method:'apple_pay',available:true,experience:'redirect'}]`, excludes the three
  changed functions from the function hash and checks them directly.
- To deploy (only with the owner's go-ahead), from `release5/`, with the env vars in §6:
  `node operator.mjs prepare` → `node operator.mjs check` →
  `node operator.mjs approve "<owner words>"` → `node operator.mjs apply` →
  `node operator.mjs verify` (repeat verify until `..._NATURAL_MON_PASS`).
  Rollback: point `current` back to `releases/2f24ede840707369` and restart (the relaxed
  rules only widen eligibility and may stay).

### 4b. Rest of Phase 1 — CODE READY LOCALLY, NOT DEPLOYED
- Commit **`5d2a325`** on branch `product-modern` in
  `/Users/imac/Documents/ELcomputer/product-modern-20261107/source` (on top of `eedffeb`).
- Migration `20261107210000_shipping_pricing_and_order_parity.sql` contains:
  - the same email/booking parity block (**remove it before release**, because `0193948`
    already carries it; rebase `5d2a325` onto `0193948`);
  - `commerce_shipping_companies.checkout_pricing jsonb` validated by trigger
    `guard_checkout_pricing` (`private.checkout_pricing_valid`);
  - `private.checkout_zone_fee(pricing, governorate)` = ceil(rate × (1+VAT) / step) × step −
    support, floor 0;
  - `private.cod_shipping` now uses the pricing when set (single place that prices every
    checkout/order); `public.checkout_shipping_prices()` for the checkout display;
  - `public.shipping_order_attach_existing_awb(order, admin, awb)`: for AWBs booked in the
    PDC portal, any open order (incl. COD), reference `AWB:<awb>`, sets `label_pending`,
    `awb_verified_at`, provider identity and a `pdc_dispatches` 'created' row so the tracker
    picks it up.
- App changes in `5d2a325`: tracking matches `AWB:` references by AWB only and searches from
  the order date (`server/utils/pdcLookups.js`); manual AWB endpoint uses the new function;
  admin shipping section shows for any open order with a courier; attach-AWB form for any
  open order; 1 kg default weight; Dashboard editor
  `app/components/dashboard/commerce/ShippingZonePricing.vue` +
  `app/utils/shippingZonePricing.js`; checkout uses per-governorate prices
  (`app/utils/deliveryOptions.js`, `server/api/checkout/shipping.get.js`); EN/AR labels
  (`shippingPricing.*`, `beta.attachAwbHelp`).
- Tests: `tests/shipping-zone-pricing.test.mjs` 6/6 pass (incl. native).
- **Must check before deploying `5d2a325`:** a full test run with the native database
  enabled showed 21 failures that did not appear in an earlier run without the native
  database (different baseline). One is intended ("manual PDC AWBs require real packing,
  paid stock and RBAC" — the attach rules were relaxed on purpose). Run the same full suite
  with native DB on live code `eedffeb` and compare before release.

---

## 5. Key findings (facts already established — do not re-derive)

### Tracking / shipping
- Since 27 Oct every order used the courier **"Owner-managed delivery"** (provider `manual`,
  COD collected by PDC through **staff booking**: "Book with PDC" on the order page with a
  measured weight). The website created no AWB for any of those orders, so there is nothing
  to track. The only PDC job is from 23 Oct (`ORD-[masked]`), state `uncertain`,
  "Booking requires REF reconciliation".
- Courier "PDC" (provider `pdc`) is checkout-enabled for **Cairo only** at a test price of
  EGP 1. "Owner-managed delivery" charges EGP 50 in all 27 governorates and is the only one
  with COD at checkout (`shipping.get.js`: `cashAvailable` only for `manual` +
  `cod_collection_enabled`). Do not simply switch checkout to the `pdc` courier or COD
  disappears; put governorate pricing on the courier customers actually use (or redesign).
- Runtime: `NUXT_SHIPPING_LIVE_REQUESTS_ENABLED=false`, `PDC_LIVE_REQUESTS_ENABLED=false`
  (automatic queue booking off); `NUXT_PDC_MANUAL_COD_ENABLED=true` (staff booking allowed);
  tracking requests and worker enabled.
- PDC settings: production base URL `https://clientsapi.pdc-eg.com/api/ClientUsers/V6/`,
  company `280533`, product 40, origin city 10, default weight 1.000 kg, access token and
  webhook secret saved, COD enabled. Tracking policy: enabled, every 15 min, max 100/day,
  20/hour, 2/min, 90 days, 8 failures.
- Tracking requires PDC's row `Ref` to equal the website reference (`ORD-<order uuid>`);
  portal bookings never match. Fixed in `5d2a325` with `AWB:<awb>` references.
- The old manual-AWB function `shipping_order_record_manual_awb` requires paid +
  allocated stock + completed packing + PDC eligibility, so COD orders can't use it.
- City mapping: 382 checkout cities mapped to PDC cities (`shipping_city_mappings`, 30 PDC
  governorate names incl. "Cairo 2", "Giza 2", "Alexandria 2"). 27 checkout governorates in
  `private.delivery_location_governorates`. No tariff saved in the tariff manager (it has no
  checkout reader by design).
- PDC document: `~/Downloads/Customer Courier Integration Test V4.pdf` (text copy:
  `/Users/imac/Documents/ELcomputer/pdc-shipping-finish-20261031/Customer Courier Integration Test V4.private.txt`).
  Tracking uses `POST .../V6/GetShipmentsStatus` (filters: date range, `awBs`, `reFs`).
  Other files: `~/Downloads/PDC UPDATED FILE/` (`Address Mapping.xlsx`, `Status.xlsx`,
  `Templates IDS V3.xlsx`, `ElComputer Proposal.pdf`). No PDF tools are installed; use
  macOS JXA + PDFKit (`osascript -l JavaScript`) to extract text or render pages.

### PDC rate card (ElComputer Proposal.pdf)
- Up to 2 kg: Zone 1 **60**, Zone 2 **65**, Zone 3 **75**, Zone 4 **85**, Zone 5 **95**,
  Zone 6 **105** EGP; additional kg **5**; all + **14% VAT**; **COD fee 0.5%**; failed
  delivery 50% of shipping; volumetric (L×W×H)/5000; insurance optional 0.7%.
- Zones: 1 Cairo, Giza · 2 Administrative Capital, Sub (Cairo & Giza), Alexandria ·
  3 Qalyubia, Port Said, Suez, Ismailia, Gharbia, Menoufia, Daqahlia, Sharqia, Behira,
  Kafr El Sheikh, Damietta · 4 Fayoum, Bani Sweif, Menia, Assiut · 5 Suhag, Qena, Luxor,
  Aswan, Red Sea · 6 Marsa Matruh, New Valley, South Sinai, North Sinai.
- Checkout governorate names map: Cairo, Giza → 1; Alexandria → 2; El Kalioubia, Port
  Said, Suez, Ismailia, Gharbia, Monufia, Dakahlia, Sharqia, Behira, Kafr Alsheikh,
  Damietta → 3; Fayoum, Bani Suif, Menya, Assuit → 4; Sohag, Qena, Luxor, Aswan, Red Sea → 5;
  Matrouh, New Valley, South Sinai, North Sinai → 6.
- Customer price with round-up to 5 and EGP 25 support: **45 / 50 / 65 / 75 / 85 / 95**
  (zones 1–6). Note: suburbs (Zone 2 "Cairo 2"/"Giza 2") are priced as Cairo/Giza at
  governorate level for now.

### Daftra (ERP) — deployed code behavior
- Files: `server/utils/daftra.js`, `server/utils/daftraSync.js`, `server/utils/erpOwnership.js`,
  `server/api/internal/erp/process.post.js` (needs `NUXT_ERP_WORKER_SECRET`, now set),
  `server/api/admin-erp/*`. Doc: `docs/daftra-erp.md`.
- New orders get `erp_owner` = active mode; in Daftra mode a trigger queues `order.export`
  per status. Older built-in orders are never exported (owner wants this).
- Export: resolve each item to a Daftra product by code → find/create client by email →
  create draft invoice (`po_number` = order number, payment fee as a separate line, taxes
  disabled) → issue it when status is processing/shipping/delivered and **no item has a
  variant** (all items have one, so it never auto-issues). Cancelled/returned/refunded →
  manual. Payments are **not** recorded.
- Matching problem: website product SKUs are messy import leftovers (e.g.
  `"7727496691754"`, `Rapoo | NK1900 | Black-AR-EN`, ASINs); 183 of 250 published products
  have a SKU; option codes are `DEFAULT`, colour names or `WP_xxxx`; the export uses the
  option code → nothing matches. 0 of 336 Daftra products matched in the stock pull.
- Four live database functions accepted only built-in orders: `capture_order_email`,
  `order_email_reason`, `pdc_order_eligibility` (fixed in `0193948`, not deployed) and
  `commerce_cod_cash_command` (Phase 2; it also writes `treasury_transactions`, which is
  locked in Daftra mode).
- Tests: local ERP/Daftra checks 47 pass, 2 fail on a stale test reset list (baseline).

### Other facts
- Apple Pay registry lives in `/etc/storefront-feature-policy/apple-availability.env`
  (`NUXT_PAYMOB_INTEGRATION_IDS`, `apple_pay` entry; `customerIds` removed = public).
- SMS uses the newer "transactional bindings" system (`private.sms_tx_bindings`,
  `public.sms_capture_transactional`), with an overlap guard against the legacy
  `sms_order_events` (all legacy events off).
- Owner admin actor (owner role) used for guarded RPCs: `4b31c93f-c852-45c1-9ea6-f25c7f1df384`
  (set `request.jwt.claim.role=service_role` inside the transaction).
- Full test suite baseline on live: 124 failures without native DB (all historical release
  tests); later runs 111. Compare failures by name, not count.

---

## 6. Tools, paths and how to run things

- Repo checkout (docs only, branch `main`, uncommitted doc changes present):
  `/Users/imac/Documents/ELcomputer/ELcomputer`.
- Development source: `/Users/imac/Documents/ELcomputer/product-modern-20261107/source`
  (branch `product-modern`, latest `5d2a325`); worktree `../parity` (branch `daftra-parity`,
  `0193948`). `node_modules` is a symlink to
  `../../checkout-modern-20261107/source/node_modules`.
- Release workspaces: `product-modern-20261107/release` (11f4396…), `release2` (da6e964…),
  `release3` (df81980…), `release4` (2f24ede…, live), `release5` (b678fef…, built only).
  Each has `build.mjs`, `package.mjs` (merges predecessor assets), `canonical.py`,
  `qualify.mjs` (offline compiled smoke), `operator.mjs` + `remote.py` (guarded install).
  New release = copy the latest scripts, swap commit / predecessor / kind / stage names.
  Operators must pause the 6 current timers and accept public Apple Pay in health checks.
- Local preview: `product-modern-20261107/preview` + `restart-preview.sh` (port 3456,
  public anon data, no service key → some 500s are expected). Screenshot scripts:
  `shoot.mjs`, `mobile/views.mjs`, `mobile/cart-views.mjs`, `mobile/audit.mjs` (GET only).
- Ops scripts from today: `/Users/imac/Documents/ELcomputer/order-flow-20261107/`
  (`apple-public.py`, `sms-db.mjs`, `sms-server.py`, `sms-cap.mjs`, `erp-server.py`, many
  read-only `*-read.mjs`). WordPress/links: `product-modern-20261107/audit/`, `links2/`
  (`families2.private.json`, `applied.json`, `drafted.json`). Photo check:
  `/Users/imac/Documents/ELcomputer/product-photos-20261107/`.
- Node: `/Users/imac/Documents/ELcomputer/procurement-postgrest-correction-20261018/tools/node-v22.23.1-darwin-x64/bin/node`
- Database env (production DB helper and native tests):
  `EMAIL_REVIEW_PG_BIN=/Users/imac/Documents/ELcomputer/production-backup-tools/postgresql-17.11/bin`
  `EMAIL_REVIEW_PG_DRIVER=/Users/imac/Documents/ELcomputer/pdc-tracking-20261031/source/node_modules/pg/lib/index.js`
- DB helper: `import {target,databaseTools,source} from '<...>/ELcomputer/logs/p0-merchant-risk-retry-20261105/ops/common.mjs'`;
  `db=await (await databaseTools(source)).connect(target)` (read-only by default;
  `{readOnly:false}` to write). Always `begin isolation level repeatable read read only`
  for reads.
- SSH (read-only checks or guarded scripts): `ssh -T -o BatchMode=yes -o IdentitiesOnly=yes
  -o StrictHostKeyChecking=yes -o UserKnownHostsFile=/Users/imac/Documents/ELcomputer/actual-vps-reinstall-preparation-20261020/fresh-known-hosts
  -i /Users/imac/.ssh/elcomputer_wordpress_migration root@168.231.104.25 'python3 -I -S -B -' < script.py`
- Playwright: `COD_REVIEW_PLAYWRIGHT=/Users/imac/Documents/ELcomputer/homepage-direct-cart-20261028/browser-tools/node_modules/playwright/index.mjs` (channel chrome).
- zsh does not word-split `$VAR`; list test files explicitly or use `"tests/*.test.mjs"`.
- Never decrypt archives in a visible terminal; never print credentials; never run
  WordPress/PHP; never request old.elcomputer.net.

---

## 7. Resume checklist (when the owner says continue)

1. Re-check production read-only (release, timers, monitor, orders since 09:18 and whether
   they got emails).
2. With the owner's go-ahead, deploy release `b678fef5ee11be88` (§4a). If orders arrived in
   Daftra mode before the fix, queue their missed order emails.
3. Rebase `5d2a325` onto `0193948`, drop the duplicate parity block, compare the full native
   test suite against live, then build/qualify/deploy the rest of Phase 1.
4. After Phase 1 deploy: set governorate pricing (rate card above, VAT 14, round 5, support
   25) on the checkout courier; decide with the owner how the courier is named/used
   (COD only works with the `manual` courier today); disable `storefront-erp-stock.timer`;
   attach portal AWBs for open orders (ask the owner for the AWB numbers of real orders);
   verify tracking and the customer order page.
5. Report Phase 1 to the owner and wait for confirmation before Phase 2.
6. Then Phase 2, Phase 3 (owner's real test order), Phase 4, and later the database/backend
   review (`OWNER-DB-REVIEW-01`).

### Open questions for the owner
- Which real orders already have AWBs booked in the PDC portal (AWB numbers)?
- Keep the customer-facing courier name "Owner-managed delivery" or rename (e.g. "PDC")?
- For unmapped products in a Daftra bill: plain text lines (bill always created, no Daftra
  stock deduction) or block until mapped?
- Which payment methods count as "paid" for auto-flow: card, Apple Pay, InstaPay after
  verification (and bank transfer)?
