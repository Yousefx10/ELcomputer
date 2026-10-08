# Current local extension: After-Sales Claims Core, 2026-10-08

Stage 1 Claims now consume the retained purchased warranty terms and immutable policy archive, with separate Return/Warranty admission, quantity/duplicate guards, private evidence, review/history and recorded decisions. Historical unknown and purchased draft/disabled policies remain unavailable; no speculative backfill or current-product inference. Customer serials are unverified until audited staff review; no QR/inventory ownership is invented. Current policy edits cannot rewrite prior purchased rights or Claims admission context.

**Local-only/unapplied** `20261008120000_after_sales_claims_core.sql`. No production access/migration/deployment/activation, PDC reverse shipping, Claim SMS/email, financial execution or inventory action. Earlier production/implementation entries below are historical checkpoints. Full audit, schema, workflow, validation and remaining boundaries: [after-sales-claims.md](after-sales-claims.md). STOP at Claims Core.

# Warranty + after-sales policy foundations — production deployment, 2026-10-07 (verified 2026-10-08)

Deployed source **`73c9e11eed3f1c3fe86d751eb2ae0dc08dd4c520`** from clean synced `main`, containing `abf9347` and `73c9e11`. No feature implementation changes were made during this release. The earlier local-only records below are historical.

- Applied only **`20261007120000_warranty_entitlements.sql`** and **`20261007160000_after_sales_policy.sql`**, in order. All **63** repository/remote versions **and names** match; no pending, remote-only or unexplained migration. Reviewed source SHA-256: warranty `ba999c03204557d1130440ed32dfefeb661d59d0db0df3bbb2ab1973f5343b52`; after-sales `24f40ba0968842fc801e4d7aff2af473c6b958d31b671d6c0c52db8a630a88e5`. The CLI local Docker catalog-cache warning was non-fatal: independent history/schema/data/API verification passed.
- All **30** business/configuration fingerprints match before migration, after migration and final verification: **91 products/91 variants, 9 orders/13 items**, 3 customer profiles/3 staff, 100 serialized units, 382 cities/32 mappings, and existing payment/ERP/chat/NPS/settings/SMS records. All **13 historical items retain NULL warranty terms/provenance/policy references**. All 91 products remain deliberately **unconfigured**, not fabricated no-warranty. No historical backfill, current order/status/payment change, synthetic order, shipment or messaging record.
- Production policies remain **draft/unconfigured and disabled**, global revision **1**, delivery basis, empty explicit fallback lists, Cairo timezone, no resolutions. Editable 14-day return seed retained without imposing it on historical purchases. **Seven bilingual reasons**, no category/product overrides, **zero policy versions**. No staff policy save or business-value adjustment was performed. Existing PDC and all seven Order/PDC SMS controls/templates remain OFF; zero sendable intents/batches/messages/attempts, with the one preexisting suppressed Order SMS intent preserved.
- Native read-only verification: **3 private RLS tables / 18 browser-denied functions / 7 enabled triggers**, validated constraints, service-only canonical checkout and private policy RPCs, 187 preexisting function bodies preserved (checkout/preorder bodies retained under the warranty wrapper names; reset-plan recognition deliberately extended). Existing ERP stock/RLS storefront projection retains public stock and now exposes structured warranty fields. **10** calendar/date cases pass: month-end, leap year, exclusive Cairo boundary, not-started, unavailable invoice/delivery, configured fallback order and DST day windows. No invoice source was invented. All historical eligibility remains unknown.
- Fresh pre-release validation: **484 full-suite passes / one existing optional native concurrency skip**, **221 focused passes** including the 52 warranty/after-sales cases and account/order/payment/preorder/PDC/SMS regressions; typecheck, build, diff and guarded preflight passed. Existing ERP import/source-map/chunk/BigInt build warnings remain. Local fixture evidence is distinct from production authentication.
- Released through **`env -u DEBUG npm run deploy`**. Only **`new-elcomputer`** restarted once (**41 → 42**), online under Node **22.23.1**, expected cwd/entry/fork mode/internal **3001**. All **719** output file/symlink entries match the guarded local build. Runtime configuration fingerprint and server error-log bytes/hash are unchanged; **119** public files scanned with zero private-value exposure. No environment upload/change, Nginx/firewall change or unrelated PM2/site action.
- Rollback backup: **`/home/newelcomputer/htdocs/new.elcomputer.net/.output-deploy-backup-20261007-204401-63723`**, readable; all **712** prior output entries match the pre-release manifest. Backup retained, rollback unused. If application rollback is later required, use the guarded helper and retain these additive migrations; no destructive schema reversal is proposed.
- Production acceptance: **137 HTTP assertions / 57 requests**, **208 browser matrix states / 25 screenshots**, plus **10 actual-cart/privacy assertions**. Public home/product/warranty/cart, actual local cart persistence, checkout/login/account/orders and Dashboard/product/settings/category/product-policy/PDC/SMS guards, Live Chat open/close without messages, EN/AR/RTL, 1440/390px, Light/Dark/System and OS transitions pass. Browser errors/private JSON exposure/provider attempts/commerce writes: **zero**. Probes were corrected to actual Live Chat selectors, button-label capitalization, Vue mount readiness and asynchronous cart hydration/restoration; the application did not require a code change.
- **Authenticated production admin/customer interiors and role-specific interactions: NOT VERIFIED.** No safe established session was provided or manufactured. Actual owned-order rendering, foreign-customer access and staff policy save/reload remain separate authenticated acceptance; real invoice/delivery/provider transactions and independent native concurrency are unverified. Anonymous guards, schema/native reads and isolated tests do not substitute for that acceptance.
- **Warranty Claims: NOT PRESENT. Return Claims: NOT PRESENT. PDC reverse shipping: NOT PRESENT. Claim SMS/email: NOT CONNECTED.** No real PDC/Vodafone call, real SMS, valid worker execution, scheduler/webhook registration or provider activation. Remaining work: approve real business rules/date/serial evidence and authenticated acceptance, then separately authorize Claims lifecycle/uploads/manual review/resolution execution and any later shipping/notifications. **STOP after deployment verification.**

Evidence: `/tmp/elcomputer-warranty-release-20261007/` contains migration identity/source/data/security/calendar checks, fresh validation, guarded release/runtime/output/backup comparisons and production HTTP/browser results. It records hashes/counts/public metadata, not credentials or customer values. Deployment documentation is committed/pushed separately through the established main workflow.

# Current extension: after-sales policy foundation, 2026-10-07

The duration/snapshot foundation below is retained as the `abf9347` implementation record. Its earlier “no expiry/start policy” statements describe that checkpoint. The additive local extension now provides Settings-managed warranty/return basis and explicit fallback rules, immutable purchased policy versions, server calendar expiry/eligibility, public structured duration, and My Account dates/status when authoritative. Historical missing policy remains unknown. Both migrations are unapplied and neither feature is deployed.

See [after-sales-policy.md](after-sales-policy.md) for current architecture, date sources/boundaries, RBAC/audits, reset retention, validation and the complete 32-point report. No Claims, PDC reverse shipments, SMS or email work was added.

# Warranty entitlement foundation — local implementation, 2026-10-07

Scope: structured product warranty and immutable purchase snapshots shown in the existing My Account order detail. No Warranty Claims, Returns, reverse shipping, notifications, NPS, OTP, production migration or deployment.

## Audit and existing data

Reviewed `AGENTS.md`, current state/handoff, product specification/catalog and preorder/account records, `docs/order-sms.md`, `docs/pdc-tracking-report.md`, the schema backup and all 61 preceding migrations, real product forms/handlers, checkout transactions, account routes, locale/theme utilities, permissions/RLS/audits and tests.

The only existing warranty content is the shared `specification_definitions.key = 'warranty'` entry (a free-text `product_specifications.value`) and the Help Center Warranty category. Neither supplies structured duration, a provider policy, a purchase snapshot, or reliable warranty dates. These existing descriptions/categories remain in place. The new structured commercial fields extend the existing products/order items; no parallel warranty table or settings application is created. Staff see a short explanation that specifications are descriptive and purchased coverage is configured here. Free text is never parsed into entitlement.

Orders use `customer_orders` and `customer_order_items`. Product title/slug/image, variant name/code/SKU/color and numeric price snapshots already live on the item. Canonical normal checkout locks authoritative products/variants, validates price/coupons/stock, assigns serialized inventory, and uses customer/cart idempotency. Preorders have their own authoritative reservation/payment snapshots and defer stock assignment. The current ERP and Order SMS wrappers remain in the chain.

Order placement `created_at`, actual `paid_at`, packing completion and PDC event/observation timestamps exist. Manual ERP/procurement invoice dates do not establish a website-order warranty policy. There is no documented authoritative warranty start rule, reliable generic invoice-linked start, or warranty-specific delivery anchor. PDC delivery observations do not imply such a rule. Historical production counts in earlier documents are provenance, not live observations in this task: no production database was accessed and no credentials were sought.

## Product configuration and variants

| Product column | Meaning |
| --- | --- |
| `warranty_status` | `unknown` (unconfigured), `none` (explicit no warranty), `included` |
| `warranty_duration_value` | Positive integer when included; otherwise NULL |
| `warranty_duration_unit` | `months` or `years` when included; otherwise NULL |

Existing products default to **unknown**, never fabricated no-warranty. New forms start unconfigured so staff must make a deliberate business choice. Month values 1–120 and year values 1–10 are accepted. This is an input sanity bound, not an eligibility/expiry policy. There are no hardcoded duration choices. Server validation and SQL CHECKs reject invalid status/unit, null included duration/unit, negative/zero/fractional/unbounded/malformed inputs and irrelevant duration on none/unknown. An older product-edit caller that omits the entire warranty group preserves existing configuration. Product rollback after a downstream variant error includes warranty fields.

Variants have model/color/SKU, copied price/cost and stock identity, but the actual storefront/normal/preorder sale price and selling terms are product-level. The variant editor does not expose independent customer terms. Warranty therefore stays on the product; every variant receives the parent terms while retaining its purchased variant/SKU snapshots. No variant override layer is added.

Both existing add/edit forms include the same translated warranty fieldset, including legacy aggregate-stock product editing. Controls obey existing `products.add`/`products.edit` access and saving states. Duration/unit fields appear only for included warranty; switching to none/unknown clears them. EN/AR/RTL and the existing theme palette are used. No provider or free-text policy field is invented.

## Purchase-time snapshot and immutability

| Order-item column | Meaning |
| --- | --- |
| `warranty_status` | Purchased unknown/none/included; NULL for absent historical/import snapshot |
| `warranty_duration_value`, `warranty_duration_unit` | Purchased structured duration, never current product terms |
| `warranty_start_basis` | `unresolved` for included warranty; otherwise NULL |
| `warranty_snapshot_at` | Capture provenance only; **not** warranty start |

Migration `20261007120000_warranty_entitlements.sql` adds three product and five item columns, two constrained term shapes, comments, two trigger functions and thin wrappers for the existing normal/preorder checkout RPCs. It adds no table/index/RLS policy and updates no historical items/specifications/provider settings. The existing order-item lookup index is sufficient.

The wrappers rename the prior entry functions to `commerce_create_customer_order_before_warranty` and `commerce_create_preorder_before_warranty`, preserving their bodies. They open a transaction-local capture scope, call the existing transaction, restore scope and return its unchanged JSON. The item INSERT trigger discards supplied warranty values, reads the locked product, snapshots its validated terms and records capture time. Normal and preorder paths both use this one capture function. Failures roll back scope/order/items/stock/SMS together; cart retries return old items without refreshing terms. Service role can execute only the canonical wrappers, not the bypass implementations; browser roles cannot execute either.

The UPDATE guard rejects any change to captured terms/provenance, including NULL historical terms, even from ordinary trusted service writes. It also rejects item/order/product/variant reassignment. Existing product/variant `ON DELETE SET NULL` links can still detach; textual identity and purchased terms remain. Existing authorized order deletion/reset behavior remains; the feature does not introduce permanent retention of deleted orders.

An insert/import/append **outside canonical checkout** is forced to all-NULL warranty fields. It cannot copy today's terms onto an old purchase or inject a claimed historical snapshot. No speculative backfill is performed. A future evidence-based correction/import would require a separately reviewed provenance workflow; there is no customer or staff warranty-correction endpoint here.

## Start policy, expiry and customer presentation

`app/utils/warranty.js` centralizes configuration validation, input bounds, duration localization keys and snapshot interpretation. `warrantyEntitlement(item)` consumes the item alone; it never reads product/specification data or infers dates from order/payment/shipping fields.

| Purchased information | `hasWarranty` | Eligibility status | Presentation |
| --- | --- | --- | --- |
| Included, valid duration, unresolved start | true | unknown | Purchased duration |
| Explicit none | false | not_applicable | No warranty |
| Historical, unconfigured or malformed | null | unknown | Warranty information unavailable for this purchase |

Included warranty has known purchased coverage but unknown time-based eligibility. It is **not** labelled active or expired. `startDate` and `expiryDate` are always NULL in this foundation. `unresolved` is deliberately the only accepted included-start token; later policy work must explicitly extend the database constraint and domain helper. Staff/browser values cannot choose an order/payment/invoice/delivery basis.

No expiry arithmetic is implemented. Before automated expiry enforcement, the business must approve the start basis, authoritative date source, timezone, calendar month/year anniversary handling and expiry boundary semantics. Implement calendar arithmetic and month-end/leap-year/timezone tests at that point, not a fixed 365-day/24-hour approximation. Existing date utilities continue formatting real order/PDC dates unchanged.

`AccountItemWarranty` appears below quantity/price for every item in the existing `/account/orders/[id]` detail, for both account styles. English/Arabic distinguish included duration, none and unavailable historical information. A neutral shield is used for unknown/none and a checked shield for known coverage. No exact expiry, claim button, separate Warranty page or return-window policy is added. Existing Orders cards, Order again, support, payment, progress and delivery behavior remain.

## RBAC, RLS and audit

Existing POST/PATCH product APIs retain real active staff authentication and `products.add`/`products.edit` guards. Existing product RLS also protects direct browser updates. Item SELECT remains scoped through the owned order; there is no item INSERT/UPDATE policy for customers. The account API checks authenticated active customer ownership before reading items/shipment data, returns 404 for another customer's order, projects only selected fields, and uses `Cache-Control: private, no-store`.

Product create/update audit metadata is extended through existing `useAdminLogs`/`products.create`/`products.update`: normalized created terms, or prior/new terms on edits. No duplicate logger is introduced. This inherits the existing **best-effort browser audit**: it is not an atomic database change ledger, and direct authorized database edits do not become newly audited by this feature.

## Validation and evidence

Node 24.16.0. Production access, merchant requests, credential changes and real accounts/orders/shipments/messages are excluded.

- `tests/warranty.test.mjs`: structured months/years/none/unknown, strict malformed inputs and bounds, preserved older callers/rollback fields, historical unknown, no catalog fallback/no guessed dates/expiry/status, EN/AR duration/error labels.
- `tests/warranty-database.test.mjs`: actual backup + all migrations in disposable PGlite, historical data/config/ledger preservation, every preexisting function body preserved, SQL NULL/constraint cases, forged browser values, 12→24 months and removal, idempotency, mixed items, normal/preorder/serialized SKU and stock behavior, import/backfill denial, transactional rollback/scope cleanup, service grants, immutable identity/terms, ownership/customer write denial, product RBAC and catalog deletion.
- `tests/warranty-api.test.mjs`: actual H3 routes **and actual customer/staff guards**, isolated Auth token transport/SQL, POST/PATCH permissions, create/edit persistence, invalid input rejection, older-caller preservation, variant failure compensation, owner/foreign/anonymous/inactive reads, private/no-store, immutable purchased projection and unchanged no-shipment state.
- Full suite: **461 passed, one existing optional native PostgreSQL concurrency test skipped, zero failures**, with the requested `node --test tests/*.test.mjs` final run and a separate `node --test --test-concurrency=1 tests/*.test.mjs` run. The first default-concurrency run had one existing Paymob 40ms local-fetch timeout contention failure (expected server call not reached); no payment code/test was changed. Both the sequential run and final default-concurrency rerun passed that case.
- Focused warranty: **29/29** included in the full run; standalone warranty **29/29** (domain/database subset **22/22**). `npm run typecheck`, `npm run build`, and `git diff --check` passed. Inherited duplicate ERP import, source-map/chunk-size and preorder BigInt-target build warnings remain. No warranty error was introduced.
- Browser harness `scripts/warranty-browser.mjs` compiles actual product create/edit/public, checkout, Orders/detail/progress and warranty components with built application CSS. Only browser Auth/Supabase/API and unrelated media/SEO/specification/review widgets are fixtures. It covers save/reload/audit terms, product changes/removal preserving account display, legacy aggregate editing, permission-disabled fields, Order again, product cart add, checkout submission without warranty values, historical none-vs-unknown, EN/AR/RTL, 1440/390px, Light/Dark/System, OS preference changes, contrast, errors and external requests.
- `scripts/pdc-tracking-browser.mjs` only gains registration of the new account child for its existing isolated tracking regression harness. Tracking/provider logic is not changed. Existing SMS harness remains unchanged.

Evidence is under `/tmp/elcomputer-warranty-review/` and `/tmp/elcomputer-warranty-*.log`; screenshots/reports are ephemeral local evidence, not committed catalog content. PGlite is real PostgreSQL-compatible SQL in one disposable process, not independent native concurrent sessions. Auth verification and Supabase transports are fixtures. Real signed-in Supabase/browser persistence and production acceptance remain **not verified**; no test account/session was manufactured.

## Files changed

- `PROJECT_STATE.md`, `CODEX_HANDOFF.md`, `docs/warranty.md`
- `app/utils/warranty.js`, `app/utils/uiMessageKeys.json`
- `app/components/dashboard/products/WarrantyFields.vue`, `app/components/account/ItemWarranty.vue`
- `app/pages/dashboard/products/add.vue`, `app/pages/dashboard/products/edit/[id].vue`, `app/pages/account/orders/[id].vue`
- `server/utils/adminProducts.js`, `server/api/admin-products/[id].patch.js`, `server/api/account/orders/[id].get.js`
- `i18n/locales/en.json`, `i18n/locales/ar.json`
- `supabase/migrations/20261007120000_warranty_entitlements.sql`
- `tests/warranty.test.mjs`, `tests/warranty-database.test.mjs`, `tests/warranty-api.test.mjs`
- `scripts/warranty-browser.mjs`, `scripts/pdc-tracking-browser.mjs`

## Requested final report

1. **Audit:** Repository/schema/transaction/catalog/account/date/i18n/RLS/audit/tests reviewed; no production credentials/access attempted.
2. **Existing warranty:** Descriptive warranty specification and Help Center category only; no trustworthy historical structured entitlement/start policy discovered.
3. **Product model:** Existing product extended with unknown/none/included and bounded integer months/years.
4. **Variants:** Product-level terms match actual storefront/preorder commercial ownership; chosen model/SKU snapshots remain.
5. **Item snapshot:** Five scalar snapshot/provenance columns, authoritative transactional capture, immutable updates.
6. **History:** NULL and unavailable; no speculative backfill/current-product copy.
7. **Start policy:** Unresolved, not authoritative. No order/payment/invoice/delivery basis invented.
8. **Expiry:** No calculated start/end, active or expired result. Calendar enforcement awaits approved policy.
9. **Dashboard:** Existing create/edit, EN/AR/RTL/themes, structured validation, legacy products supported.
10. **My Account:** Existing detail shows per-item purchased duration/none/unavailable; no separate page/claim action.
11. **Files:** 21 files listed above, including documentation/test/harness files.
12. **Schema:** One additive unapplied migration; 62 local files including 61 preceding versions. No new table/index/policy or destructive rewrite.
13. **RBAC/RLS:** Existing products.add/edit, order-owner reads, no customer writes, service-only canonical checkout.
14. **Audit:** Existing product audit metadata includes warranty before/after; inherited best-effort limitation remains.
15. **Tests:** 29 focused domain/database/API tests including nested cases.
16. **Full validation:** 461 passes/one existing optional skip, typecheck/build/diff passed; default-concurrency timing caveat above.
17. **Browser:** Warranty/commerce **432 assertions/72 screenshots**, PDC **495/48**, unchanged SMS **543/96**. EN/AR/RTL/mobile/desktop/Light/Dark/System, no errors/external requests; real signed-in Supabase persistence/production acceptance not claimed.
18. **Order/payment:** Full regressions pass; original checkout/ERP/payment/SMS implementations preserved; normal/preorder/serialized capture tested.
19. **PDC:** Full tracking regressions pass; no webhook/shipment/status/label/provider logic change or real calls.
20. **SMS:** Order/PDC/central SMS suite preserved; no warranty consumer/template/control/provider activation.
21. **Production migration:** Not applied; disposable local SQL only.
22. **Production deployment:** Not deployed; VPS/configuration/Supabase production untouched.
23. **Before Claims:** Approve business start/source/provider terms, reliable dates/expiry semantics, historical-evidence/manual-review policy, then separately scope claim authorization/lifecycle and authenticated acceptance. Deployment belongs to the separately authorized computer; review migration parity and release matching code together there.
24. **Recommended next feature:** Separately scoped Warranty Claims, after entitlement/start-policy acceptance. Returns remain separate. Do not start either in this task.

```text
WARRANTY FOUNDATION IMPLEMENTED: YES
PRODUCT WARRANTY DASHBOARD-MANAGED: YES
WARRANTY SNAPSHOTTED AT PURCHASE: YES
HISTORICAL ORDERS SPECULATIVELY BACKFILLED: NO
OLD ORDERS CHANGE WHEN PRODUCT WARRANTY CHANGES: NO
MY ACCOUNT WARRANTY DISPLAY IMPLEMENTED: YES
WARRANTY START POLICY AUTHORITATIVE: NO
WARRANTY CLAIM WORKFLOW IMPLEMENTED: NO
RETURNS WORKFLOW IMPLEMENTED: NO
PDC REVERSE SHIPPING CONNECTED: NO
WARRANTY SMS CONNECTED: NO
PRODUCTION MIGRATION APPLIED: NO
PRODUCTION DEPLOYED: NO
```

Implementation stops at Warranty Entitlement. Transfer through origin/main for the established two-computer workflow; deployment/production migration are separate authorized work.
