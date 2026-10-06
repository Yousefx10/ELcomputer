# PDC → SMS customer notifications — local implementation, 2026-10-06

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
