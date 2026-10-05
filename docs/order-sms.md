# Order SMS notifications — local implementation, 2026-10-05

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
