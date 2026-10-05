# Dormant production deployment attempt — blocked, 2026-10-05

The user authorized the reviewed tracking code and migration with PDC activation dormant. Deployment stopped at the required guarded preflight. No migration, upload, PM2 restart, production configuration write, provider operation or registration occurred. This deployment attempt does not change the historical implementation results below.

1. **Pre-deployment validation:** Reviewed AGENTS, PROJECT_STATE, CODEX_HANDOFF, the audit/report and clean Git state. Commit `96f8bc316326db059cb68bfc951fc235607f10b9` contains exactly the reviewed 33-file implementation. Node 22.23.3 full suite: 323 passed, one existing optional native PostgreSQL test skipped, zero failures/cancellations; focused PDC: 42/42. Typecheck, build and diff check passed. Full tests use the documented keep-alive preload. `npm run deploy:check` failed because `.deploy.env` is missing. No deployment configuration was found; the SSH agent has no identities and the local SSH directory contains no identity/configuration files. No SSH authentication attempt or fallback workflow was used.
2. **Migration:** Reviewed only `20261005120000_pdc_customer_tracking.sql`, SHA-256 `6a84752937b1d6e9da1410fdd1d609e2ca8c2312dd2acde310a9f9574552c94f`. It extends existing tables, preserves historical rows, seeds only new mapping presentation fields, retains legacy duplicates, adds partial uniqueness/history indexes and service-only RPCs/private owner Broadcast authorization. The replaced URL constraint and nullable numeric event ID are intentional reviewed compatibility changes. Linked read-only listing confirms 57 previous versions align and only this migration is pending. It was not applied because release preflight failed.
3. **Production commit/version:** Candidate is `96f8bc316326db059cb68bfc951fc235607f10b9`; this attempt did not deploy it. The currently running production version was not inspected through SSH. Documentation updates are local only.
4. **Deployment result:** BLOCKED before upload. Missing deployment configuration and available SSH identity must be restored before rerunning the guarded workflow. The user authorized deployment; no further release approval is requested, but required access/setup is absent. Do not apply the migration while application release access is unavailable.
5. **Existing shipping regression:** Repository regressions passed. Production shipping configuration/data were queried read-only: 382 cities, 32 statuses, zero PDC jobs and zero courier-history events. No production checkout/order/packing/label acceptance was performed during this blocked attempt.
6. **PDC settings:** Read-only configured Supabase observation confirms intended production URL and supplied Company/Product IDs; provider enablement and auto-labels remain false. Token and webhook secret are currently unconfigured. No dashboard/provider setting was changed. Server PM2 live-call configuration could not be inspected without SSH.
7. **Secret exposure:** Existing AES-256-GCM architecture remains unchanged; stored-secret fields are empty. Local settings masking/encryption tests passed. No credential value was printed, committed or uploaded. Post-release production HTML/payload/bundle/browser-response scans were not performed because no release occurred.
8. **My Account tracking:** Focused owner/projection/fallback/unknown-state and EN/AR timeline tests passed. Historical implementation browser results below remain fixture evidence. Production authenticated Orders/Details/Progress/Delivery acceptance was not performed in this attempt.
9. **Ownership/RLS:** Reviewed migration and 42 focused checks preserve owner-scoped reads, private shipping tables and service-only RPCs. Live customer/cross-customer/private-Broadcast acceptance awaits deployment and an isolated authenticated session. No fake production history/account was inserted.
10. **Webhook:** Planned endpoint remains `https://new.elcomputer.net/api/webhooks/pdc`. No registration/change/secret sharing occurred. No callback request was sent to production; the new route is not deployed by this attempt. Current database courier-event count is zero.
11. **PDC external API calls:** NONE. Only linked Supabase migration listing and read-only settings/count queries were made. No GetCities/GetProducts/GetShipmentsStatus/SaveShipmentEx/ExportPDF request was issued to PDC.
12. **Shipments/AWBs:** NONE created. No pickup, COD, label workflow or courier operation was triggered.
13. **Errors/warnings:** Required preflight error: missing `.deploy.env`. Existing build warnings remain: ERP duplicate import, source maps, chunk size and preorder BigInt target. Production PM2/error logs were not inspected without SSH; no claim of production error-log stability is made.
14. **Rollback:** No production change occurred, so rollback is unnecessary. No new release backup was created. Previous documented backups remain historical information; their current existence was not verified. Existing guarded backup/health/rollback tooling is unchanged.
15. **Remaining steps:** Restore the approved deployment configuration and SSH access, rerun required preflight, verify runtime/configuration/data baselines, apply only the reviewed migration, deploy through existing safeguards and complete safe production verification. Keep provider/auto-label/live-call configuration unchanged. Resolve mappings/timezone/protocol gaps and obtain separate activation authorization before provider registration or real calls.
16. **Provide to PDC later:** HTTPS endpoint; independently generated minimum-32-character webhook secret through a secure channel; reviewed mapping CSV; merchant identity through existing onboarding. Confirm REF/toRef format, actual IDs including 97 and PDF/sheet conflicts, repeated-status identity, timezone and reconciliation response/pagination. Nothing was shared with PDC and no ambiguity was guessed.

```text
PDC TRACKING CODE DEPLOYED: NO
PDC TRACKING MIGRATION APPLIED: NO
PDC CONFIGURATION DASHBOARD-MANAGED: YES
PDC SECRETS REMAIN ENCRYPTED: YES (architecture preserved; credentials are unconfigured)
PDC LIVE CALLS ENABLED/CHANGED: NO (no change made; server runtime state not inspected)
PDC WEBHOOK REGISTERED WITH PROVIDER: NO
REAL PDC SHIPMENT CREATED: NO
REAL PDC WEBHOOK RECEIVED: NO
```

Evidence: `/tmp/elcomputer-pdc-deploy-20261005/` contains validation/preflight logs, read-only migration alignment and database observations. No additional feature was started.

---

# PDC customer tracking — implementation report

2026-10-05. Local implementation complete. Production database observation was read-only. No PDC API request, shipment creation, webhook registration, migration application or deployment occurred.

1. **Audit findings:** All five supplied files, both Address Mapping sheets, the status sheet and the reason sheet were read in full. Existing shipping schema, RLS, encrypted settings, queue/worker/retries, creation/labels, references, admin UI, account API, packing/payment timestamps and tests were inspected. See [the audit](pdc-tracking-audit.md).
2. **Existing functionality:** Dashboard settings, 382 destination mappings, 32 status mappings, paid-order shipping jobs, SaveShipmentEx, ExportPDF, private labels and a public webhook already existed. A read-only check of the configured Supabase database confirms these mapping counts, the intended production URL and supplied company/product match. PDC and auto-labels are disabled.
3. **Architecture reused:** Existing settings, mappings, jobs and webhook history tables; AES-256-GCM secret helpers; customer/admin authentication and order ownership; account detail/progress/delivery components; admin Shipping and Order Details panels; private Supabase Broadcast conventions. No parallel subsystem or new table was created.
4. **Incorrect old behavior:** AWB-first webhook lookup accepted mismatched references; timestamp-based deduplication disagreed with the vendor; partial inserts swallowed retries; invalid dates/unbounded input were accepted; races could regress state; callbacks rewrote broad order statuses. API URL was forced/read-only and merchant defaults appeared in UI. Creation could accept an unrelated first AWB response. These are corrected. Optional old shipment-field discrepancies remain documented and untouched.
5. **Files changed:** The complete 33-file inventory is below. No package/lockfile, environment, deployment script, checkout, payment, ERP, returns, warranty or SMS implementation was changed.
6. **Database:** One unapplied migration, `20261005120000_pdc_customer_tracking.sql`, extends the existing settings/mapping/job/history structures, adds private RPCs/Broadcast authorization and indexes. It preserves old rows/references/labels and legacy duplicate history. Nullable numeric status supports documented name-only reconciliation. Production migration applied: NO.
7. **Dashboard settings:** Existing panel now supports explicit mode/editable validated URL/timezone, encrypted credential replacements, safe connection/sync actions, cached city/product counts and timestamps, retained saved Product ID and editable/new status mappings/aliases. Existing pickup/shipment settings and company management remain.
8. **Secrets:** Existing server-only master key and AES-256-GCM are reused. Access Token/Webhook Secret remain separate encrypted dashboard settings; replacements cannot reuse the other credential. Browser responses contain presence flags, never ciphertext/plaintext. Successful saves clear secret entry fields. Private environment values were scanned against public output without printing them.
9. **API:** Existing creation/label code is reused; exact echoed REF is required before persisting an AWB, and credential-bearing redirects are rejected. Tracking adds bounded read-only GetCities/GetProducts/GetShipmentsStatus operations using the saved URL/CompanyID/encrypted token. No merchant IDs are added as source defaults.
10. **Webhook:** Existing POST route is repaired. Secret validation precedes payload processing, followed by provider enablement, JSON media/schema/size/date validation and one atomic database operation. No external courier operation occurs before acknowledgement.
11. **Planned URL:** `https://new.elcomputer.net/api/webhooks/pdc`. It is unchanged from the existing route and has not been registered externally during this task.
12. **Authentication/idempotency:** Public callback requires `X-Webhook-Secret`; missing/invalid values fail 401. Streaming input is limited to 8 KiB/two seconds; total handling is capped at 7.5 seconds. REF identifies the expected job, and saved AWB must match. New numeric records have database-backed AWB + StatusID uniqueness and deterministic event keys. Commit precedes 200; failures remain retryable. Processed legacy duplicates are recognized, failed legacy rows cannot swallow a retry, and an undated numeric API observation can be enriched by its dated callback once.
13. **History:** Existing `shipping_webhook_events` stores linked shipment, raw provider status/reason, normalized state, provider UTC event time, source and receive time. New raw bodies/unknown fields/secrets are discarded. Legacy history stays private/intact and duplicate IDs are collapsed for customers. Up to 200 recent processed rows are returned.
14. **Reconciliation:** Staff use the existing order PDC card. Exact saved AWB/REF filters must uniquely match a response. A database claim limits attempts to five minutes, including failures. Optional ID/date are retained; missing values are never invented. Name-only/undated snapshots are displayed as observations. Query-start chronology prevents late API responses from replacing intervening callbacks. Customer refresh reads local data only; no provider polling/scheduler was added.
15. **Mapping:** Existing provider mapping table gains normalized shipment state and raw aliases. Dashboard editing supports changed/new statuses without deployment. Central EN/AR presentation handles ordinary and exception states separately from order/payment status. Unknown states remain stored and neutral, with no financial/order transitions. Known reference reasons are translated; unrecognized raw reasons remain staff-only. [Draft mapping review CSV](pdc-status-mapping-review.csv) preserves every supplied row and must be checked against the dashboard before sharing.
16. **Spreadsheet anomalies:** Final Status has 33 rows/32 IDs, with conflicting descriptions for 97. Webhook PDF illustrations conflict with sheet IDs 2/3/5. Reason has 25 names/24 semantic names because Consingee/Consignee Moved differ only by spelling. Address sheets each have 382 unique IDs but 140 differing rows: aliases/grouping/whitespace plus city 21's English-column Arabic text. Eight Sheet1-versus-existing-mapping differences (244–251) are nonbreaking versus ordinary spaces. No city mapping was overwritten or silently corrected.
17. **Cities:** GetCities is the live lookup source. Sync caches canonical IDs/names, exposes count/time/selection, preserves the 382 working address aliases and does not rewrite checkout. New destination aliases can be maintained as data in the existing mapping table. Live vendor lookup accuracy remains unverified because all PDC calls were mocked.
18. **Products:** GetProducts supplies cache/selection; saved Product ID remains even when lookup is absent or a response omits it. Lookup failure preserves configuration/cache. No Product ID 40 hardcoding was added. Changed credentials/mode invalidate caches without changing the merchant's configured IDs.
19. **My Account timeline:** Actual placement, paid_at and packing_completed_at merge with courier history by event time. No intermediate processing or pickup milestones are invented. Current order state is separate. Dated webhook events use StatusDate; undated reconciliation shows Status checked.
20. **Order/Delivery UI:** Existing detail design now shows PDC, AWB, normalized state, event/observation time and translated recognized exceptions. Missing shipment/update fallback stays. Private Realtime signals reload the owned-order endpoint; manual refresh is local only. Existing Orders cards/order-status source remain unchanged. Admin Order Details adds raw private history and manual reconciliation beside the existing label button.
21. **Security/RLS:** Shipping tables remain service-only/RLS-protected. Customer API ownership precedes shipment reads and scopes history by provider/REF/AWB. Realtime topic access requires the active, non-anonymous order owner and publishes `{ changed: true }` only. Foreign/disabled ownership and direct customer/anonymous table/RPC access were denied in tests. Customer/settings GET responses use private/no-store.
22. **Tests added:** 42 focused checks cover real isolated schema/migration preservation, encrypted settings/secret masking, config validation, HTTP authentication/input/deadlines, transactional event persistence/rollback, retry deduplication, reference/AWB failures, unknown/ambiguous states, ordering/equal-time/stale snapshots, metadata enrichment, API mock/lookup normalization, dashboard handler persistence, ownership/RLS/Broadcast, assigned-AWB/no-event fallback and EN/AR timeline merging. An optional generic test-process helper supports an existing Node 22 timeout mock without changing payment code.
23. **Validation:** Node 22.23.3: full suite **323 passed, 1 existing optional native PostgreSQL test skipped**, zero failures/cancellations; focused PDC **42/42**; typecheck/build/diff check passed. The full Node 22 suite uses the documented keep-alive preload because an existing Paymob AbortSignal.timeout-only mock otherwise exits with pending promises. The ordinary Node 22 focused PDC command passes without it. Existing ERP auto-import, source-map, chunk-size and preorder BigInt build warnings remain. Local built-server checks passed **15 HTTP cases**. Final public scan: **113 files, 1 configured private-value type, zero matches**.
24. **Browser:** **491 assertions, 44 screenshots**, actual Vue Orders/Order Card/Order Detail/Order Progress/Shipping settings components with production CSS; EN/AR, 1440/390px, RTL, Light/Dark/System, eight shipment scenarios, associated dashboard labels, secret clearing, lookup/mapping UI, provider timestamp chronology, failed refresh preservation and subscription cleanup. Zero detected browser errors/warnings/overflow or external network calls. These are isolated authenticated fixtures, not signed-in production acceptance. Evidence: `/tmp/elcomputer-pdc-audit/browser/` and `browser.log`.
25. **Mocking:** All PDC network calls, webhook merchant configuration in HTTP tests, Supabase browser/auth subscriptions, dashboard fixture writes and customer/staff identities were isolated. Database behavior used the real checked-in schema/migrations in PGlite; native concurrent PostgreSQL sessions were not exercised for PDC. No fake events/accounts were written to production.
26. **Real calls:** Real PDC API calls: **NO**. Safe read-only Supabase settings/mapping queries were made for audit; all local built-server calls used anonymous/invalid callback requests and could not mutate shipments. No real production shipment, label, COD, pickup or payment occurred.
27. **Before deployment:** User review/explicit release approval; schema/migration parity and exact migration review; authenticated isolated acceptance and real Supabase private Broadcast acceptance; server encryption readiness and secure dashboard token/independent secret; confirmed mode/URL/timezone/mapping; provider response/pagination clarification. Current observed PDC/auto-label settings remain disabled.
28. **Provide to PDC later:** Planned HTTPS URL, independently generated minimum-32-character secret through a secure channel, reviewed status mapping file, merchant identity through existing onboarding channels, and confirmation of REF format/timezone/actual IDs/97/repeated-status identity/response shape. The draft CSV retains ambiguities; do not send it as final without review. Nothing was sent to PDC.
29. **Known limits:** Provider event identity cannot distinguish legitimate repeated visits to the same StatusID; 97 and PDF illustration conflicts need vendor confirmation. Timezone-free DST-ambiguous timestamps require offsets, and event precision is normalized to milliseconds. Name-only snapshots cannot reconstruct missed historical stages; unknown names/reasons use neutral/omitted customer presentation. Response envelopes/pagination are only as documented/bounded; explicit partial pages are rejected. History projection is capped at 200 rows. Destination alias editing remains data maintenance in the existing mapping table; there is no new city-mapping editor/checkout redesign. Existing one-job-per-order constraint remains for a later reverse/exchange feature. Actual provider/TLS delivery, authenticated production UI and native PDC concurrent-session acceptance were not performed. Optional creation-field discrepancies remain outside this feature.
30. **Recommended sequence:** After approval, review current schema and apply only the reviewed additive migration, release matching app output with PDC/auto-label settings still disabled, verify guarded local/staging behavior and encryption, save dashboard credentials/configuration, perform explicitly approved read-only lookup/authenticated acceptance with auto-labels/workers unchanged, resolve vendor mappings/timezone/protocol gaps, then register/activate the webhook with PDC. Verify provider-coordinated safe duplicate/out-of-order callbacks and monitor failures before accepting the rollout. No activation/deployment action is part of this completed local task.

## Files changed

- `CODEX_HANDOFF.md`
- `PROJECT_STATE.md`
- `app/components/account/OrderProgress.vue`
- `app/components/dashboard/OrderDetailsDialog.vue`
- `app/components/dashboard/commerce/ShippingTab.vue`
- `app/composables/useShipmentUpdates.js`
- `app/pages/account/orders/[id].vue`
- `app/utils/shipmentTracking.js`
- `docs/pdc-shipping.md`
- `docs/pdc-status-mapping-review.csv`
- `docs/pdc-tracking-audit.md`
- `docs/pdc-tracking-report.md`
- `i18n/locales/ar.json`
- `i18n/locales/en.json`
- `scripts/pdc-tracking-browser.mjs`
- `server/api/account/orders/[id].get.js`
- `server/api/admin-orders/[id].get.js`
- `server/api/admin-shipping/lookups.post.js`
- `server/api/admin-shipping/mappings.patch.js`
- `server/api/admin-shipping/orders/[id]/refresh.post.js`
- `server/api/admin-shipping/settings.get.js`
- `server/api/admin-shipping/settings.patch.js`
- `server/api/webhooks/pdc.post.js`
- `server/utils/customerShipment.js`
- `server/utils/pdcLookups.js`
- `server/utils/pdcSettings.js`
- `server/utils/pdcShipping.js`
- `server/utils/pdcTracking.js`
- `server/utils/pdcWebhook.js`
- `supabase/migrations/20261005120000_pdc_customer_tracking.sql`
- `tests/helpers/keepTestProcessAlive.mjs`
- `tests/pdc-tracking-database.test.mjs`
- `tests/pdc-tracking.test.mjs`

## Required declarations

EXISTING PDC SYSTEM AUDITED: YES  
PARALLEL PDC SYSTEM CREATED: NO  
PDC CONFIGURATION DASHBOARD-MANAGED: YES  
PDC SECRETS STORED ENCRYPTED: YES (existing architecture; merchant activation/configuration is pending)  
REAL PRODUCTION SHIPMENT CREATED: NO  
PDC WEBHOOK REGISTERED WITH PROVIDER: NO  
PRODUCTION MIGRATION APPLIED: NO  
PRODUCTION DEPLOYED: NO

Implementation is stopped here. Returns, Warranty, SMS, ETA, Warehouse Pickup and other features were not started.
