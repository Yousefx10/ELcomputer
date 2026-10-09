# Current local extension — Claims Communications Stage 3, 2026-10-09

Claims Stage 3 communicates accepted reverse pickups and authoritative Claim receipt separately from outbound PDC SMS. Reverse events never create outbound pdc_* Order SMS intents; verified rebooking uses its own job UUID. Existing courier implementation and outbound history are preserved. No production/provider activation/call. Current local implementation and evidence are in [after-sales-communications.md](after-sales-communications.md). New migration 67 remains unapplied, all controls default OFF. Earlier implementation/audit/deployment records below are historical. **STOP after Stage 3.**

# Current local extension: After-Sales Stage 2, 2026-10-08

Claim reverse bookings now use the existing PDC adapter/settings/authenticated worker/webhook/normalization and private-label transport, with separate claim-linked jobs/history and stable `ASREV-` references. Staff explicitly initiate pickup; reverse events route outside the original outbound/SMS persistence path. Original order AWBs/references/history and normal order PDC SMS remain unchanged. No provider cancellation action is invented.

Unapplied local Stage 2 migration `20261008160000_after_sales_reverse_logistics.sql` follows unapplied Claims Core. No production/provider/credential/deployment operation occurred; existing production release sections below are historical. Real provider/authenticated/native concurrency acceptance remains unverified. Full audit, documented V6 semantics, validation and boundaries: [after-sales-reverse-logistics.md](after-sales-reverse-logistics.md). **No Claim communications; STOP after Stage 2.**

# PDC → SMS notifications — dormant production deployment, 2026-10-06

Reviewed implementation and single migration are deployed. Three PDC and four Order SMS controls remain OFF; PDC external configuration and Vodafone remain unchanged/dormant. This record supersedes the historical local-only status below.

1. **Synced branch/HEAD:** clean `main`, matching fetched `origin/main` at `76ce7837d608028c5c4ad257552e7e8c39031ad6` before release. No reset; subsequent documentation-only commit is separate.
2. **Required feature:** `76ce7837d608028c5c4ad257552e7e8c39031ad6` is the deployed HEAD; legitimate earlier release/infrastructure documentation retained in ancestry.
3. **Pre-deployment validation:** Node 24.16.0; 432 full-suite passes, zero failures, one existing optional native Paymob skip; 151 focused passes. Typecheck/build/diff/preflight passed. SMS/checkout/Orders/Live Chat fixtures 543 assertions/96 screenshots; PDC/account fixtures 495 assertions/48 screenshots, eight scenarios. Local HTTP/SSR/artifacts 980 assertions/20 requests/115 files/seven fictional private types/zero exposures. Existing ERP import, sourcemap/chunk and preorder target warnings remain; no deployment-blocking defect found.
4. **Migration:** only `20261006120000_pdc_sms_notifications.sql`, SHA-256 `072cef061294dc23518658cff405ecf7dbd3df4757502096814fbcb5da4e6f58`. Additive table/column/template/index/wrapper extension; equivalent Order SMS uniqueness replaces its old constraint. No business-row deletion, historical event mutation, history reset or backfill.
5. **Migration alignment:** 61 local/remote versions match; none pending. Docker catalog-cache warning was non-fatal after native schema/history/security and data verification passed.
6. **Two-computer consistency:** every repository version/name compared with native `supabase_migrations.schema_migrations`. Before: 60 exact identities and only this feature pending. After: 61 exact matches, zero missing/remote-only/name mismatch; expected prerequisite signatures present.
7. **Deployment:** existing `env -u DEBUG npm run deploy` completed guarded secret-free build, `.output`-only upload, backup, scoped restart and health loop. All 712 deployed entries match local, manifest digest `b767046c5fc17d51c4a076facf24e18205b443eae6fcadd03d2eda12083e517c`. No dotenv upload/server networking/unrelated site/process changes.
8. **Deployed commit:** `76ce7837d608028c5c4ad257552e7e8c39031ad6`; no reimplementation/redesign or application-code fix. Subsequent documentation commit does not change running app identity.
9. **PM2/health:** `new-elcomputer` online, `/home/newelcomputer/htdocs/new.elcomputer.net`, `.output/server/index.mjs`, expected Node 22.23.1 and port 3001; one restart 40 → 41. Initial startup connection retry recovered through existing loop. Internal/public health passed; error-log bytes/hash unchanged from this task baseline.
10. **PDC SMS Dashboard:** actual Vue fixtures verify three controls/defaults, bilingual Notification bindings, central sender, masked history/provider-time/AWB, local save/reload and permissions. Private live DB confirms three disabled controls/templates/correct EN/AR bindings; production Dashboard PDC/SMS routes require login. This is separate from authenticated production UI acceptance.
11. **Authenticated acceptance:** **NOT VERIFIED**. No safe established authorized admin/customer test session/workflow was available. No account/session/credential was manufactured or real order edited. Staff save/reload/role behavior, customer tracking and private Broadcast remain pending.
12. **Three production controls:** Out for Delivery **OFF**, Delivery Exception **OFF**, Delivered **OFF**. Config revisions zero; all new templates disabled Notification traffic. Four Order SMS controls remain OFF.
13. **Historical backlog:** zero PDC intents and zero sendable intents/batches/messages/attempts. Existing 1 terminal suppressed Order SMS intent predates this release and remains unchanged. No historical OFD/attempt/delivered observation/shipment was converted, scanned for replay or queued.
14. **PDC historical integrity:** all 22 historical business/configuration fingerprints unchanged, including 9 orders/13 items, full PDC settings, 382 cities/32 mappings and zero jobs/history. Existing references/order snapshot phone/locale preserved. No real shipment/order/event mutation.
15. **Webhook/reconciliation deduplication:** both retain the same `shipping_record_pdc_event` canonical RPC; original body preserved. Row locking, original duplicate/stale outcomes, genuine normalized transitions and unique shipment/AWB/event identity prevent overlap/re-entry/retry duplicates. Actual disposable SQL/H3 tests pass; no synthetic production webhook sent.
16. **Stale/out-of-order protection:** original provider/query-start chronology, durable delivered-history stop, feature/configuration cutoffs, unknown/future-time terminal suppression, ten-minute expiry and final shipment/AWB/current-state/current-resolver checks verified in deployed definitions and isolated tests. No obsolete OFD/attempt after durable delivery. Delivery Exception conservatively once per shipment/AWB.
17. **Idempotency/constraints:** live unique global logical key, batch link, shipment job/AWB/event index and equivalent four-event Order SMS partial unique index verified. Preparation/central enqueue/link remains one SQL transaction; all 12 original reviewed bodies match pre-migration hashes. No new queue/worker framework.
18. **Native concurrency:** **NOT VERIFIED** for independent native PostgreSQL PDC/SMS sessions. Existing optional native binary/driver harness unconfigured; disposable PGlite asynchronous lifecycle/lease/dedup tests passed. No production concurrency fixtures/order/shipment mutations.
19. **Existing PDC tracking:** 495 actual component assertions/48 screenshots cover eight scenarios, timeline/Delivery/ownership/no-courier-update/reconciliation/exception/unknown/order chronology, EN/AR/RTL/mobile/themes. Actual read-only owned-order lookup and shipment reader pass for all 9 real orders, each safely returning no-shipment projection. Signed-in production tracking/refresh/private Broadcast **NOT VERIFIED**.
20. **Order SMS regression:** all four settings, templates and existing intent fingerprints preserved; controls OFF. Original capture/locale/checkout/preorder/eligibility/queue/reset bodies unchanged; normal Order SMS tests still pass, including paid versus Cash, authoritative snapshots, replay, failure/expiry and Notification guards.
21. **RBAC/RLS:** all 12 reviewed SMS/PDC tables retain RLS, no browser policies or anon/authenticated table grants; 23 reviewed functions deny anon/authenticated execution. Renamed PDC/eligibility implementations are owner-only; public wrappers service-only. Existing settings/templates/history permissions/audits retained. SMS errors are private,no-store; PDC/customer GET projections retain privacy headers. Existing PDC mutation handlers deny anonymous 401 without a uniform cache header; the HTTP probe was corrected to reflect unchanged handler behavior, not an application modification. Real signed-in roles remain unverified.
22. **Secrets/privacy:** 118 public files against three distinct private runtime values, 22 server responses and application logs: zero infrastructure exposures. 9 orders provided private ID/number/unpublished-phone candidates only on server for 118 files/nine response scans/two application logs: zero exposures and no values printed. All 3054 browser scans and fictional local secret tests pass. History keeps phones masked and excludes raw reason/status/payload/customer name/message bodies/credential ciphertext/internal shipment/event links. Reasons use existing controlled catalog or neutral translation.
23. **Queue/worker:** encryption and worker infrastructure ready, persisted secrets unchanged; missing/invalid secret 401, valid secret plus deliberately malformed JSON 400 before processing. Zero PDC/sendable backlog, central dispatch ledgers empty, existing suppressed Order SMS history intact. No valid processing request, scheduler or provider traffic. PDC built/runtime live-call gate false; separate shipping encryption readiness false unchanged.
24. **Site regressions:** 185 HTTP assertions/46 requests and 650 browser assertions/92 page states pass. Homepage/real product/local cart persistence, checkout/login/account/order-detail protection, Orders/PDC/SMS Dashboard and templates/history guards, Live Chat launcher/open/close, EN/AR/RTL/desktop/mobile/Light/Dark/System; no browser errors/provider requests/commerce writes. Authenticated interiors and chat messaging are not claimed.
25. **Real PDC production call:** **NO**. No lookup, GetShipmentsStatus, shipment/label, provider registration or manufactured webhook. PDC credentials/external configuration/live-call state unchanged.
26. **Vodafone enabled:** **NO**; provider disabled, credentials/hostname/port/senders empty and settings unchanged.
27. **Vodafone request:** **NO**; no real connectivity/provider transport, provisioning or trusted-IP operation.
28. **Real SMS:** **NO**; no manual send/campaign/valid worker processing or customer communication.
29. **Rollback:** `/home/newelcomputer/htdocs/new.elcomputer.net/.output-deploy-backup-20261006-190825-55276` retained/readable; all 712 entries match prior production manifest. Unused; preserve additive migration if reverting app output through existing guarded workflow.
30. **Remaining activation:** separately authorized signed-in staff/customer/private Broadcast acceptance and safe native concurrency acceptance; PDC-specific encryption readiness/credentials/webhook provisioning and vendor normalization/97/timezone/DST/reconciliation-envelope/repeated-attempt identity confirmation; Vodafone credentials/modern TLS/approved senders/trusted IP/account readiness; approved EN/AR templates/contact policy; explicit activation and provider-test authorization. Keep all events/providers OFF. No OTP/NPS/returns/warranty/pickup or another feature begins.

```text
PDC SMS CODE DEPLOYED: YES
PDC SMS MIGRATION APPLIED: YES
LOCAL/REMOTE SUPABASE MIGRATIONS ALIGNED: YES
OUT FOR DELIVERY SMS ENABLED: NO
DELIVERY EXCEPTION SMS ENABLED: NO
DELIVERED SMS ENABLED: NO
HISTORICAL PDC EVENTS BACKFILLED INTO SMS: NO
HISTORICAL SENDABLE PDC SMS BACKLOG CREATED: NO
WEBHOOK/RECONCILIATION DUPLICATES PREVENTED: YES
ORDER SMS REGRESSED: NO
PDC EXTERNAL CONFIGURATION CHANGED: NO
VODAFONE ENABLED: NO
VODAFONE CREDENTIALS CHANGED: NO
REAL PDC PRODUCTION API CALLED: NO
REAL VODAFONE API CALLED: NO
REAL SMS SENT: NO
OTP CONNECTED: NO
NPS CONNECTED: NO
RETURNS/WARRANTY SMS CONNECTED: NO
AUTHENTICATED PRODUCTION INTERIORS: NOT VERIFIED
NATIVE INDEPENDENT-SESSION CONCURRENCY: NOT VERIFIED
```

Evidence: `/tmp/elcomputer-pdc-sms-deploy-20261006/` contains fresh validation, migration identity/schema/security/data checks, guarded release/output/backup fingerprints, production HTTP/browser/runtime/privacy results and isolated screenshots. Documentation is committed/pushed separately; no secret or real customer value recorded. **STOP after deployment/verification.**

## Historical local implementation — 2026-10-06

This feature connects the existing normalized PDC tracking layer to the existing central Notification service. It introduces no PDC provider, message queue or history system. All three controls and new templates default off. No production access, provider activation, credential provisioning, webhook registration, migration, deployment, courier request, shipment or SMS occurred.

Production readiness is inherited from the user's request and the committed deployment records. It was not reverified live here. This development computer intentionally has no production credentials; none were obtained, inferred, copied, recreated or changed.

## Audit and normalized event selection

Reviewed AGENTS, PROJECT_STATE, CODEX_HANDOFF, PDC tracking audit/report/usage, SMS report/security review and Order SMS documentation. Inspected actual schema/migrations, webhook authentication/parser, REF + saved AWB matching, event deduplication/chronology, GetShipmentsStatus reconciliation, customer projection/timeline/private Broadcast, Dashboard mappings/settings, order phone/locale snapshots, central templates/intents/queue/worker/history/permissions/audits and tests.

Existing normalized states are `registered`, `picked_up`, `in_transit`, `arrived_at_hub`, `out_for_delivery`, `delivered`, `delivery_attempted`, `delayed`, `rescheduled`, `held`, `returning`, `returned`, `cancelled`, `lost`, `damaged`, `partial_delivery`, `unknown`.

| Trusted normalized transition | SMS event/template code | Policy |
| --- | --- | --- |
| Another state → `out_for_delivery` | `pdc_out_for_delivery` | At most once per shipment/AWB |
| Another state → `delivery_attempted` | `pdc_delivery_exception` | At most once per shipment/AWB under current event identity |
| Another state → `delivered` | `pdc_delivered` | At most once per shipment/AWB |

No dispatch event was added. `picked_up`, transit/hub updates, delays, holds, rescheduling, return states, loss/damage, partial delivery and unknown states do not create SMS. The broader customer timeline exception list is deliberately not an SMS trigger list. Raw StatusID/name/reason never independently determines an SMS event; the existing Dashboard-managed resolver determines normalized state. StatusID 97 remains neutral under its current mapping. No mapping or provider interpretation was changed.

## Integration and schema

Unapplied additive migration: `20261006120000_pdc_sms_notifications.sql`.

- Extends the existing `sms_order_event_settings` and `sms_order_events`; their historical names remain for compatibility. No new table, permission, scheduler or delivery framework.
- Expands event enums with three PDC events and seeds only three disabled bilingual central Notification templates, without overwriting matching codes. Event bindings default disabled, using the existing EN/AR template references, revision guard and approved-sender system.
- Adds configuration `capture_started_at` and nullable intent shipment-job/AWB/tracking-event/provider-time metadata. Existing orders, tracking histories/mappings, provider settings, references and communications retain their values. Existing Order SMS uniqueness becomes an equivalent partial unique index restricted to its four event types. PDC uniqueness covers shipment job + AWB + event. Indexed order/tracking-event links support safe history deletion/lookup. The delivered-history check uses the existing scoped PDC history index. Global logical identity remains unique.
- Wraps `shipping_record_pdc_event`, preserving its original body under an owner-only implementation name. Both webhook and reconciliation already invoke this one RPC. Existing service-role checks, four-second statement/two-second lock bounds, secret-first HTTP authentication, REF/AWB verification, history, stale/duplicate decisions and private Broadcast are retained.
- Only after the original function reports a genuinely new, non-stale committed-state candidate does the wrapper compare old/new normalized shipment state and record the intent inside the same transaction. Duplicate/enrichment callbacks and unchanged states never capture again. Manual job maintenance and mapping edits alone have no SMS trigger. Comparing the previous observation under the current resolver also prevents a mapping correction from masquerading as a new milestone on the next provider observation.
- Extends the existing intent eligibility helper with shipment/current-state/mapping/time checks. Existing queue claim, begin-dispatch and final post-DNS checks automatically consume that helper for both order and PDC intents. Order eligibility retains the original implementation.

No Vue component calls SMS for a courier event. No PDC route constructs XML or calls Vodafone. The PDC RPC returns its original tracking outcome, without communication payloads, and HTTP success still follows database persistence. The existing authenticated SMS worker prepares both consumers through the same bounded claims, central normalization/segment/rendering utilities and atomic `sms_enqueue_order_event` → `sms_enqueue` transaction. Intent completion and central batch linkage commit together. Traffic is always Notification, with one recipient; Campaign context is rejected.

## Deduplication and repeat attempts

Stable identity: `pdc:<shipment job UUID>:<saved AWB>:<event type>`. A unique shipment/AWB/event index adds database protection, and existing central content-bound idempotency/leases prevent duplicate queue writes or uncertain resends. Webhook/reconciliation share the PDC history deduplication and this logical notification identity. Suppressed events are consumed permanently, including later enablement or state re-entry.

Existing PDC numeric events are identified by AWB + StatusID, excluding date/name/reason. A repeat visit to the same ID is already collapsed by tracking; different IDs or timestamps do not establish a reliable independent delivery-attempt number. Therefore **one exception communication per AWB** is the conservative supported policy. Distinct repeat-attempt messaging is not claimed. Provider clarification and a separately reviewed tracking event identity are prerequisites for changing that policy; this feature does not redesign PDC deduplication.

## Time, ordering and reconciliation

The existing PDC function preserves older/equal-time observations in history without replacing current shipment state. A reconciliation query begun before an intervening callback also remains stale. SMS capture requires the original function's new/non-stale decision and a real normalized transition. Older Out for Delivery after Delivered cannot regress tracking or create an SMS. Once durable history records delivered, later contradictory Out for Delivery/attempt states cannot create another customer communication, even with newer timestamps.

A dated provider observation before the event's feature capture marker creates no communication intent. No historical scan/backfill/replay is performed. For eligible new observations, sending additionally requires the actual provider timestamp to be on/after the latest relevant event/provider configuration time. Events before later enablement/configuration are terminal `stale_event`, never activation catch-up. Missing configuration remains disabled.

Undated reconciliation remains useful tracking data, but cannot establish occurrence after activation. It creates terminal `event_time_unknown` communication history when otherwise configured. Later dated duplicate enrichment cannot revive it. **Dated**, genuinely new reconciliation transitions can notify and deduplicate against their webhook.

PDC communication expiry is the earlier of capture + ten minutes and provider-event time + ten minutes. The existing three-attempt, 30-second preparation retry bounds remain. Provider times over five minutes ahead of the local clock are suppressed. Provider timezone parsing is unchanged. These conservative freshness limits intentionally skip delayed/obsolete observations rather than notify from historical state.

Before dispatch, linked shipment/AWB/order/event existence, current normalized state and current resolver mapping must still match the intended event. Shipment advancement, removal, remapping, event/provider/template changes and expiry invalidate pending or queued work. The final post-DNS guard stops an ineligible first provider operation. An already authorized request in flight cannot be recalled.

## Templates, recipient, language and controlled reasons

Existing Provider settings shows a separate three-event PDC group beside the four order controls. It reuses `GET/PATCH /api/admin-sms/order-events`, settings permissions/revision validation and central Templates editing. Both bindings must be enabled Notification templates with the correct translation and supported variables. Selecting/saving an event does not activate Vodafone. Audit action `sms.pdc_event.update` stores only event/binding/enablement identifiers.

Allowed PDC variables: `customer_name`, `order_number`, `awb`, `courier_name`, `delivery_reason`. Names/order references/contact are authoritative order snapshots; AWB is the verified persisted shipment value; courier is PDC. No REF/toRef, internal job/event IDs, raw status IDs, notes or diagnostics are template variables.

Use only the order's phone snapshot and existing central MSISDN normalization; no account-phone fallback. Missing/invalid phone safely skips SMS while tracking succeeds. Snapshot EN/AR locale is reused, with the existing English default for historical orders. Names, phone and provider text never determine language. The central ten-segment/4,000-character bounds accept legitimate Arabic UTF-16 output while limiting accidental expansion.

If a template requests `delivery_reason`, preparation reads only the linked private tracking event's reason and passes it through the existing `shipmentReasonKey` whitelist and EN/AR customer catalog. Unknown reasons become the neutral localized “Please contact us for help” category. Raw reason/status text is never substituted or copied into an SMS intent, message, browser history, audit or log. Template evaluation remains literal safe substitution, without executing code.

## Disabled behavior, isolation and privacy

Disabled provider/event or unavailable template/configuration produces terminal suppression, never an ordinary future-sendable central batch. Runtime encryption readiness is checked before preparation. Existing revisions/template timestamp/final guards and freshness limits prevent stale enablement. There is no resend/backfill control.

Normal intent capture shares the trusted PDC transaction, so rollback cannot leave a message for uncommitted tracking. Communication capture executes in an isolated subtransaction: unexpected storage/timeout failures log SQLSTATE only and attempt a thin terminal `capture_failed` audit. If all intent storage is unavailable, even that audit can be lost; trusted tracking/history/Broadcast still commit, and retries remain canonical duplicates without historical SMS replay. This degraded audit guarantee matches the conservative Order SMS failure boundary. Tracking persistence itself still fails/retries normally and is never falsely acknowledged merely for messaging.

Queue insertion/provider delivery occur later. Storage failures retain bounded preparation retries; provider uncertainty uses the existing terminal uncertain policy and never changes tracking or commerce. Vodafone latency cannot delay webhook acknowledgement. No new outbound request exists in PDC ingestion.

Existing SMS History shows order reference, AWB, courier event category, template, language, masked recipient, Notification sender/traffic, intent/queue state, safe suppression/failure reason, actual provider event time separately from ingestion, ExternalTrxId and central provider outcomes/segments. Private internal event/job links, intent payload/template body, raw provider reasons/statuses, customer name/phone and all credentials are excluded from the projection. Existing SMS/PDC RLS and staff/customer ownership rules remain. Renamed PDC implementation and original eligibility helper are owner-only; public wrappers remain service-only. No customer SMS panel or tracking UI redesign.

## Local validation and limits

- `node --test tests/*.test.mjs`: **432 passed, zero failed, one existing optional native Paymob skip** (433 total).
- `node --test tests/pdc-sms.test.mjs tests/pdc-tracking*.test.mjs tests/order-sms.test.mjs tests/sms-*.test.mjs`: **151 passed, zero failed/skipped**. Includes new integration tests plus all PDC, Order SMS and SecureHash/queue/RBAC/XML/security regressions.
- `npm run typecheck`, `npm run build`, `git diff --check`: passed. Nuxt commands used `env -u DEBUG`; existing ERP duplicate-import/sourcemap/chunk warnings remain.
- Actual SMS/PDC-controls/history/checkout/order Dashboard/Live Chat Vue fixtures: **543 assertions, 96 screenshots, zero errors/external requests**. EN/AR/RTL, desktop/mobile, Light/Dark/System, controls/bindings/save/reload/read-only rights, masked AWB/provider-time/central outcomes, actual Cash checkout metadata, processing/cancellation and actual styled chat launcher open/close.
- Existing PDC Dashboard/My Account tracking Vue fixtures: **495 assertions, 48 screenshots, zero errors/external requests**, eight tracking scenarios, EN/AR/RTL/desktop/mobile/Light/Dark/System, chronology/reconciliation/unknown/exception/no-shipment, secret masking and existing local mapping/lookup actions.
- Built localhost HTTP/SSR/public artifacts: **980 assertions, 20 requests, 115 public files, seven fictional private value types, zero exposures**. SMS/PDC anonymous APIs, unsigned webhook, worker secret denial and EN/AR SMS login guards. Local servers stopped after validation.
- Tests use disposable PGlite application schema, real H3 webhook/staff handlers, mocked identity/provider transport and local-only browser fixtures. Concurrent asynchronous canonical updates/worker calls prove actual SQL uniqueness/leases; independent native PostgreSQL sessions, authenticated production acceptance and real provider/timezone/billing behavior are not claimed. No production credentials were required.

Evidence: `/tmp/elcomputer-pdc-sms-{focused,handlers,integration,suite,typecheck,build,browser,tracking-browser,http}.log` and `/tmp/elcomputer-pdc-sms-review/{sms-browser,tracking-browser}/`. Early fixture issues were corrected; accepted results above are from final passing runs. Arabic mobile Dark PDC history and styled Live Chat screenshots inspected.

## Requested 32-point report

1. **Audit:** mandatory docs and actual PDC/SMS/Order SMS/phone/locale/security/lifecycle paths inspected.
2. **PDC states:** all 17 existing normalized states listed above; raw ambiguity/97 preserved.
3. **SMS mapping:** only `out_for_delivery`, `delivery_attempted`, `delivered` transitions.
4. **Reuse:** existing configuration/intents/templates, Notification service/queue/worker/history, segmentation/encryption/RBAC and PDC canonical durable resolver.
5. **Files:** shared event metadata, existing intent helper/settings audit/history/SMS page, EN/AR catalogs, one migration, new integration tests, existing H3/SQL fixtures, browser/HTTP scripts and project/PDC/SMS docs.
6. **Schema:** extend two existing private tables; three disabled central templates/bindings; shipment/event/time metadata, equivalent order uniqueness plus shipment uniqueness and canonical/eligibility wrappers. Unapplied to production.
7. **Events:** Out for Delivery, Delivery Exception/failed attempt, Delivered; no Dispatch.
8. **Controls:** three separate default-off PDC switches in existing Provider settings.
9. **Bindings:** central EN/AR Notification templates with central approved/default sender.
10. **Recipient:** order phone snapshot only; normalize centrally; invalid contact skips, no fallback.
11. **Locale:** persisted order EN/AR, otherwise established English default.
12. **Webhook:** canonical `shipping_record_pdc_event` after secret/REF/AWB/dedup/order checks; no HTTP route authentication change.
13. **Reconciliation:** same canonical function; fresh dated transition eligible, undated observation terminal, no independent sender.
14. **Idempotency:** stable shipment job/AWB/event key plus unique index and existing central batch idempotency/leases.
15. **Overlap:** existing PDC canonical deduplication and shared SMS identity prevent webhook/reconciliation duplicates.
16. **Attempts:** once per AWB because current provider identity cannot safely distinguish independent repeat attempts; future policy requires provider clarification/separate review.
17. **Ordering:** preserve original provider-time/query-start guards; skip duplicate/stale transitions, old feature/configuration times, expired/undated events and obsolete queued states; no attempt/OFD SMS after durable delivery.
18. **Reasons:** existing controlled reason whitelist/EN/AR catalog only; unknown neutral, raw text remains private PDC data.
19. **Disabled:** terminal suppression; no future-sendable backlog or re-entry resend.
20. **Historical:** migration mutates no PDC history/job/mapping/provider data and performs no communication backfill; pre-feature observations cannot notify.
21. **History:** existing masked staff projection adds AWB/provider time alongside event/template/locale/central outcomes.
22. **Security:** retained settings/templates/history permissions, RLS, service-only wrappers, owner-only implementations, existing secret-first webhook/worker authentication, private projections/audits.
23. **Tests:** new normalized lifecycle/dedup/ordering/attempt/reason/config/phone/locale/traffic/failure/HTTP/queue tests; actual H3 controls/audits/history privacy expanded.
24. **General validation:** 432 full passes/one optional skip, 151 focused passes, typecheck/build/diff check passed.
25. **Browser:** 543 SMS/regression + 495 tracking assertions, 144 screenshots, no errors/external requests; fixture acceptance only.
26. **PDC production API:** NO. GetShipmentsStatus tests inject a mock response; no real shipment.
27. **Vodafone API:** NO. All provider transport is mocked; protocol/INC000081856720 unchanged.
28. **Real SMS:** NO.
29. **Production migration:** NO.
30. **Production deployment:** NO.
31. **Before activation:** reviewed migration/guarded matching release from the authorized deployment computer; keep provider/events off; authenticated staff/customer/private Broadcast acceptance, confirmed PDC normalization/timezone/response/attempt identity, provider provisioning/approved translations/senders/contact policy and separately authorized activation/provider tests. No scheduler or webhook registration changed here.
32. **Recommended future feature:** separately scoped OTP security design after release/acceptance planning, with abuse/rate/resend/verification safeguards. No OTP, NPS, returns/warranty, pickup or another feature was begun.

```text
PDC SMS INTEGRATION IMPLEMENTED: YES
OUT FOR DELIVERY SMS CONNECTED: YES
DELIVERY EXCEPTION SMS CONNECTED: YES
DELIVERED SMS CONNECTED: YES
PDC SMS CONFIGURATION DASHBOARD-MANAGED: YES
PDC SMS IDEMPOTENCY DATABASE-BACKED: YES
WEBHOOK/RECONCILIATION DUPLICATES PREVENTED: YES
HISTORICAL PDC EVENTS BACKFILLED INTO SMS: NO
DISABLED EVENTS CREATE FUTURE-SENDABLE BACKLOG: NO
ORDER SMS REGRESSED: NO
VODAFONE ENABLED: NO
REAL PDC PRODUCTION API CALLED: NO
REAL VODAFONE API CALLED: NO
REAL SMS SENT: NO
OTP CONNECTED: NO
NPS CONNECTED: NO
RETURNS/WARRANTY SMS CONNECTED: NO
PRODUCTION MIGRATION APPLIED: NO
PRODUCTION DEPLOYED: NO
```

Connected means local code, not activation or a production release. STOP after PDC → SMS integration.
