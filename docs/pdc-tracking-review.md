> **E166,31October2026:** [Bounded PDC tracking ACTIVE / zero-restart recovery COMPLETE](pdc-tracking-activation-review.md). Same473703da9917ba21/schema107/PID126398;fe7fad74 CONSUMED_COMPLETE, parent0f28 remains CONSUMED_STOP.0 extra restart/install/runtime/Email change. First empty batch plus4 natural empty batches/next22:00:08 MON/CARD/COD/Email PASS;0 AWBs/provider requests/reservations. Booking/webhooks OFF. Orders/history/configuration/emergency fences preserved; first genuine provider/customer timeline/PDF/callback acceptance pending. NEXT Google SEO/legacy redirects immediately; no PDC expansion or waiting. History/UI follow; Paymob paused, fees/ERP LAST.

> **E165,31October2026:** [Tracking activation CONSUMED_STOP; zero-restart recovery READY/UNAPPROVED](pdc-tracking-activation-review.md). Same473/schema107/PID126398, one restart used. Timer-state guard stopped BEFORE policy/first batch/timer activation; policyOFF/timerdisabled/0 eligible AWBs/provider requests. CARD/COD/Email/MON healthy; five original warnings/zero critical. All8 orders/payments/history/configuration preserved; only analytics grew. New16 guard tests/fresh read-only preflight PASS. Separate recovery reuses installed runtime/units,0 extra restart/install/key change; original empty-batch/timer/emergency fences retained. Next approve only the new recovery; SEO immediately after actual activation. No synthetic shipment/PDC expansion; Paymob paused, fees/ERP LAST.

> **E164,31October2026:** [PDC tracking activation SEALED READY / UNAPPROVED](pdc-tracking-activation-review.md). Production473703da9917ba21/schema107 unchanged;0 eligible AWBs. Fresh47 focused/caller/operator/connector tests,18 native assertions/451 browser assertions and read-only hosted preflight PASS. Separate scope: three tracking runtime inputs/caller/service/timer, one prospective app restart/Email timer pause, policy enable after normal MON, one empty first batch. Current caps2/minute,20/hour,100/day/concurrency1. Tracking/booking/webhooks still OFF;0 production writes/provider calls. One-use zero-restart tracking disable included. After approved activation, SEO/legacy redirects immediately without waiting for real AWBs; no PDC expansion. History/UI follow; Paymob paused, settlement/ERP LAST.

# PDC tracking — inactive107 release review

31October2026, E163 / SHIP-08 / SHIP-10. **SCHEMA107 DEPLOYED INACTIVE; hosted postflight PASS.**
Current production473703da9917ba21/schema107/source4d0bf6f130b5c91c1ecc2904eed3badfad8bc2bf.
Approval18490351 is **CONSUMED_COMPLETE**; previous label approval05fca90d also remains
consumed. Source descends from deployed4238e9258d896f2ad708b30143cfb8aabcf2bc6d.
Main is not deployed lineage. Polling/worker/webhook remain OFF; activation is separate.

## Reused implementation and changes

Reuse GetShipmentsStatus, existing status mappings, bounded dated REF/AWB filtering,
private shipping history, created-dispatch ledger, customer ownership and staff Orders
controls. The candidate adds a narrow tracking gate independent of the disabled
booking/global shipping gate, shared durable quotas/leases and verified timelines.
No new provider integration, financial subsystem, package dependency or pickup flow.

Only genuine normal production-account shipments with exact saved order/job/REF/AWB
and private created-dispatch proof qualify. Cancelled orders, historical uncertain
or unassigned/unverified/manual AWBs are excluded. Pending labels do not require
shipment recreation. Terminal shipments stop automatic polling; an age horizon and
failure cap prevent endless failed checks. New booking/recovery records the actual
AWB verification time. Old orders/bookings receive no timestamp backfill.

One provider-row lock serializes global quotas across worker instances/manual refresh.
A bounded500-entry reservation history enforces strict rolling minute/hour/day limits.
Two-minute token leases protect concurrency and stale acknowledgements. Empty or expired
tokens cannot fabricate successful-check freshness. Provider reads reserve first;
failures and uncertain acknowledgements consume their reservations conservatively.
Timeouts, redirect/body limits, exact unique matching and capped exponential backoff
apply. Staff refresh uses the same gates, policy, cooldown and quotas with retry0.
The worker imports no booking/label/reverse-write operation.

Defaults are15-minute per-shipment interval,2 requests/minute,20/hour,100/day,3 per
batch and1 concurrent; hard ceilings5/minute,60/hour,500/day,5/batch and2 concurrent.
Automatic pause follows8 failures,90-day default age horizon and one-hour stale
threshold. Failure backoff caps at24hours. Policy numbers remain configurable in
Dashboard within bounds; policy activation requires separate approved operations.

Polling and callbacks share atomic existing history and AWB+StatusID idempotency.
Unchanged/name-only responses deduplicate. Query-start chronology, progress watermark
and terminal guards withhold regressions. Numeric ID/label contradictions, including
the vendor illustration5/Shipped conflict, stay private for review. A terminal state
requires a configured matching label. Unknown97 semantics are never guessed. Raw
bounded status/code/reason/time/source are retained privately; arbitrary payload
fields are discarded. Contradictory deduplicated identities need reviewed evidence/
mapping recovery, not automatic reinterpretation. No financial/order transition occurs.
Private realtime emits only a changed signal; customer refresh reads stored data.

## Dashboard and customer readiness

Staff see AWB, current normalized status, successful provider-check/update times,
private history with timestamps/source, stale/error data and throttled manual refresh.
The compact existing design and label/booking controls remain. A maximum-length AWB
was visually inspected and its internal card overflow corrected/qualified.

My Account shows actual placement, existing verified payment/packing evidence,
verified shipment booking and accepted provider milestones. Unknown booking time is
not invented. CARD/COD payment status remains independent even for Delivered.
Customer APIs check ownership/account status before reads and again before return;
a binding hash rejects changed job identity. Raw diagnostics/internal notes/provider
identity are withheld. Failed/unavailable tracking has an honest state without
losing the owned order. EN/AR/RTL,1440/390 widths and Light/Dark/System are qualified.

## Webhook readiness

The existing six-page vendor guide specifies HTTPS POST/application/json,
X-Webhook-Secret, exact REF/AWB, status fields/time, acknowledgement within10seconds
and AWB+StatusID idempotency. No HMAC signature is invented. The retained handler
uses an independent encrypted minimum32-character secret, timing-safe authentication
before parsing,8KiB/2second body and7.5second deadline. Native/mock tests cover missing/
wrong secrets, exact identity, duplicate replay, wrong AWB, out-of-order input,
financial separation and polling/callback races through shared ingestion.

**Offline security qualification is complete. Live registration/authenticated callback/
account mapping/timezone acceptance remains unverified.** The new callback runtime
gate remains OFF. Polling works with webhook handling OFF and never waits for live
registration. No PDC contact, registration or provider request occurred.

## Qualification

| Check | Result |
| --- | --- |
| Label/policy unit checks |25 PASS |
| Native107 worker/auth/ownership/quotas/history + existing booking/label cases |40 PASS,0 skips |
| Existing PDC protocol/tracking suites |74 PASS,0 skips |
| Portable scheduler/caller guards |6 PASS |
| Automated total |145 PASS |
| Current tracking Dashboard/account/settings browser |451 assertions PASS |
| Existing label/browser |144 assertions PASS |
| Existing staff CARD/COD booking/browser |82 assertions PASS |
| Browser total |677 assertions PASS |
| Runtime/deployment and database guards |18+7 =25 PASS |
| Native106→107 migration/rollback |144 original projections preserved; schema restored |
| Typecheck / real public production build, Node22.23.1 |PASS |
| Compiled private routes/worker authorization/PDF parser |PASS |
| Exact guarded archive unpack/inventory readback |4,472 entries PASS |
| Every browser asset HTTP/SHA |3,475 PASS;3,364 retained immutable assets |
| Encrypted106 DB +14 protected runtime/Email/unit files |Authenticated full readback PASS |

Fixtures use disposable local data, mock provider responses and loopback browsers.
No synthetic production order/paid order/shipment, customer notification or real
provider call. All106 historical migrations and package/lock dependencies are
unchanged. The original older tracking491 harness/pre-COD fixture and their deferred
evidence are preserved; new current-component checks do not claim those passed.
All35 deferred IDs and original evidence remain; genuine acceptance is not closed.

## Smallest guarded release

One new migration `20261031030000_bounded_pdc_tracking.sql`,106→107:12 columns on
existing provider/jobs/history, two indexes, six new private/service functions,
four corrected existing functions. Existing private-dispatch/booking gates remain.
The migration preserves every original projection and emits no historical events.
One exact archive **473703da9917ba21**, source4d0bf6f, and **one app restart**.
Briefly pause the existing Email timer, let its running caller finish naturally,
restore once in finally. No manual Email worker, repeat delivery test or backfill.

**Tracking requests/worker/webhook runtime flags and policy stay OFF; new worker
secret absent. No scheduler/service installation or activation.** Caller/timer
portable templates are qualified for a subsequent separately approved activation.
No runtime/unit/Caddy/key/Auth SMTP/provider/booking/pickup/business pricing change.
CARD/COD/customer Email/MON and original emergency fences remain preserved. The
owner's current Dashboard COD fee10 is intentional; no fee is hardcoded/restored.
Current business settings are captured afresh in the transaction and preserved.

Private packet `../pdc-tracking-release-20261031/` contains plan/archive/inventory,
OPERATOR.md, immutable original emergency bindings, tests/backups and receipts.
Execution stages the candidate before one guarded SQL transaction, then commits
107 before cutover. Drift/uncertainty consumes the attempt: no replay, second
restart, automatic rollback or database restore. If SQL commits and cutover stops,
preserve the old serving app and prepare a fresh observed-state recovery seal.
Native rollback is pre-commit qualification only. Existing emergency commands
retain their original scopes and budgets, rebound to the installed new archive.

Postflight checks exact installed lineage/schema/security/runtime, CARD/COD/payment
integrity, private denial, every asset, active normal Email caller/timer and next
automatic MON. New metadata RPC readiness is a service-role SELECT-only null-order
probe, with no customer data or provider call. No forced scan or worker invocation.

## Pending acceptance and priorities

First genuine approved AWB: actual provider response/date/timezone/status mapping,
scheduled/manual tracking and real owned-customer timeline. Actual authenticated
callback acceptance follows only after registration/secret/mapping approval. Label
PDF/template/font/physical printer/paper/barcode acceptance remains DTR-21.
No use of the historical uncertain booking or cancelled COD, no fake replacement.

Separate tracking activation must bind the installed107 archive, independent root
worker secret, exact policy/caller/units, original emergency controls and one clear
tracking disable: stop the dedicated timer, then disable only tracking policy under
the approved fence. Webhook activation is independent. No booking/global PDC flag
is opened. After independent readiness, SEO/legacy redirects and historical
WooCommerce migration/UI proceed without waiting for real AWBs or callbacks.
Pickup is excluded; Paymob awaits its reply; fees/settlements/ERP/Daftra remain LAST.

## Historical exact deployment approval — CONSUMED_COMPLETE

```text
APPROVE PDC SCHEMA107 INACTIVE TRACKING DEPLOYMENT 184903519ef464d24e271439a660dc2ce5e8c551bef6285665d4a4c478440165
```

Expires **31 October 2026 19:20:08 Riyadh** (2026-10-31T16:20:08.035Z).
Execution must start before **31 October 2026 19:05:08 Riyadh**.
The owner supplied this exact approval. The single attempt completed successfully;
its expiry is historical evidence, not permission to replay the deployment.

**ONE next action: prepare the separate tracking activation packet.** Polling and
webhook activation remain separately gated; no new activation seal is issued here.

## Historical E162 read-only preflight — before approval

**31October2026 15:23:03.856Riyadh /12:23:03.856UTC: PASS**, bound to the new seal.
Current a98e465ae7611e73/schema106/source4238e92/app PID118185/Caddy26652 unchanged.
All14 protected runtime/Email/unit/Caddy files match; new tracking runtime flags
and worker-secret absence are enforced by the sealed root guard. CARD/COD/private
route/payment integrity and active verified Email provider/capture/caller/timer pass.
MON15:20:06 retains the same five original unverified warnings/zero critical and
gaps2; MON Email remains OFF. No forced scan, clearing, customer/provider test or send.
Original purchasing/COD/Email emergency fences remain unspent.

All39 original worktrees/17,074 pending non-document hashes are preserved, with one
new clean feature worktree. All35 deferred IDs and original evidence remain. New
source is committed locally; no merge/reset/push or unrelated work. Original
schema104/Pixel/SEO/history/storage work and visual TODOs remain preserved.
No owner approval, deployment attempt, migration, app restart, worker installation,
polling/callback activation or provider request has been performed. The first genuine
AWB/provider/callback/PDF acceptance remains pending without blocking independent work.

## E163 deployment receipt — 31October2026

The exact approval18490351 is **CONSUMED_COMPLETE**. Schema107 committed at
14:21:17.391UTC and the installed archive473703da9917ba21 switched at
14:21:53.194263UTC (17:21Riyadh), with one migration and one app restart. Source4d0bf6f
is serving under PID124591; CaddyPID26652 and all14 protected files are unchanged.
The migration preserved150 original projections and captured current commerce/Email
settings afresh. Postflight independently preserved eight orders and11 selected
original order/payment/fulfillment/financial projections. Encrypted key/sender,
Email provider3/capture1 and owner-configured fees remain unchanged.

Hosted107 catalog/security, CARD/COD/payment integrity and protected route denials
PASS. The new SELECT-only metadata RPC returned200/null without an order. Every
public asset passed HTTP/size/SHA verification:3,475/3,475, including retained assets.
The normal Email timer was paused1.39352seconds and restored once; its caller was
allowed to finish naturally. A subsequent scheduled caller exited successfully at
14:23:28UTC. No manual worker, Email test/send, synthetic order or provider call.

The full verification receipt contains the14:20 MON snapshot taken before its asset
scan. Read-only follow-up observed the next automatic14:25:04.998473UTC report and
returned READ_ONLY_TRACKING107_INSTALLED_MATCH: same five original unverified warnings,
zero critical, gaps2, MON Email OFF. No forced scan, clearing, retry or extra restart.

Tracking policy is disabled/reservations0. New request/worker/webhook runtime flags
remain absent/false and the worker secret absent. No tracking scheduler/caller/service
was installed. Booking stays OFF. Webhook offline authentication/replay/order/race
qualification is complete; live registration/authenticated callback is unverified.
Genuine provider/date/timezone/status mapping/manual/scheduled timeline and actual
PDF/physical print/barcode acceptance remain pending for a separately approved real
AWB. Uncertain historical dispatch and cancelled COD are not candidates.

Private evidence in ../pdc-tracking-release-20261031/: migration-committed.json,
cutover-complete.json, host-postflight-1793456619305.json,
data-postflight-1793456617924.json, verification-1793456785294.json,
postflight-assets.json, automatic-mon-postflight-1793456777957.json and
deployment-receipt-final.json. The earlier completion.json remains local-ready
historical evidence. All original worktrees and35 deferred IDs/evidence are preserved.

### Disable and recovery boundary

Tracking is already OFF; no tracking disable action is required. A subsequent
activation approval must include stopping/disabling its dedicated timer and disabling
only tracking_policy.enabled under its own fence. Webhook activation stays separate.
Existing purchasing/COD/Email emergency commands in this installed release's private
OPERATOR.md retain their original scopes and single-use budgets. They are not general
rollback permission. No automatic rollback, migration replay, database restore or
second deployment attempt is authorized. Supabase Auth SMTP remains untouched.

ONE next action: prepare that guarded tracking activation/disable packet. After
independent PDC readiness, begin SEO/legacy redirects without waiting for a genuine
AWB or live callback; historical migration/UI follow. No pickup development. Paymob
awaits its reply; detailed commercial settlement/ERP/Daftra remains LAST.
