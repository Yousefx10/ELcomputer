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

## Production deployment — requested 24-point report

1. Synced branch/HEAD: clean main at 73c9e11; normal fetch/fast-forward workflow.
2. Warranty commit: abf9347 is an ancestor of the deployed source.
3. After-sales commit: 73c9e11 is the deployed source.
4. Pre-deployment validation: 484 full passes/one optional skip, 221 focused, typecheck/build/diff/preflight passed.
5. Warranty migration: applied successfully, original implementations preserved under wrappers.
6. Policy migration: applied successfully, constrained private tables/guards/defaults/view/reset integration verified.
7. Supabase alignment: exactly 63 matching versions and names, zero pending/remote-only.
8. Two-computer consistency: current main identities match linked history; no reset to an old feature commit.
9. Historical integrity: all 30 fingerprints preserved; all 13 purchased items still NULL, all 91 products unknown.
10. Guarded deployment: normal .output-only backup/restart/health workflow succeeded.
11. Deployed source: 73c9e11eed3f1c3fe86d751eb2ae0dc08dd4c520; later documentation does not imply another app release.
12. PM2/health: only new-elcomputer restarted 41 → 42; online, expected Node/cwd/entry/3001, error log unchanged.
13. Product warranty: real EN/AR SSR/browser unconfigured state safely displayed; included/none cases covered by isolated tests, no production catalog edits.
14. My Account: protection verified; historical SQL unknowns preserved. Signed-in purchased item UI NOT VERIFIED.
15. After-sales Dashboard: routes/API guards deployed and tested; actual authenticated interiors NOT VERIFIED.
16. Defaults: global revision 1, both families draft/unconfigured/disabled; seed values unchanged, no overrides/versions.
17. Dates/expiry: ten native calendar/fallback cases, unavailable invoice retained; no expiry fabricated for history.
18. Returns: typed model/seven reasons deployed; no customer Claim workflow enabled; staff UI acceptance pending.
19. RBAC/RLS: 3 private RLS tables, 18 browser-denied functions, real unauthenticated server denials; role-bound authenticated UX pending.
20. Authenticated acceptance: NOT VERIFIED; no established safe session, no account/order/session manufactured.
21. Regressions: focused/full order, checkout/payment, preorder, account, PDC, SMS and Live Chat tests pass; anonymous production routes/cart/Live Chat/localization/themes pass.
22. External APIs: no real PDC/Vodafone calls, SMS or claim-email action; public website/Supabase verification only.
23. Backup: recorded above, readable and exact prior 712-entry output; rollback unused.
24. Before Claims: business-rule approval, trusted dates/serial evidence and real authenticated acceptance; separately scoped workflow/integrations.

```text
WARRANTY FOUNDATION CODE DEPLOYED: YES
WARRANTY MIGRATION APPLIED: YES
AFTER SALES POLICY CODE DEPLOYED: YES
AFTER SALES POLICY MIGRATION APPLIED: YES
LOCAL/REMOTE SUPABASE MIGRATIONS ALIGNED: YES
HISTORICAL WARRANTY ENTITLEMENTS FABRICATED: NO
HISTORICAL POLICY ENTITLEMENTS FABRICATED: NO
GLOBAL WARRANTY POLICY DASHBOARD-MANAGED: YES
GLOBAL RETURN POLICY DASHBOARD-MANAGED: YES
CATEGORY OVERRIDES DEPLOYED: YES
PRODUCT OVERRIDES DEPLOYED: YES
WARRANTY CLAIM WORKFLOW IMPLEMENTED: NO
RETURN CLAIM WORKFLOW IMPLEMENTED: NO
PDC REVERSE SHIPPING CONNECTED: NO
CLAIM SMS CONNECTED: NO
CLAIM EMAIL CONNECTED: NO
REAL PDC PRODUCTION API CALLED: NO
REAL VODAFONE API CALLED: NO
REAL SMS SENT: NO
```

# After-sales policy foundation — local implementation, 2026-10-07

Extends Warranty Entitlement Foundation `abf9347`. One feature: typed warranty/return policy administration and eligibility preview. No Claims, reverse shipments, uploads, notifications, provider activation, production migration or deployment.

## Audit and reuse

Read AGENTS/state/handoff/warranty, catalog/specification/preorder/account/order, PDC tracking and Order/PDC SMS documentation; inspected schema/migrations, actual product/category/variant relationships, checkout/ERP/SMS wrappers, dates, settings/navigation, Help Center, serialized inventory, RBAC/RLS, logging, translations and tests. This computer did not access production or obtain/infer/copy credentials. Earlier production records in project documentation were not refreshed.

Each product has one category; variants inherit product commercial terms. Existing Warranty specifications and Help Center Warranty/Returns categories contain descriptive content, not authoritative structured rules. Existing staff commerce returns concern inventory/manual sales. No reusable customer policy model or generic website invoice-date adapter exists. Product duration and immutable purchased duration from `abf9347` remain the commercial source of truth.

The existing Settings page adds `tab=after-sales`; its child has Warranty, Returns, Category, Product and Reasons tabs. Existing category rows and product editing link to their selected scope. It uses existing Settings permissions, authenticated server requests, Dashboard appearance, EN/AR labels and RTL. This is not another settings application. Fields are explicit; browser metadata only defines controls, never effective-policy merging, eligibility or expiry.

## Model and precedence

| Private table | Purpose |
| --- | --- |
| `after_sales_policies` | One global row; optional category/product rows; constrained typed scalar/list fields; per-row revision |
| `after_sales_return_reasons` | Stable key, bilingual labels, enabled/order, fault and bounded overrides; revision |
| `after_sales_policy_versions` | Immutable effective entitlement rules; random ID, revision provenance/content fingerprint, capture time |

Global → category → product, independently per field. NULL on a scoped field means inheritance; false, empty arrays and explicit enum values are real overrides. Product resolution derives its actual category from SQL, ignoring caller-supplied alternative categories. The editor shows parent values while inheriting and can restore inheritance. Its effective preview is the server's **saved** result; unsaved forms do not calculate a second policy. Catalog selection uses bounded search and returns direct linked item labels even beyond the first 50 results.

Seeded global values are **draft**, separately unconfigured for warranty/returns: delivery basis, no fallbacks, claims and returns disabled; no selected warranty resolutions; evidence/vendor serial optional; shipping manual; editable 14-day returns; opened manual; packaging preferred; `Africa/Cairo`. Only saving a global family configures that family for future purchases. Scoped overrides cannot set either configured flag. Staff must choose/approve actual business rules; these seeds do not invent historical rights or activate a workflow.

Warranty: enablement, delivery/invoice/payment/order basis, explicitly ordered fallback list, repair/replacement/refund/service-center list, disabled/optional/required evidence and vendor serial, ELcomputer/customer/reason/manual shipping. **No duplicated warranty duration.**

Returns: enablement, whole days 1–365, typed basis/ordered fallbacks, opened allowed/not-allowed/reason/manual, packaging not-required/preferred/required, evidence and shipping. Seven editable bilingual reason examples are seeded with neutral fault and no override; they do not establish returns while the global family is draft/disabled. Keys are immutable in editing, maximum 50 reasons, order 0–10000; disabling replaces deletion. Shipping overrides allow ELcomputer/customer/manual, opened overrides allowed/not-allowed/manual, and evidence overrides disabled/optional/required. No expressions or arbitrary text identifiers drive decisions.

## Purchase rights and provenance

`customer_order_items.after_sales_policy_version_id` is the **only** new purchased-policy field. It references a deduplicated effective version; the existing five warranty snapshot fields stay unchanged. Materialized rules include configured flags, warranty/return rules, timezone, and the bounded reason catalog with labels/availability/behavior. They exclude warranty duration, staff identities, current settings UI/runtime configuration, provider credentials, order/customer facts and mutable delivery dates. Reason behavior/enablement can change eligibility, so its purchase version is retained too.

The resolver locks global, then applicable category/product rows. Scoped writes first acquire their catalog FK parent lock to match checkout, then all policy/reason writes acquire global before policy rows. Checkout holds shared locks through its existing transaction; it cannot capture mixed revisions. Reason edits increment global revision. Version identity includes the locked scope revision tuple plus a content fingerprint; the exact JSON equality guard detects conflicts. The fingerprint is for stable deduplication, not authentication. Recreated catalog override revisions cannot reuse different old rules.

Capture runs only inside the existing trusted normal/preorder warranty capture scope, discarding supplied references. The original checkout/ERP/SMS and foundation capture bodies are untouched. Idempotent cart retries retain existing items/references. Imports/appends and pre-migration items stay NULL; no backfill. UPDATE guards deny attaching policy to old NULLs or swapping any purchased reference. Version UPDATE/DELETE/TRUNCATE are blocked. Catalog edits/deletion cannot recompute purchased rules from current products.

Reset integration extends the existing manifest's explicit recognition and FK checks. Global configuration, reasons and immutable version archives are deliberately retained, including full reset; category/product overrides cascade only when those catalog scopes are erased. Current order reset behavior is unchanged. The full-reset UI states this retention. The existing owner authorization, dependency checks, locks, suspension/restoration and audit lifecycle remain. Tests prove catalog reset preserves items with NULL catalog FK and their versions, and full reset retains policies/archives while erasing its authorized orders. No reset was run outside disposable tests.

## Authoritative dates and boundaries

All period arithmetic lives in `after_sales_period` in SQL, invoked by the server domain boundary. There is no client elapsed-day approximation or runtime hardcoded start rule.

| Basis | Source / missing behavior |
| --- | --- |
| Order | `customer_orders.created_at` |
| Payment | Real `paid_at`, within placement → current observation; no cash-is-paid or first-payment inference |
| Delivery | Earliest dated, processed nonlegacy `delivered` event linked to the order's unique PDC job with matching provider/AWB/REF; bounded by placement → observation |
| Invoice | Unavailable until a trustworthy website-order invoice adapter exists |

A broad completed/delivered order status, partial delivery, receive/observation timestamp, legacy raw state, undated event, foreign AWB/REF, unprocessed record, current mapping edit or provider lookup does not establish delivery. No PDC request, reconciliation or mutation is initiated by policy reads. Pickup/manual fulfillment has no trustworthy handover timestamp adapter; missing delivery stays pending or uses a configured fallback. The existing shipment timeline remains unchanged.

Primary date wins when present. Only the explicitly stored fallback order is considered when missing; an empty list leaves the period unknown. Missing delivery renders “Warranty begins after delivery”; invoice/other unavailable or historical/draft policy renders “Warranty start date unavailable.” Unconfigured policies and historical references never inherit today's rules.

Coverage starts at the source instant. Expiry is **exclusive local midnight** on `local start date + calendar duration`. Month/year arithmetic clamps January 31 and February 29 appropriately; days are local calendar days across DST. Example: 10 Oct 2026, 12 months, Cairo → ends before 10 Oct 2027 local midnight. For a 14-day return window beginning 10 Oct, it ends before 24 Oct local midnight; the placement/delivery day can be partial. At expiry instant status is expired; before source instant not-started; inside interval active. Timezone belongs to the purchased version. Invalid/nonfinite dates/periods remain unknown. Customer civil-date formatting uses UTC solely to preserve the supplied YYYY-MM-DD across browser timezones; it performs no entitlement arithmetic.

## Separate eligibility previews and displays

`server/utils/afterSalesPolicy.js` is the server boundary for `resolveAfterSalesPolicy`, `getWarrantyEligibility`, `getReturnEligibility` and owned purchase reads. SQL resolves current catalog policies; eligibility exclusively reads purchased versions/durations and authoritative order facts. These helpers return eligible/ineligible/unknown/not-started/expired/disabled and bounded reasons. They cannot create/approve/execute a Claim.

Warranty eligibility evaluates explicit no warranty, configuration/enablement, purchased period, selected resolutions, required evidence and serial verification. Genuine vendor `commerce_serialized_units.serial_number` exists separately from permanent unit/QR identity; enough assigned genuine serials can satisfy the rule. Unit code or QR token never becomes a fabricated serial. Missing evidence/serial remains unknown. Future callers must authorize the item and supply **independently verified** evidence/serial facts, not browser assertions.

Return eligibility evaluates purchased enablement/window, a stable enabled purchased reason, bounded reason overrides, opened conditions, packaging and evidence. Manual/reason opened rules without a concrete reason override remain unknown; forbidden opened items are ineligible. Missing required facts remain unknown. Shipping/fault values are hints for later staff decisions, not a shipment instruction or automatic approval. Closed cancelled/refunded orders with captured policy are ineligible. A return window can expire while warranty stays active.

Public product detail shows structured offered duration, explicit no-warranty or unavailable information, no expiry. The existing stock/RLS `storefront_products` view is extended to include the foundation warranty columns without changing ERP stock projection or column order. My Account's existing purchased-item component keeps duration/none/history behavior and adds server period start/end/status when trustworthy. Not-started periods show their state without dates until coverage begins. No current-product fallback, policy jargon or Claim button. Old orders lacking policy stay unavailable.

## Access, validation and audit

Existing server guards enforce active staff `settings.view` for policy/reasons/catalog reads, and `settings.view` + `settings.edit` for writes (or active owner). Read-only staff can inspect scopes/reasons but cannot edit/save. Customer routes require nonanonymous active accounts and check exact order ownership before entitlement reads; the SQL owned projection independently verifies ownership/active profile. Customer responses omit version keys/IDs, revisions, staff/audit identities and current admin settings.

All three tables have RLS and no public/anon/authenticated grants. All `after_sales_*` functions are browser-revoked/service-only. Staff write RPCs independently verify service role, active admin and permissions, strict keys/types, native constraints, and revision. APIs bound body size to 16 KiB, reading time to five seconds and search/reason lengths/counts. No-store/private headers; safe errors; stale revisions return 409 requiring reload. Atomic before/after policy/reason audit uses existing `admin_activity_logs`; audit insertion failure rolls back the policy too. No separate audit ledger.

## Validation evidence

- `tests/after-sales.test.mjs`: strict inputs, populated migration/history, hierarchy/NULL/false/empty list, original checkout/foundation bodies, native invalid/stale/unauthorized rollback, separate eligibility/reasons, purchased version preservation, immutable writes/imports/preorder, fallback/source evidence, leap years/months/exclusive boundary/DST, packaging/evidence/serial/none/closed, ownership/grants, audit outage, recreated overrides and reset retention.
- `tests/after-sales-api.test.mjs`: actual H3 routes and existing guards against isolated SQL; Auth verification/transport fixtures only. Settings viewer/editor/inactive/missing-parent permission, customer/stranger/anonymous, malformed/oversized body, invalid values/scope, stale saves, parent preview, reasons/audits, owned server expiry and no internal metadata.
- Full requested `node --test tests/*.test.mjs`: **484 passed, zero failures, one existing optional native PostgreSQL concurrency test skipped**. Focused policy/domain/API: **52/52 combined after-sales/warranty cases; 23 policy/domain/API cases**. Typecheck, production build and diff check: **passed**.
- `scripts/after-sales-browser.mjs`: actual compiled Vue and built CSS **471 assertions/132 screenshots**, EN/AR/RTL, 1440/390px, Light/Dark/System and OS transitions, input contrast, all tabs, inherited fields, actual H3/RBAC/SQL save/reload/order fallback/reason disablement, parent restoration, stale conflict and viewer controls; purchased active/expired/not-started/pending/history display in a Los Angeles browser timezone. Auth verification is an isolated fixture. Zero unexpected browser errors/external requests; one deliberately exercised HTTP 409.
- Existing compiled commerce/warranty, PDC and SMS browser regressions: **warranty/commerce 432 assertions/72 screenshots, PDC 495/48, unchanged SMS 543/96; zero errors/external requests**. No provider or production account calls.

Evidence: `/tmp/elcomputer-after-sales-*.log`, `/tmp/elcomputer-after-sales-review/browser/`, and existing warranty/PDC/SMS artifact folders. Ephemeral screenshots/logs are not committed catalog data. Independent native concurrency, actual signed-in Supabase persistence, production acceptance, real delivery/invoice/provider transactions remain unverified. The optional native concurrency harness remains separately configured work.

## Changed files

- Schema: `supabase/migrations/20261007160000_after_sales_policy.sql` (after unapplied `20261007120000_warranty_entitlements.sql`; **63 local migration files**).
- Server: `server/utils/afterSalesPolicy.js`, five `server/api/admin-after-sales/*` endpoints, `server/api/account/orders/[id].get.js`, explicit retained reset metadata in `server/utils/systemResetScopes.js`.
- UI: `app/components/dashboard/AfterSalesPolicies.vue`, `app/components/dashboard/after-sales/PolicyField.vue`, existing Settings/catalog/product editor navigation; new `app/components/ProductWarranty.vue` and public product query; `app/components/account/ItemWarranty.vue` and civil date formatter.
- Shared/localization: `app/utils/afterSalesFields.js`, dashboard settings/navigation, foundation helper comments, EN/AR locales and UI message map.
- Tests/evidence: two after-sales test files, navigation expectations and SQL fixture `ilike`, new after-sales browser runner and existing warranty runner product-component registration/OS-change synchronization.
- Documentation: this document, `docs/warranty.md`, `PROJECT_STATE.md`, `CODEX_HANDOFF.md`.

## Requested final report

1. Audit findings: existing Settings/auth/audit and one product category reused; no structured prior customer policy/invoice adapter.
2. Existing warranty: `abf9347` product/purchased duration, variant inheritance, capture scope and immutable snapshots preserved.
3. Architecture: explicit policy resolver and separate purchase eligibility, existing Settings tabs.
4. Global model: typed complete draft defaults; separate saved warranty/returns configuration.
5. Category overrides: nullable fields inherit globals.
6. Product overrides: nullable fields inherit actual category/global; no duplicated duration.
7. Precedence: global → category → product, SQL-authoritative per field.
8. Purchase preservation: one immutable item reference, critical rules only, no historical backfill.
9. Versioning: locked revision tuple/content fingerprint plus immutable effective rules and reasons.
10. Warranty basis: delivery/invoice/payment/order, configurable per scope.
11. Fallback behavior: explicit ordered list or pending; never implicit switching.
12. Expiry: calendar months/years, purchased timezone, exclusive local midnight.
13. Resolutions: repair/replacement/refund/service-center selections; no execution.
14. Evidence/serial/shipping: typed choices, genuine serial facts only; no uploads/shipping.
15. Returns: enablement, editable bounded days, basis/fallback/evidence/shipping.
16. Return window: central local calendar days; independent of warranty.
17. Opened/packaging: bounded enums and unknown/manual verification.
18. Reasons: stable bilingual keys, order/enablement, bounded fault/overrides, frozen at purchase.
19. Product page: structured offered warranty, none/unavailable; no expiry.
20. My Account: purchased start/end/status or pending/unavailable, no claim action.
21. Domain helpers: separate warranty/return preview states with trusted future facts.
22. Files: grouped list above; no unrelated consumer/integration.
23. Schema: three private tables, one item FK, constraints/guards/index/view extension and reset recognition; additive unapplied migration.
24. RBAC/RLS: active Settings view/edit, owned active customer reads, no browser table/RPC writes.
25. Audit: existing transactional before/after activity log, stale-save detection and outage rollback.
26. Tests: domain/migration/real HTTP auth and retention cases above.
27. Full validation: 484 passed, zero failures, one existing optional native PostgreSQL concurrency test skipped; typecheck/build/diff passed.
28. Browser: 471 local policy assertions/132 screenshots and warranty/commerce 432 assertions/72 screenshots, PDC 495/48, unchanged SMS 543/96; zero errors/external requests; fixture Auth, no production acceptance claim.
29. Order/PDC/SMS: full regressions; original canonical bodies preserved; no provider/state/send changes.
30. Production migration: NOT applied. Both warranty and after-sales migrations remain local.
31. Deployment: NOT deployed. Commit/push through established main workflow only.
32. Before Claims: approve configured business policy, authenticated acceptance and date/serial evidence; separately scope lifecycle, uploads, manual review/history adjudication, claims authorization/resolutions and any later reverse shipping/notifications. Deploy/apply matching migrations only through separately authorized deployment computer; no credentials needed here.

```text
AFTER SALES POLICY FOUNDATION IMPLEMENTED: YES
GLOBAL WARRANTY POLICY DASHBOARD-MANAGED: YES
GLOBAL RETURN POLICY DASHBOARD-MANAGED: YES
CATEGORY POLICY OVERRIDES IMPLEMENTED: YES
PRODUCT POLICY OVERRIDES IMPLEMENTED: YES
PURCHASE-TIME POLICY ENTITLEMENT PRESERVED: YES
WARRANTY START BASIS DASHBOARD-CONFIGURABLE: YES
WARRANTY EXPIRY CALCULATION IMPLEMENTED: YES
PRODUCT PAGE WARRANTY DISPLAY IMPLEMENTED: YES
MY ACCOUNT WARRANTY EXPIRY DISPLAY IMPLEMENTED: YES
RETURN WINDOW DASHBOARD-CONFIGURABLE: YES
RETURN REASONS DASHBOARD-MANAGED: YES
EVIDENCE REQUIREMENT DASHBOARD-CONFIGURABLE: YES
WARRANTY CLAIM WORKFLOW IMPLEMENTED: NO
RETURNS CLAIM WORKFLOW IMPLEMENTED: NO
PDC REVERSE SHIPPING CONNECTED: NO
CLAIM SMS CONNECTED: NO
CLAIM EMAIL CONNECTED: NO
PRODUCTION MIGRATION APPLIED: NO
PRODUCTION DEPLOYED: NO
```
