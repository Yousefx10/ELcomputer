# PDC tracking activation review

31October2026, E166 / SHIP-08. **TRACKING ACTIVE; ZERO-RESTART RECOVERY COMPLETE.**
Production473703da9917ba21/schema107/source4d0bf6f, appPID126398 unchanged.
Recoveryfe7fad74 is CONSUMED_COMPLETE; parent0f28db0b remains CONSUMED_STOP.
Current receipt is recorded below; E164/E165 evidence remains historical.

## Historical E164 preparation — before owner approval

The following preparation evidence predates the stopped activation attempt.
Deployment18490351 is consumed. No migration, deployment, restart, settings change,
authenticated hosted worker invocation, provider request or shipment occurred here.

## Worker and provider scope

Reuse the deployed route, GetShipmentsStatus adapter, mappings, private history,
verified AWB/REF/account/created-dispatch proof and owner-scoped timelines. There are
**zero eligible genuine AWBs**, zero active tracking leases and zero reservations.
The one historical uncertain job has no AWB and remains excluded. All cancelled,
unbooked, unassigned/unverified, terminal, over-age and failure-paused jobs are excluded.

The60-second loopback timer asks the existing worker for due work; it never polls
from a customer page or catches up missed ticks. Initial provider policy is:

| Limit | Current server value |
| --- | --- |
| Per-shipment interval |15minutes |
| Rolling provider requests |2/minute,20/hour,100/day |
| Batch / shared concurrency |3 /1 |
| Lease / transport / caller |2minutes /8seconds /70seconds |
| Provider body limit |1MiB; no redirects |
| Failure handling |Exponential backoff,24-hour cap; pause after8 failures |
| Automatic horizon / stale display |90days /1hour |

Manual staff refresh shares the same quotas/leases/cooldown and uses retry0.
The caller makes one authenticated loopback request; no proxy, redirect or HTTP retry.
The oneshot timeout is85seconds, Restart=no, network restricted to localhost.
The worker starts no more work after20seconds and reserves before provider access.
Only accepted real provider milestones enter the shared deduplicated chronology;
regressions/conflicts remain private. Terminal shipments stop automatic polling.
Current Dashboard values remain authoritative within the deployed hard ceilings;
this packet does not replace fees, credential values or numeric policy settings.

No SaveShipmentEx, ExportPDF, pickup, reverse operation, webhook registration,
payment/COD collection/refund/Treasury/inventory update or synthetic shipment.
Shipping delivery does not establish cash receipt. Booking and webhooks stay OFF.

## Smallest activation scope

No migration, app build/archive deployment, dependency change or Caddy signal.
Install the exact existing private caller and one service/timer. Set only the two
tracking runtime flags and a new independent256-bit credential. **One app restart
is required** to load them; pause/restore the existing Email timer once and allow its
current caller to finish. Do not call the Email worker or repeat a delivery test.

Keep tracking_policy.enabled=false through runtime readiness and the next normal
post-restart MON scan. Then one revision-bound transaction enables only that flag;
the canonical shipping setup revision advances. Run the authenticated first batch
once, then enable/start only the tracking timer. With zero eligible AWBs the batch
must be checked0/failed0/emptytrue and consume no provider request/reservation.
No first batch or worker request was made against production during preparation.

A new eligible AWB or changed provider settings/revision at execution preflight
requires fresh review. On partial/uncertain outcome or MON/permission/SQL/lock drift,
stop and preserve receipts. No COMMIT/install/restart/worker/timer replay, automatic
rollback, restore or migration retry. Read-only inspection remains available.
All CARD/COD/Email, emergency and Dashboard settings remain protected; Supabase Auth
SMTP is untouched. The new packet retains original purchasing/COD/Email emergency
fences and budgets through installed-certificate adapters; no allowance is reset.

## Qualification and hosted preflight

| Check | Result |
| --- | --- |
| Focused native tracking/policy/auth/ownership/rolling quotas/history/webhook race |26 PASS,0 skips |
| Existing exact Python caller guards |6 PASS |
| Operator scope/one restart/normal MON/one empty batch/disable/original fences |14 PASS |
| Explicit approved writable connector selection |1 PASS; no hosted write |
| Native activation/disable/zero-candidate worker/regression assertions |18 PASS |
| Current actual Dashboard/My Account/Settings browser |451 assertions PASS |
| Typecheck/build/full original release qualification |Reused exact deployed4d0bf6f evidence; source unchanged |
| Fresh hosted policy privileges,107 catalog/security/runtime/lineage/CARD/COD/Email/private routes |PASS, read-only |
|40 worktrees/pending bytes and35 DTR IDs/evidence |Preserved |

Browser qualification covers EN/AR/RTL,1440/390 widths,Light/Dark/System, ownership,
honest unavailable/stale states, timestamps and no customer provider calls. Native
activation/disable preserves order/payment/history projections and current numeric
policy, handles canonical shipping revision and makes zero provider calls when empty.
The original local runner path and macOS fixture-path errors remain recorded; only
the corrected passing runs above count. No application defect or rebuild was needed.

Read-only sealed preflight **18:08:41.442Riyadh /15:08:41.442UTC** passed. AppPID124591,
CaddyPID26652 and all14 protected files match. MON18:05:05 retains the same five
TERMINAL_PAYMENT_UNVERIFIED warnings, zero critical, historical gaps2 and MON Email
OFF. No forced scan, warning reset or customer/provider test. Current owner-set COD
fee10 is intentional and preserved through server configuration; no pricing constant.

## Immediate disable

After this exact activation approval is recorded, the included one-use command is:

    node operator.mjs disable OWNER_REQUEST

Run from the private packet ../pdc-tracking-activation-20261031 using pinned Node22.23.1.
Established reasons TRACKING_PRIVACY, TRACKING_INTEGRITY and
TRACKING_PROVIDER_OR_WORKER_FAILURE are also permitted within the same fence.

1. Stop/disable only the dedicated tracking timer.
2. Set only the current tracking_policy.enabled=false transactionally.
3. Verify policyOFF and timerinactive; retain all history and request reservations.

This needs **zero app restarts**. It preserves current numeric policy, fees, keys,
existing orders, CARD/COD/Email/MON and original emergency budgets. A running read
cannot be recalled; an in-flight read or ingestion may finish without replay.
Gate rechecks reject work that observes OFF. Runtime keys can remain
loaded behind policyOFF. Never reset the disable fence, automatically re-enable,
delete evidence or replay an uncertain request. An uncertain disable needs read-only
inspection and a separately approved recovery. Detailed operations: private OPERATOR.md.

## Historical activation approval — CONSUMED_STOP

```text
APPROVE PDC SCHEMA107 BOUNDED TRACKING ACTIVATION 0f28db0bda9595b5a497db6f81510fe15eb8d264e4110eb3179b69663becfc8e
```

Expires **31October2026 22:07:10 Riyadh** (2026-10-31T19:07:10.975Z).
Execution must start before **31October2026 21:47:10 Riyadh**.
The owner supplied this statement. The attempt stopped before policy activation.
It is CONSUMED_STOP and must never be replayed.

## Deferred acceptance and next action

Genuine provider response/date/timezone/status mappings, first scheduled/manual
tracking and real customer timeline remain pending for the first genuine approved
AWB. First genuine PDF/template/physical print/barcode remains DTR-21. Live webhook
authentication/registration/callback acceptance remains independently pending/OFF;
offline security is already qualified and webhooks do not block polling.

**Historical next action, superseded by E165 recovery below.** After activation
and empty-worker postflight, move directly to Google SEO/legacy WooCommerce URL
redirects, without waiting for a shipment or expanding PDC. Historical WooCommerce
data then UI/UX follow. No pickup development. Paymob Pixel/Pay Again await the
provider reply; detailed PDC commercial fees/settlements/ERP/Daftra remain LAST.

Private evidence: seal.json, plan.json, preflight-1793459321442.json,
hosted-permissions-readonly.json, tracking-offline.log, browser-offline.log,
worker-tests.log, remote-tests-final.log, connector-tests.log,
database-qualification-final.json, final-preservation.json and completion.json.

## Historical E165 stop receipt and recovery preparation

Parent0f28db0b is CONSUMED_STOP at15:30:03.723UTC/18:30:03Riyadh. Runtime/caller/unit
installation and ONE app restart had completed at15:25:12UTC; no policy enable,
first authenticated tracking batch, timer start or PDC request happened. No migration
or application deployment. Same107 archive/source is serving under PID126398;
Caddy26652 and all other13 protected files unchanged. Email timer paused
1.249710seconds, running caller finished naturally, timer restored once.
CARD/COD/Email and original emergency fences remain healthy and unchanged.

The old guard required active/enabled timer SubState=waiting. A normal scan can
temporarily use running. The stop did not record the rejected raw properties, so
the precise substate is unknown. Normal report15:30:05 and later reports completed
with the original five unverified warnings/zero critical/gaps2/MON Email OFF. No
failed monitoring report, forced scan, warning clearing or configuration correction.

Read-only data qualification found148 of150 original projections unchanged; only
normal analytics event/session counts grew during traffic. All8 orders, payment,
shipping/dispatch/history, Email/configuration/Auth and collection/Treasury data
are unchanged. Current COD fee10 is intentional and preserved, not hardcoded.
Policy remains OFF, timer disabled, eligible AWBs/leases/reservations0. All nine
parent phases remain and readiness/start fences are absent. No synthetic shipment,
historical uncertain replay, cancelled-order action or provider/financial write.

### Smallest new recovery

Reuse the installed credential/caller/service/timer and current PID. ZERO additional
restart, migration, app deployment, file installation, daemon reload, runtime/key/
unit/Caddy/Email change. Enable only current tracking_policy.enabled at its saved
provider hash/shipping revision, perform the ORIGINAL remaining one empty first
batch, then enable/start ONLY the installed timer. The original parent readiness/
start fences gain the recovery binding; no new first-batch, timer or commerce budget.

Current provider-only scope remains exact genuine active verified AWB/REF/account/
created-dispatch GetShipmentsStatus,900seconds/2perminute/20perhour/100perday,
batch3/concurrency1 and existing rolling quotas/leases/timeouts/backoff/terminal/age
stops. Staff refresh shares quotas; customers read private owner-scoped stored data.
Shipping never establishes payment/COD cash/financial reconciliation. Booking and
webhooks remain OFF. With zero AWBs, the worker must make zero provider requests.

The new operator guard qualifies waiting and bounded normal running/queued/finishing
states. It requires a successful oneshot within the existing80-second timeout, a
fresh complete report AFTER runtime restart, original warnings/gaps/MON Email OFF/
Caddy hash. Disabled, failed, stale, overrun, critical/new-warning states still stop.
16 new tests PASS. Existing47 checks/18 native assertions/451 browser and deployed
build/typecheck evidence reused unchanged. Sealed read-only hosted preflight
2026-10-31T15:48:39.917Z /18:48:39Riyadh PASS. No recovery production action occurred.

### Historical recovery approval — CONSUMED_COMPLETE

```text
APPROVE PDC SCHEMA107 ZERO-RESTART TRACKING ACTIVATION RECOVERY fe7fad74a8a9ceaffaf7efd66428ace663d80b137ab1044ec748a46f6498b34a
```

Expires **31October2026 22:47:03 Riyadh** (2026-10-31T19:47:03.298Z).
Execution must start before **31October2026 22:32:03 Riyadh**.
The owner supplied the exact statement; the one-use recovery completed.
Parent0f28db0b remains CONSUMED_STOP. Expiry is historical and never permits replay.
Private packet: ../pdc-tracking-recovery-20261031-r2/; initial unapproved fdfbea6d packet superseded before issuance; scope/guards/receipts in OPERATOR.md,
seal.json, plan.json, recovery-tests-final.log, sealed-host-before.json,
stopped-data-preservation.json, preflight receipts and completion.json.

### Existing emergency disable

The original approved one-use tracking disable remains unspent in the parent packet:

    node ../pdc-tracking-activation-20261031/operator.mjs disable OWNER_REQUEST

Stop/disable only its dedicated timer, then set only CURRENT policy.enabled=false.
Keep numeric settings, reservations, credentials, history and orders. Zero restart;
in-flight work may finish. No new purchasing/COD/Email emergency allowance; original
fences remain bound through that parent packet. No disable is needed for the current
policyOFF/timerdisabled state. No automatic rollback or repeated uncertain request.

Historical next action, completed by E166 below. The sealed original
OPERATOR.md explicitly says "a partial activation needs a fresh recovery approval."
Never rerun parent apply/install/restart. After actual activation and normal empty
scheduled postflight, move directly to Google SEO/legacy redirects without waiting
for a real AWB or expanding PDC. Genuine provider/timezone/mapping/customer timeline/
callback/PDF/physical print/barcode acceptance remains pending. History/UI follow;
pickup excluded, Paymob awaits reply, detailed commercial settlement/ERP LAST.

## E166 zero-restart activation receipt — 31October2026

Recoveryfe7fad74 is **CONSUMED_COMPLETE**. Parent0f28db0b remains CONSUMED_STOP.
The one-use recovery completed at2026-10-31T18:55:41.765421+00:00 /21:55:41Riyadh on the existing
107 archive/source/PID126398. ZERO additional app restart, installation, runtime/
key/unit/Caddy/Email change, migration or app deployment. One total activation
restart was already consumed by the parent; it was never replayed.

Only tracking_policy.enabled changed at the saved provider/shipping revision; the
canonical shipping revision advanced once. Original first-batch/start fences were
consumed with the recovery binding. One authenticated EMPTY first batch preceded
the installed timer start. Afterwards,4 natural scheduled empty batches passed:
checked0/failed0/emptytrue/retries0,0 provider requests/reservations. No manual
repeat, synthetic order, shipment/PDF/pickup, webhook registration/provider write,
Email test or money/collection/refund/financial transition. Eligible AWBs remain0.

Read-only postflight confirmed exact107 catalog/security/current archive/runtime/
private routes/CARD/COD/payment integrity/Email and original emergency fences.
All14 protected files and three installed caller/unit hashes match the existing
runtime. CaddyPID26652/appPID126398 are unchanged. Data audit retained
146 unchanged of150 projections; only expected provider-policy/shipping revision
changes and separately recorded live analytics growth. All8 orders, original
uncertain dispatch, histories, payment/collection/financial data, commerce fees
and encrypted credentials/sender unchanged. Supabase Auth SMTP untouched.

The next normal automatic MON after activation completed at
2026-10-31T19:00:08.237254+00:00 /22:00:08Riyadh with the same five unverified warnings,
zero critical, gaps2 and MON Email OFF. No forced scan, warning clearing, MON config
change, second app restart or automatic rollback. The active worker and timer have
bounded execution and no restart/catch-up loop. Current policy remains900seconds,
2/minute,20/hour,100/day,batch3,concurrency1 with all existing leases/backoff/terminal
rules. Booking/global shipping and webhooks remain OFF. Polling needs no webhook.

The approved ORIGINAL one-use tracking disable remains unspent in the parent packet:

    node ../pdc-tracking-activation-20261031/operator.mjs disable OWNER_REQUEST

It stops/disables only the tracking timer and switches current policy.enabled=false;
retains numeric settings/reservations/history/orders/keys, zero app restart. In-flight
reads/ingestion may finish without replay. Original purchasing/COD/Email fences and
budgets remain unchanged through that same parent packet's adapters. No new budget.

Private evidence: owner-approval.json, execution-intent.json, root-intent.json,
policy-enabled.json, active.json, verification receipts, host/data-postflight receipts,
execution-preservation-final.json and activation-receipt-final.json in
../pdc-tracking-recovery-20261031-r2/. Earlier completion.json remains dated READY
evidence. All40 worktrees/pending bytes/35 deferred IDs preserved; no Git push.

First genuine provider/AWB/timezone/mapping/manual/scheduled/customer timeline,
registered webhook callback and first provider PDF/physical print/barcode acceptance
remain PENDING. Empty scheduled batches are not positive provider/carrier acceptance.
ONE next action: Google SEO and legacy WooCommerce redirects now. Do not wait for a
shipment or expand PDC. Future booking remains a separate real-order approval after
actual staff packing/weight. History migration/UI follow; pickup excluded; Paymob
awaits reply; merchant fees/settlement/ERP/Daftra LAST.
