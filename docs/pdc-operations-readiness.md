> **E166,31October2026:** [Bounded PDC tracking ACTIVE / zero-restart recovery COMPLETE](pdc-tracking-activation-review.md). Same473703da9917ba21/schema107/PID126398;fe7fad74 CONSUMED_COMPLETE, parent0f28 remains CONSUMED_STOP.0 extra restart/install/runtime/Email change. First empty batch plus4 natural empty batches/next22:00:08 MON/CARD/COD/Email PASS;0 AWBs/provider requests/reservations. Booking/webhooks OFF. Orders/history/configuration/emergency fences preserved; first genuine provider/customer timeline/PDF/callback acceptance pending. NEXT Google SEO/legacy redirects immediately; no PDC expansion or waiting. History/UI follow; Paymob paused, fees/ERP LAST.

> **E165,31October2026:** [Tracking activation CONSUMED_STOP; zero-restart recovery READY/UNAPPROVED](pdc-tracking-activation-review.md). Same473/schema107/PID126398, one restart used. Timer-state guard stopped BEFORE policy/first batch/timer activation; policyOFF/timerdisabled/0 eligible AWBs/provider requests. CARD/COD/Email/MON healthy; five original warnings/zero critical. All8 orders/payments/history/configuration preserved; only analytics grew. New16 guard tests/fresh read-only preflight PASS. Separate recovery reuses installed runtime/units,0 extra restart/install/key change; original empty-batch/timer/emergency fences retained. Next approve only the new recovery; SEO immediately after actual activation. No synthetic shipment/PDC expansion; Paymob paused, fees/ERP LAST.

> **E164,31October2026:** [PDC tracking activation SEALED READY / UNAPPROVED](pdc-tracking-activation-review.md). Production473703da9917ba21/schema107 unchanged;0 eligible AWBs. Fresh47 focused/caller/operator/connector tests,18 native assertions/451 browser assertions and read-only hosted preflight PASS. Separate scope: three tracking runtime inputs/caller/service/timer, one prospective app restart/Email timer pause, policy enable after normal MON, one empty first batch. Current caps2/minute,20/hour,100/day/concurrency1. Tracking/booking/webhooks still OFF;0 production writes/provider calls. One-use zero-restart tracking disable included. After approved activation, SEO/legacy redirects immediately without waiting for real AWBs; no PDC expansion. History/UI follow; Paymob paused, settlement/ERP LAST.

> **E163,31October2026:** [Schema107 tracking DEPLOYED INACTIVE; hosted postflight PASS](pdc-tracking-review.md). Production473703da9917ba21/source4d0bf6f;18490351 CONSUMED_COMPLETE. One migration/one restart;150 original projections and all3,475 hosted asset hashes preserved. CARD/COD/Email/next17:25 MON PASS with the same five existing warnings/zero critical. Tracking policy/runtime/worker/webhook OFF, secret absent, no scheduler/provider request/backfill. Current Dashboard fees/key/sender/emergency controls preserved. Genuine AWB/live callback/PDF acceptance pending. Next prepare separate tracking activation/disable scope; SEO follows independent readiness without waiting for real shipments. Pickup excluded, Paymob paused, settlement/ERP LAST.

> **E162,31October2026:** [Tracking/timelines + offline webhook security LOCAL PASS; inactive107 release READY/UNAPPROVED](pdc-tracking-review.md). Source4d0bf6f reuses existing PDC history/API;145 tests,677 browser assertions,25 release guards, migration/rollback/typecheck/build/archive/3,475 assets PASS. Production a98e/schema106 unchanged. One prospective migration/restart; polling/worker/webhook remain OFF and no scheduler installed. Genuine AWB/live callback/PDF acceptance deferred; no waiting for those before SEO after independent readiness. Dashboard-authoritative fees preserved; no pickup, Paymob paused, settlement/ERP LAST.

> **E161,31October2026:** [PDC labels DEPLOYED / hosted postflight PASS](pdc-labels-review.md). Production a98e465ae7611e73/schema106/source4238e92;05fca90d CONSUMED_COMPLETE. One restart,0 migration/SQL/provider/Email requests. CARD/COD/Email/MON/emergency controls and current Dashboard fees preserved;3,365 assets/11 original data projections/next12:20 automatic MON PASS. First genuine PDF/physical print/barcode acceptance remains pending. Next bounded tracking/timelines and offline webhook, then SEO without waiting for orders. No pickup, Paymob awaits reply, ERP LAST.

> **E160,31October2026:** [Private labels locally qualified; app-only106 release READY/UNAPPROVED](pdc-labels-review.md). View/Download/Print, actual PDF/AWB/REF validation, renewed staff authorization and safe saved-AWB-only retries reuse ExportPDF/private VPS files.113 tests/226 browser assertions/21 release guards PASS;0 migration/provider/production write. Current server-authoritative fees respected; owner-selected COD10 is intentional. First genuine provider PDF/physical print/barcode acceptance remains DTR-21. Tracking/timelines/offline webhook follow; SEO after independent readiness without waiting for orders. No pickup, Paymob awaits reply, fees/ERP LAST.

> **E159,31October2026:** [ce4142/schema106 booking readiness DEPLOYED INACTIVE](pdc-schema106-release-review.md);91cc consumed complete, CARD/COD/Email/MON/emergency controls retained. Zero eligible new shipments; uncertain/cancelled orders excluded. Next protected labels/PDF binding, then bounded tracking/offline webhook and SEO even without real orders. No automatic booking/pickup/provider transaction.

> **E158,31October2026:**106 SQL installed, old1e app still serving;84e0 consumed-stop before cutover/restart. [New cutover-only recovery READY/UNAPPROVED](pdc-schema106-release-review.md). No provider call/booking/Email request; CARD/COD/Email/MON/customer COD10 preserved. Do not replay migration or uncertain booking. Independent PDC features then SEO without waiting for real orders.

> **E157,31October2026:** [inactive106 release READY/UNAPPROVED](pdc-schema106-release-review.md); one prospective migration/restart, active Email preserved, no booking/provider write. Labels/Print/PDF binding, bounded tracking and offline callback qualification remain. OD-20261031-PDC-NOWAIT-02: SEO follows independent readiness even with no genuine candidate; actual booking/real PDF/callback acceptance remain separate. Owner confirms current customer COD fee10 is intentional; earlier50 is superseded, no fee write.

# PDC operations readiness — E156

31 October2026. Provider-independent review and first local implementation only.
Production remains **1e931d20d19bde5a / schema105**, source444c8fd, PID84134.
Read-only production evidence was refreshed at **02:10:00 Riyadh**.

## Decision and scope

Pickup is already handled automatically under the owner's PDC arrangement.
There is no pickup-request, scheduling, button or separate pickup integration task.
Shipment booking and labels do not prove physical handover. Record it only from
verified evidence. Existing sender/origin address fields remain required booking data.

Owner order: PDC operations → SEO/legacy WooCommerce redirects → historical
customer/order/address migration → customer/admin UI → Paymob after its reply →
LAST detailed PDC fees, net settlements and ERP/Daftra. Keep basic customer totals,
requested COD, verified collection and receivables accurate throughout.

## Current production matrix

| Area | Status | Exact boundary |
| --- | --- | --- |
| Booking | **BLOCKED for a new real shipment** | No eligible genuine order. Only ready/paid/packed CARD order has an uncertain prior dispatch and no AWB. It is quarantined. C140 COD and all other orders are cancelled. |
| Booking capability | Existing COD path installed; **106 correction LOCAL PASS** | Current narrow runtime gate excludes CARD and uses global default parcel weight. New measured-weight/CARD parity code is not deployed. Staff approval, validated packing/video, destination/product, truthful payment/COD and one-dispatch rules remain. |
| Labels | **MISSING WORK** | Existing ExportPDF template1/private VPS bytes/hash/staff download and AWB-only retry paths exist. View/Print controls and stronger PDF integrity/printed AWB-REF verification remain. No real attached verified AWB exists for provider acceptance. |
| Tracking | **MISSING WORK** | Existing exact REF+AWB dated status lookup, five-minute claim throttle, atomic private history, neutral unknowns and stored My Account timeline exist. General live gate blocks staff refresh; no scheduled tracking worker exists. Current account-page EN/AR browser harness needs updating/qualification. |
| Webhook | **VERIFIED AVAILABLE — documented contract** | Vendor six-page guide specifies authenticated HTTPS POST. Existing secure handler/ingress/history are installed. Live PDC registration/authenticated event/account mapping acceptance are unverified. Polling can finish first. |

CARD and COD are available. Transactional Email provider3/capture1 and its timer
remain active; queues/events/messages are0 at this snapshot. MON02:05:03 is complete,
five existing TERMINAL_PAYMENT_UNVERIFIED warnings/zero critical, historical gaps2.
Original purchasing/COD emergency budgets remain1. No SMTP or Email probe action.

## Existing booking safeguards reused

Dashboard Orders authority, approved/ready state, completed quantity packing and
validated private video are required. Exact address/phone, unique cached destination,
selected service/account and item policy are checked. Untracked sales retain the
owner's configured inventory policy; tracked serial allocation is not waived.

CARD requires paid/full amount and a matching successful live attempt. COD requests
the full saved customer balance including customer delivery/COD fees after discounts,
in EGP major units. Neither booking nor Delivered establishes cash collection.
The unique order/job/REF/AWB, durable dispatch lease and uncertain barrier remain.
No synthetic order, original uncertain replay, duplicate shipment or speculative retry.

## First independent implementation — proposed schema106

Local source **0631cbe972bf9e86ae9572c632e115da685f4e50**, branch local/pdc-staff-shipping-20261031,
worktree ../pdc-shipping-finish-20261031/source. Base083fc20 contains the deployed105
SQL ownership fix; serving application source remains444c8fd. Main is not that lineage.

The additive20261031020000_measured_staff_pdc_booking.sql introduces one nullable
actual_weight_kg column at the existing numeric(8,3) precision, one constraint,
one private immutability trigger and one service-only measured prepare RPC.
It narrowly updates existing eligibility/take functions; owners/ACLs are preserved.
No old migration or historical row is changed, and old uncertain weights stay NULL.

Staff must enter and confirm the actual packed weight. No default is prefilled.
Concurrent conflicting weights fail; dispatched weight cannot change. The old queue
entry point cannot dispatch a missing measurement. The request accepts no browser
COD, address, provider or AWB override. The existing global provider weight stays1kg.

The narrow Manual/PDC staff route now supports ordinary verified-paid CARD and
eligible COD. It preserves existing payment/packing/city/account checks and allocation
rules for tracked stock. CARD sends COD0; COD sends the full saved cash balance.
Global queues, reverse, general recovery and tracking retain their existing gates.
The UI resets measurement/confirmation/notice between orders, reloads saved state
after failure, and keeps HTTP retry0. No pickup feature or new provider subsystem.

| Qualification | Result |
| --- | --- |
| Current native CARD/COD/weight/packing/actor/concurrency/uncertainty tests |16 PASS,0 skipped |
| V6 amount/protocol/tracking/history/ordering/identity/privacy regressions |74 PASS,0 skipped |
| Actual booking form EN/AR, RTL/LTR,1440/390px, CARD/COD |8 scenarios,82 assertions PASS; external requests0 |
| Native PostgreSQL17.11 migration and rollback |PASS;144 disposable original projections preserved; exact105 schema restored |
| Both changed function definitions versus deployed105 |Byte-for-byte baseline match |
| Typecheck / production build, Node22.23.1 |PASS |
| Production/provider calls |0 writes,0 PDC requests,0 test/live shipment |

Native fixtures were adapted to current location, immutable-payment, paid-before-
fulfillment and test-payment guards. None was disabled. Original failed logs remain.
The first shared helper import failed the build; using the established app/utils
layout fixed it. Visual inspection found and fixed prior-order notice leakage.
The older pre-COD PDC native suite remains byte-identical; its initial fixture failure
is retained. The older tracking browser suite timed out on today's account page;
that is **not** a tracking browser PASS and remains outstanding.

No deployment approval/seal exists for106. A fresh guarded migration/application
packet must preserve the active Email worker/runtime, MON/Caddy, current assets,
original emergency fences/budgets and every existing order. No automatic PDC request
or worker activation belongs in that first deployment.

## Remaining work requiring NO PDC contact

1. Prepare/seal the booking-only105→106 release; deploy only after exact owner approval.
2. Finish label PDF integrity and printed AWB/REF validation. Current code checks
   MIME/prefix/size and binds the ExportPDF request/file/job to the saved AWB; it does
   not inspect the printed identifier. Retain private VPS bytes and existing atomic
   hash/size/no-follow publication. No Supabase Storage or public/customer label route.
3. Add authorized Dashboard View/Download/Print using that existing private endpoint.
   Preserve account/order binding and one label record. A failed PDF retries only
   ExportPDF for the existing AWB, never SaveShipmentEx or another shipment.
4. Add a separately gated, bounded tracking-only scheduler and worker authorization.
   Select verified saved AWBs; exclude the uncertain historical job. Reuse the existing
   five-minute atomic claim, exact dated filters, identity matching and local history.
   Do not enable global booking/reverse queues. Customer refresh must remain local.
5. Refresh the current tracking browser harness and qualify EN/AR desktop/mobile/RTL,
   stored history, exceptions, unknown statuses and owner isolation. Verify Delivered
   never changes payment status, COD collections, Treasury or accounting.
6. With a future genuine staff-approved/packed order, verify actual details/weight/
   full amount and prepare one exact one-shipment approval. Actual provider/label/
   tracking acceptance still needs its separately authorized genuine AWB; no test order.

## Vendor evidence and webhook boundary

Original V6 test guide (10 pages), authenticated webhook guide (6 pages), retained
vendor response shapes and existing static acceptance were reused; no diagnostic
or provider request was repeated. Status.xlsx SHA821e91f… has33 rows/32 IDs.
Templates IDS V3 SHA896bc2… has1 standard10x15,5 one-AWB/A4,6 two-AWB/A4 and3 reverse-only.
Current template1 is documented and selected; optional layouts do not block it.

Status97 has two different descriptions. The live32 mappings keep it unknown and
retain both raw aliases. Never guess a transition. Other documented states can be
qualified independently. Known raw status/code/reason, provider time/observation
and source are held in the existing private history; arbitrary raw callback fields
are discarded by design. Customer updates use the stored authorized projection.

The vendor webhook specifies X-Webhook-Secret, JSON AWB/REF/CustomerStatusName/
StatusID/StatusDate/ReasonName, acknowledgements within10 seconds and AWB+StatusID
idempotency. The installed handler uses timing-safe secret validation, bounded
body/deadline, exact REF then AWB, atomic deduplication and event ordering. It changes
shipment history, never payment/inventory/collection. No invented signature/endpoint.

Live registration, an authenticated genuine callback, account-specific mapping/time
and retry behavior remain unqualified. Optional provider-coordinated webhook cutover
can happen later; **none blocks label development or initial polling**.

## One next action

Prepare and seal the smallest106 booking-only migration/application deployment
packet. Keep all automatic PDC requests OFF. Ask for deployment approval only after
fresh release preflight. Real booking, labels, polling and webhook activation remain
separate authorizations. Pickup integration is excluded; detailed fees/ERP stay LAST.
