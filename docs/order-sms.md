# Order SMS notifications — dormant production deployment, 2026-10-06

Local PDC → SMS now extends the same private intent/settings machinery without changing these four order-event semantics. It has a separate unapplied migration/release; see [pdc-sms.md](pdc-sms.md). This Order SMS deployment record remains unchanged historical provenance.

The requested implementation is deployed without further application-code changes. All four events, seeded templates and Vodafone remain disabled. This record supersedes the historical local-only release status below. Date: Asia/Riyadh; guarded backup timestamps use UTC.

1. **Synced branch and HEAD:** clean `main`, `e0d0de12d16efdc182891ee92e0bc74b9d3df9b9`. Normal fetch/fast-forward verification matched `origin/main` without a reset or loss of later legitimate deployment documentation. Subsequent documentation-only commits are separate from deployed application identity.
2. **Feature contained:** the deployed HEAD is the requested `e0d0de12d16efdc182891ee92e0bc74b9d3df9b9`; its ancestry includes the earlier SMS deployment and production-infrastructure records.
3. **Pre-deployment validation:** Node 24.16.0; 401 full-suite passes, zero failures, one existing optional native Paymob skip; all 78 focused Order SMS/SMS passes, including Vodafone literal-key fixtures. Typecheck/build/diff check/preflight passed. Actual Vue/preferences/checkout/order fixtures: 432 assertions/72 screenshots/no errors/external requests. Built-local HTTP/SSR/artifacts: 948 assertions/16 requests/115 public files/seven fictional private types/zero exposures. Existing duplicate ERP import/sourcemap/chunk warnings remain; no code fix was required.
4. **Migration applied:** only `20261006100000_order_sms_notifications.sql`, reviewed SHA-256 `988c6fb47ad1547081f8e938316d91aee517b1e4738a6287e61460f2737274b0`. Adds a default English order locale, two private event/settings tables, four disabled central bilingual Notification templates, transaction/queue wrappers and existing full-reset awareness. No reset, historical replay or message backfill occurred.
5. **Migration alignment:** all 60 local/remote migrations align; no expected migration is pending. The non-fatal Docker catalog-cache warning was followed by successful native history/schema/security/data verification.
6. **Two-computer consistency:** compared every repository version/name against native `supabase_migrations.schema_migrations`, before and after push. Before: 59 matching identities and only the intended Order SMS migration pending. After: all 60 exact version/name matches, no missing, remote-only or unexplained identity. Prerequisite checkout/preorder/SMS/reset signatures exist.
7. **Guarded release:** `env -u DEBUG npm run deploy` completed preflight, fresh secret-free build, `.output`-only upload, backup, scoped restart and internal/public health. No dotenv upload, networking/server configuration or unrelated site/process change. All 712 deployed entries match local output; manifest digest `d6fe58ed9fb8a618212fa782012fca1900bbcc513d7dd75737a58296a32c7e73`.
8. **Deployed commit:** `e0d0de12d16efdc182891ee92e0bc74b9d3df9b9`. The reviewed feature was not reimplemented or redesigned; only release documentation changed afterward.
9. **PM2/health:** `new-elcomputer` online, `/home/newelcomputer/htdocs/new.elcomputer.net`, `.output/server/index.mjs`, port 3001 and expected Node 22.23.1 interpreter. One restart, 39 → 40. Error-log bytes/hash are unchanged through final acceptance.
10. **Dashboard Order SMS:** actual component fixtures verified four controls, EN/AR bindings, default-off state, permission/read-only behavior, templates/history and masking. Live private database reads confirm matching bindings and disabled templates; production Orders/SMS routes enforce Dashboard login. This does not establish signed-in production UI acceptance.
11. **Authenticated acceptance:** **NOT VERIFIED**. No established authorized production test session/account workflow was available. No account was created/impersonated, credentials sought or real order modified. Staff settings save/reload and live role behavior require separately authorized authenticated acceptance.
12. **Event states:** Order confirmed **OFF**, Payment confirmed **OFF**, Processing **OFF**, Cancelled **OFF**; config revisions remain zero. All four seeded bilingual Notification templates remain disabled. Vodafone stays disabled; no sender or merchant value was configured.
13. **Queue/backlog:** zero `sms_order_events`, batches, messages and attempts at final read. No historical order produced a sendable intent or future-activation backlog. Disabled capture creates terminal suppression in actual isolated SQL tests; live trigger/function guards were inspected without order mutation.
14. **Historical safety:** 22 business/settings fingerprints match the pre-release baseline, ignoring only the new locale column. Eight orders/twelve items, 91 products/91 variants, customer/staff/settings/shipping/payment/ERP/chat/NPS rows are unchanged. Existing orders safely default to English; no status/payment/cancellation event was manufactured. Provider settings fingerprint is unchanged.
15. **Database idempotency/atomicity:** live unique constraints cover `idempotency_key` and `(order_id,event_type)`, plus one linked batch per intent. The transition trigger captures committed inserts/paid/processing/cancelled changes, and `sms_enqueue_order_event` links/completes through the central enqueue in one SQL transaction. Repeated saves/re-entry/replays, locale/contact/money snapshots, Cash versus paid, preparation retries, revisions/expiry/final dispatch and downstream failure isolation passed actual isolated migration tests. Original six checkout/preorder/queue/reset implementation bodies retain their pre-migration hashes.
16. **Native concurrency:** **NOT VERIFIED** for independent native PostgreSQL Order SMS sessions. Current focused concurrency/lease checks use disposable PGlite application-schema databases. The optional native harness requires local binary/driver configuration and remains the existing skip; no isolated native Order SMS harness was configured. No artificial production order/customer/race mutation was performed. Uniqueness/atomicity inspection above is separate evidence.
17. **RBAC/RLS:** both new tables have RLS, no browser policies and no anon/authenticated SELECT/INSERT/UPDATE/DELETE grants. All 19 reviewed helpers/wrappers deny browser execution, including renamed implementation functions. APIs retain existing `sms.settings.view/manage`, `sms.templates.view/manage` and `sms.history.view`. Anonymous event settings GET/PATCH, SMS settings/templates/history/send and worker access fail closed/private,no-store. Restricted/customer identities pass isolated handler/SQL tests; real signed-in role acceptance is unverified.
18. **Secrets/privacy:** encryption/worker infrastructure remains ready with persisted secrets unchanged. Scan of 118 public files against three distinct running-process private values, 20 server responses and logs found zero infrastructure exposure. Eight real orders supplied only in-memory ID/number/unpublished-phone candidates for 118 files/nine anonymous response scans; zero exposures and no values printed. All 2798 browser response scans and local fictional-secret/privacy tests passed. History selects masked phone/safe diagnostics, excluding intent payload, customer name, message/template body and credential ciphertext. No fake production history/message was inserted for testing.
19. **Regression checks:** 161 HTTP assertions/38 requests and 594 browser assertions/84 page states passed. Homepage, real product, local cart persistence, checkout/login/account protection, Orders/SMS Dashboard/tab protection, templates/history API guards, Live Chat open/close, EN/AR/RTL, desktop/mobile Light/Dark/System all passed without browser errors/provider requests/commerce writes. Authenticated checkout/account/chat messaging interiors remain outside verified acceptance.
20. **Vodafone enabled:** **NO**. Disabled guards remain effective; actual provider settings and encrypted credential-presence state are unchanged.
21. **Vodafone credentials changed:** **NO**. Account/password/hash secret, host/port/senders remain empty. Existing server master/worker secrets were neither regenerated nor altered by this release.
22. **Real Vodafone request:** **NO**. No connectivity test, provider registration, trusted-IP operation or real transport was invoked. Tests use mocked transport; production worker authentication checks use deliberately malformed JSON after successful auth so preparation and central queue processing cannot execute.
23. **Real SMS:** **NO**. No manual send, campaign, valid queue-processing request or real order event was performed. No scheduler was installed/changed. Missing/invalid worker secrets return 401; valid authentication reaches malformed-body validation and returns 400 without processing. Existing encryption/worker readiness remains true.
24. **Rollback backup:** `/home/newelcomputer/htdocs/new.elcomputer.net/.output-deploy-backup-20261005-221154-51073`; all 710 files/symlinks match the pre-release production manifest. Backup readable, rollback unused. Use the existing guarded rollback contract and retain the additive migration if reverting application output.
25. **Remaining activation requirements:** separately authorized signed-in staff/customer acceptance, native concurrency acceptance where a safe isolated harness is provided, merchant credentials/modern-TLS endpoints/approved senders/trusted outbound IP/account provisioning, approved EN/AR Notification templates and order snapshot phone/locale review. Keep all events/Vodafone off until explicit activation authorization. No PDC/OTP/NPS/returns/warranty/pickup or another consumer begins here.

```text
ORDER SMS CODE DEPLOYED: YES
ORDER SMS MIGRATION APPLIED: YES
LOCAL/REMOTE SUPABASE MIGRATIONS ALIGNED: YES
ORDER CONFIRMED SMS ENABLED: NO
PAYMENT CONFIRMED SMS ENABLED: NO
ORDER PROCESSING SMS ENABLED: NO
ORDER CANCELLED SMS ENABLED: NO
HISTORICAL SENDABLE SMS BACKLOG CREATED: NO
VODAFONE ENABLED: NO
VODAFONE CREDENTIALS CHANGED: NO
REAL VODAFONE API CALLED: NO
REAL SMS SENT: NO
PDC SMS CONNECTED: NO
OTP CONNECTED: NO
NPS CONNECTED: NO
RETURNS/WARRANTY SMS CONNECTED: NO
AUTHENTICATED PRODUCTION INTERIORS: NOT VERIFIED
NATIVE INDEPENDENT-SESSION ORDER SMS RACES: NOT VERIFIED
```

Evidence: `/tmp/elcomputer-order-sms-deploy-20261006/` contains validation, preflight/deploy logs, identity/security/data checks, source/output/rollback fingerprints, production HTTP/browser reports and isolated screenshots. Documentation is committed/pushed separately; no secret or real customer value is recorded. STOP after this release and verification.

## Historical local implementation — 2026-10-05

This feature connects website order transitions to the existing central SMS foundation. It is implemented and validated locally. The development computer intentionally has no production access; no production credentials were sought, copied, inferred, generated or changed. Production infrastructure readiness is taken from the user's request and the committed readiness record, not a new live inspection.

## Audit and lifecycle

Reviewed project instructions/state/handoff, SMS report/security review and usage, Paymob/payment documentation, actual schema/migrations, checkout/RPCs, order administration/packing, account/contact fields, locale/theme utilities, SMS templates/jobs/history and tests.

Website orders are `customer_orders`, not ERP/manual sales. Checkout requires an active authenticated customer profile; guest checkout is not supported. Normal orders start `pending_payment`; preorders start `on_hold`/`awaiting_stock`. Canonical fulfillment uses `processing`, then packing/`ready_to_deliver`; legacy `in_progress` is retained without inventing another status. Existing final states include `completed`, `refunded` and `cancelled`. Packing-session cancellation is distinct from cancellation of the order.

Order payment is a separate `pending`/`partially_paid`/`paid`/`failed`/`refunded` state. Cash placement does not record paid. Authorized verified preorder receipts move partial balances to `partially_paid` and full balances to `paid`; preorder release separately requires stock and full payment. Paymob attempts/transactions have their own states. TEST success never settles commerce. Existing LIVE-only reconciliation changes commerce only after bound authoritative success, protects replay/stale callbacks and rejects settlement of cancelled/refunded orders. Live gateway activation remains outside this feature.

There is no generic order-notification outbox or persisted order/customer locale or transactional SMS preference. Existing ERP jobs are connector-specific and must retain their ownership behavior. Chat/support/order messages are in-app conversations, not outbound SMS. The existing checkout transaction, cart idempotency, pricing/payment guards and built-in/Daftra branch are retained.

## Event mapping and trigger locations

| Dashboard event | Authoritative trigger | Default template code |
| --- | --- | --- |
| Order confirmed | Successful `customer_orders` INSERT; means order placed, not payment received | `order_confirmed` |
| Payment confirmed | UPDATE from another payment state to `paid` | `order_payment_confirmed` |
| Order processing | UPDATE from another order status to `processing` | `order_processing` |
| Order cancelled | UPDATE from another order status to `cancelled` | `order_cancelled` |

`capture_order_sms_events` runs inside the actual business transaction. It covers normal/preorder checkout, trusted staff status updates, verified payment recording, preorder release, packing/problem workflows that actually change the order, and Paymob settlement. Failed validation, rejected cancellation, rollbacks and repeated unchanged saves create no committed notification. No Vue component decides or requests an order SMS.

No historical orders/events are replayed by the migration. Payment confirmed and Processing can be separate intents from one committed settlement. No paid notification is generated for TEST callback success, unpaid Cash placement, receipt proof alone or a redirect query.

## Durable intent and central queue

Additive, unapplied migration: `20261006100000_order_sms_notifications.sql`.

- Adds `customer_orders.sms_locale`, private four-row `sms_order_event_settings`, and private `sms_order_events` transition intents. Existing bodies remain in `sms_templates`; delivery remains exclusively in `sms_batches`, `sms_messages` and `sms_attempts`.
- Seeds only four bilingual Notification templates, disabled, without replacing any existing matching template code. Event controls also default disabled. No provider setting is enabled or changed.
- Wraps the existing checkout RPCs to pass a whitelisted transaction locale to an INSERT snapshot trigger. Original transactions, ERP ownership branches, cart locks, pricing, fees, inventory and payment guards still run.
- Stores a stable `order:<UUID>:<event>` identity with a unique key and `(order_id,event_type)` uniqueness. Re-entry, reversals, repeated paid updates, browser retries and worker retries never create a second notification for that logical event. A previously skipped event is consumed permanently; it is not eligible after later activation.
- Extends the existing authenticated `/api/internal/sms/process` worker: bounded preparation first, then the existing SMS queue. Intents use leases; interrupted preparation can recover because it has not sent anything externally.
- `createSmsService(...).sendNotification` uses `sms_enqueue_order_event` for an order intent. That RPC rechecks its lease/configuration and invokes the existing `sms_enqueue`, then links/completes the intent in the same transaction. There is no gap between central queue insertion and intent completion. Campaign is rejected for order context.

Order intents expire ten minutes after the committed transition. Rendering/queue preparation storage failures have at most three attempts and 30-second spacing within that expiry. This preparation retry is separate from the existing conservative provider retry policy. Provider rejection/uncertainty still uses the central queue and never changes commerce or automatically resends an uncertain message.

## Dashboard, templates and permissions

The existing Provider settings tab contains four event controls and separate English/Arabic template bindings. It saves through `GET/PATCH /api/admin-sms/order-events`, using existing `sms.settings.view/manage`. Settings revisions reject stale saves. Disabling remains possible even if an old binding is invalid.

Templates are selected and edited in the existing Templates tab with existing `sms.templates.view/manage`. Both bindings must reference enabled Notification templates with the corresponding translation before an event can be enabled. Sender selection remains in the central template/default approved-sender architecture. Selecting/saving an event never enables Vodafone.

Allowed variables: `customer_name`, `order_number`, `order_total`, `currency`, `order_status`, `payment_method`. Only order snapshot data supplies them. Unknown/code-like placeholders fail; substitution never executes code. Rendered output uses the central MSISDN/segment/XML checks, the foundation's 4,000-character bound and a ten-segment transactional cap. Arabic UTF-16 messages are supported.

New tables have RLS and no anon/authenticated grants or browser policies. Worker/configuration RPCs are service-only, and renamed implementation functions cannot be called by browser roles. Staff setting audits contain event/enablement/binding identifiers only. The worker validates its existing private secret before body/database access. No new runtime secret or permission system was introduced.

## Recipient, language, money and privacy

Use only `customer_orders.phone`, the checkout contact snapshot. Never resolve an older order through a changed account phone, and never infer identity from an arbitrary phone. Missing/invalid order phones are skipped without blocking commerce; there is no account-phone fallback. This worker does not require a customer session to deliver an already-authorized order intent. No guest checkout or marketing-consent system was added.

Checkout passes only `en`/`ar` as transaction metadata; the server validates it. The existing checkout RPC records the locale at insertion before the intent trigger runs. Older callers, direct inserts and historical rows default English. Neither names nor phone numbers determine language. There is no account-locale fallback because no authoritative stored preference exists.

`order_total` is the committed PostgreSQL order snapshot, including the existing fee calculation. It is never recalculated from current products or frontend totals. Formatting reuses account-money and `formatLocale` utilities, including EGP/Latin-digit Arabic formatting. Status/payment method labels reuse the existing localization catalog. Private intent payloads contain only required order-contact/business snapshots; no credential, payment-provider secret, staff data, internal note, fraud or supplier field is captured.

## Suppression and failure safety

Provider disabled/unconfigured, event disabled and unavailable bindings/translations at capture produce terminal `suppressed` intents with safe reason codes, not central queued messages. The worker also rejects missing encryption readiness, invalid recipient/template, oversized output, removed orders, expiry and changed configuration. A short-lived pending intent created under enabled, configured database settings must pass runtime readiness before central enqueue; it cannot survive its ten-minute expiry.

Provider/event revisions and the selected template timestamp are captured. Changing, disabling or re-enabling configuration invalidates older work. The existing queue's claim/begin/final post-DNS authorization is extended only for linked order intents. Ineligible queued order batches become failed; the final check prevents a disabled/changed event from making its first provider operation. An already authorized request in flight cannot be recalled, as with the original foundation.

Intent insertion participates in rollback with commerce during normal operation. If notification storage unexpectedly fails, the trigger catches that side-effect failure and attempts a terminal `capture_failed` record; if even that record is unavailable, it logs only SQLSTATE. Commerce still commits. That degraded case cannot guarantee an intent/audit row, and there is no automatic historical replay. Queue/provider failure happens downstream after commerce is committed.

## Shared SMS history

The existing History tab adds order intents, including skipped ones, under `sms.history.view`. It shows order reference, event, masked recipient, template, locale, approved sender, Notification traffic, safe reason/timestamps and the linked central batch's actual state, ExternalTrxId, attempts/provider diagnostics and encoding/units/segments. Standard batch/attempt history remains available. Both lists use the existing page control with bounded 25-row projections.

The API selects no intent payload, template snapshot body, customer name, message body or ciphertext. Suppressed phones show only a masked suffix; normalized queue recipients keep the foundation's mask. No credential/hash input/raw provider error is logged or returned. Only fictional test values were used.

## Validation

All checks are local, with disposable application-schema PostgreSQL-compatible PGlite databases, actual H3 handlers and mocked identities/transports. Browser fixtures compile the actual Vue components and block external requests. Production credentials are intentionally unavailable and were not needed.

- Focused Order SMS + all SMS regressions: **78 passed, zero failed/skipped**.
- Full suite: **401 passed, zero failed, one existing optional native Paymob skip** (402 total). Typecheck, build and diff check passed; exact commands/warning context are recorded in `sms-report.md`.
- Browser: **432 assertions, 72 screenshots, zero console/runtime errors or external requests**. SMS settings/templates/history, event enablement/binding/save/reload, permissions/masking, actual Cash checkout locale/contact request and actual order Dashboard/dialog processing/cancellation. EN/AR/RTL, desktop/mobile and Light/Dark/System. Arabic mobile Dark settings/history screenshots inspected.
- Built localhost HTTP/SSR/public artifacts: **948 assertions, 16 requests, 115 public files, seven fictional private value types, zero exposures**. Anonymous order/SMS controls and missing/invalid worker authentication denied; EN/AR SMS login guards passed.
- SQL tests cover transaction rollback, defaults/no replay/PDC preservation, paid/partial receipts, Cash, TEST/LIVE fixture replays and late cancelled payment, transitions/re-entry, disable/no backlog, phone snapshot/invalid/no fallback, locale/money/all variables, Unicode bounds, central mocked Notification serialization, queue storage failure/recovery, concurrent asynchronous preparations, lease recovery, configuration expiry and final post-DNS disablement. Capture failure cannot roll back an order.
- Concurrency coverage uses concurrent asynchronous calls to the real SQL/lease functions in one isolated PGlite database. Independent native PostgreSQL sessions are not claimed; the existing optional native Paymob test remains separately opt-in.

Evidence: `/tmp/elcomputer-order-sms-{focused,suite,typecheck,build,browser,http}.log` and `/tmp/elcomputer-order-sms-review/browser/`. Failed early fixture runs were corrected; accepted counts above are from final passing runs. Temporary browser/HTTP servers are stopped after validation.

## Requested final report

1. **Audit:** existing server lifecycle, authoritative snapshots, payment protection and central SMS were inspected; no generic notification outbox/preference/locale existed.
2. **Order lifecycle:** placed INSERT, canonical `processing`, actual `cancelled`; normal pending payment and held preorders preserved.
3. **Payment lifecycle:** only commerce transition to `paid`; partial receipts, Cash and Paymob TEST are distinct.
4. **SMS reuse:** central templates/encryption/normalization/rendering/segments/Notification service/queue/worker/history/RBAC and audited INC000081856720 protocol.
5. **Files:** migration; shared order-variable metadata; server intent/settings helper and two staff routes; existing checkout locale metadata, worker/service/history and SMS page; locale catalogs; reset allowlist; SQL/API fixtures/tests; browser/HTTP scripts; project/SMS/order docs.
6. **Database:** one unapplied additive migration, two private intent/configuration tables, locale snapshot, four disabled central templates, wrappers/guards and full-reset awareness; no historical rewrite.
7. **Events:** confirmed/placed, authoritative payment confirmed, processing, cancelled.
8. **Controls:** four default-off events in existing Provider settings.
9. **Bindings:** English/Arabic central Notification templates; sender remains centrally configured.
10. **Phone:** order snapshot only; no fallback; invalid contacts skip safely.
11. **Locale:** checkout snapshot; validated EN/AR; English fallback.
12. **Triggers:** transactional database INSERT/transition trigger covers trusted APIs/RPCs; no frontend SMS request.
13. **Outbox:** durable intents then atomic central enqueue/completion, bounded authenticated worker.
14. **Deduplication:** order/event uniqueness plus existing central batch idempotency and leases; one event lifetime per order.
15. **Disabled:** terminal reason/history without a future-sendable queue; revision/expiry guards prevent stale activation.
16. **Cash:** placement confirms the order only, not payment.
17. **Payment:** verified paid transition only; existing replay/test/cancellation guards untouched.
18. **Cancellation:** actual committed order state; rejected/rolled-back requests and packing-session cancellation do not qualify.
19. **History:** order intents and their central batch diagnostics in existing masked staff History.
20. **Security:** private RLS/service-only RPCs, existing settings/templates/history permissions/audits and private worker authentication.
21. **Tests:** focused real-schema SQL lifecycle/queue/suppression/retry/lease/privacy tests and expanded actual H3 settings/history/worker tests.
22. **General checks:** full suite, focused suite, typecheck, build and diff check; exact final counts in the SMS report.
23. **Browser:** 432 assertions/72 screenshots, EN/AR/RTL/desktop/mobile/themes, no console errors/external requests; fixture acceptance, not production acceptance.
24. **Vodafone API call:** NO; all provider transport is mocked.
25. **Real SMS:** NO.
26. **Vodafone enabled:** NO; only disposable fixtures enable their fictional provider.
27. **Before production:** review the additive migration/code; from the authorized deployment computer check migration parity, apply only reviewed work and deploy matching code through the guarded workflow. Keep Vodafone/events off. Run authenticated staff acceptance, review merchant translations/senders/contacts and separately authorize any activation/provider test. No scheduler was installed here.
28. **Next separate consumer:** PDC → SMS after this order feature's release/acceptance and a new explicit scope. No courier/OTP/NPS/returns/warranty/pickup or marketing consumer was begun.

STOP after this local order feature. Existing PDC webhook/status mappings and courier-state handling are unchanged; shipment-created/in-transit/delivered/returned notifications remain unconnected. No production migration/deployment, environment provisioning, real credential entry, provider activation or external Vodafone operation occurred.
