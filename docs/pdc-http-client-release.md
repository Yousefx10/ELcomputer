# PDC client correction — guarded deployment approval

Status: **DEPLOY_PASS. APPROVAL CONSUMED. DO NOT RERUN.**

The owner approved the exact seal below. The one guarded execution completed
successfully on24October2026. The application was healthy on release
`2573cdf1504bf559` at12:47:38.785 Riyadh. One production restart was requested;
the process changed from26638 to31273. The private VPS candidate passed first.
Fresh encrypted database/runtime backups passed full readback. Final schema91,
database/security, media and private-file preservation checks passed. Caddy and
runtime credential bytes stayed unchanged. No provider request, business-data
write, migration, payment or commerce activation occurred.

The approval below is historical and consumed. It must never be executed again.
Current evidence: `../pdc-client-fix-release-20261024/DEPLOYMENT-RECEIPT.json`,
`execution/completed.json`, and `approved-deployment.log`.
The [dynamic Dashboard test preparation](pdc-dynamic-dashboard-test.md) is blocked
pending a suitable existing paid order; no new shipment is authorized.

The [static booking receipt](pdc-static-booking-acceptance.md) confirms production
creation through the VPS. This release applies the generic client correction and
required status dates to the normal application. It does not initiate shipping.

| Binding | Value |
| --- | --- |
| Target | Existing ELcomputer VPS; service `storefront` |
| Current release | `0ea60833a5071f27` |
| Candidate release | `2573cdf1504bf559` |
| Archive SHA256 | `2573cdf1504bf559e85b30260b31a905e88b04bd0c4545e4c7064480f3ca824c` |
| Archive bytes |12942872 |
| Approval seal | `ac7685b6c05dc01f0b887a448c21ecea321b78419fc440330cdbd37a0a2b6786` |
| Schema / migrations / business writes |91 /0 /0 |
| Provider requests during preparation/deployment |0 |

## Exact change

All relevant PDC operations share `User-Agent: Storefront-PDC/1.0`: booking,
private PDF, products, cities, tracking and original-reference recovery, including
existing claim operations. Existing encrypted credentials, account configuration,
official origins, redirect refusal, timeouts and no-retry behavior remain intact.

Normal tracking, outbound recovery and reverse status operations include required
`fromDate` and `toDate`. A narrow read loads only `created_at` from the exact
matching shipment job/reference. UTC dates cover its lifetime with one day's
leading margin and the remainder of today. Missing/invalid/reversed dates stop
before the provider call. No fixed recent window hides older shipments.

Four reviewed source files define this change. To preserve unrelated work and
reuse the accepted build, the package changes only
`server/chunks/nitro/nitro.mjs` in a byte-verified copy of the deployed artifact.
The new helper/header code is compiled from those source files. Exact, unique
anchors guard the three status call-site changes. Reversing the recorded patch
restores every original server byte. All other2284 inventory entries and all1325
retained client assets match the current release. No full Nuxt build was repeated.
Original application commit provenance is retained; the sealed plan binds the
four source hashes and exact compiled overlay separately. Unrelated customer
session work is excluded and preserved in the workspace.

Product40 stays the existing configured default. Booking remains weight-only.
No dimensions, pickup API, scheduling flags, cookies or automatic session warmup
are added. PDC may create a pickup implicitly when a shipment is created.
Cancellations remain manual.

## Focused validation

- 48 source/client/date/contract/tracking tests pass.
- 33 disposable PostgreSQL/API tests pass, covering booking, uncertain recovery,
  private documents, tracking and reverse operations. External fixture fetches
  are blocked; no production database or provider is used by these tests.
- 5 deployment/compiled-artifact checks pass, including wrong approval, tampered
  plan, consumed invocation and all five PDC HTTP operations.
- The exact candidate starts on Node22.23.1 and passes five protected HTTP checks
  with synthetic credentials and held gates.
- Archive extraction and full inventory readback pass. The read-only sealing
  comparison preserves schema91,140 protected projections, Auth security,
  runtime/processes, media, private incident files and held commerce gates.

These checks reuse the accepted runtime build. They establish preparation and
preservation, not hosted Dashboard/dynamic-customer acceptance.

## Approval boundary

The guarded operator checks the sealed files, target, application baseline,
database/security state and held gates. After approval it takes fresh verified
encrypted execution backups, stages this archive, qualifies a private candidate,
switches the application symlink and restarts only `storefront` once. Postflight
checks service health and preservation. No automatic retry or rollback.

Runtime credentials, Caddy, public purchasing, signup, Paymob/callbacks, database
schema, customer orders, payments, original uncertain dispatches and incident
history remain unchanged. Provider gates remain closed. Any target drift stops
execution and requires a reviewed replacement plan. Running the prepared PDF or
status operator before deployment changes the protected evidence tree and would
require rebinding this deployment; keep those operations for afterward.

The private sealed plan, archive, exact patch, qualification and preservation
evidence are in `../pdc-client-fix-release-20261024/`.

## Consumed owner approval

The owner approved this application deployment only:

```text
APPROVE PDC CLIENT FIX DEPLOY ac7685b6c05dc01f0b887a448c21ecea321b78419fc440330cdbd37a0a2b6786
```

Historical guarded execution command — already consumed; do not run again:

```sh
/Users/imac/Documents/ELcomputer/procurement-postgrest-correction-20261018/tools/node-v22.23.1-darwin-x64/bin/node scripts/pdc-http-client-release/operator.mjs apply /Users/imac/Documents/ELcomputer/pdc-client-fix-release-20261024 ac7685b6c05dc01f0b887a448c21ecea321b78419fc440330cdbd37a0a2b6786
```

After deployment, the already prepared [existing-AWB PDF and dated status
commands](pdc-static-booking-acceptance.md#prepared-existing-awb-operations) can
run separately. Dashboard visibility and cancellation remain owner checks.

Then prepare a separate exact-order authorization for one normal Dashboard test
with securely loaded genuine customer/pickup fields. Verify an eligible paid,
packed order and its shipment history before choosing it. Never clear an
uncertain dispatch, reuse a cancelled/static reference, attach the dummy AWB to a
customer order, or initiate another payment. That future booking is not authorized
by this deployment approval. Public/provider activation requires its own scope.
