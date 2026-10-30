> **E140,29October2026 — owner priority override.** PDC commercial fees are accepted for now. Merchant commissions, deductions, net remittance, settlement timing and ERP/Daftra accounting are LAST deferred work, not shipment-booking prerequisites. Basic customer totals/requested COD, verified collection and outstanding receivables remain guarded. Use the [current real-COD operations note](real-cod-pdc-operations.md); first shipment still requires a genuine approved/packed order and separate exact approval. Historical uncertain bookings stay quarantined. No new production/provider action is authorized here.

> **E139,29October2026: COD ACTIVATED / TECHNICAL POSTFLIGHT PASS / d13f2f0e CONSUMED_COMPLETE.** [Activation receipt](cod-schema103-activation-receipt.md). Same9aa61b64/schema103; one app restart, CARD+COD/delivery50+COD50/signup retained, next automatic13:35 MON WARNING5/critical0. No provider/order/cash action. First booking/commercial reconciliation remain separately held; never replay the approval. Preparation/approval/readiness wording below is historical.

# CX-COD-01 — final schema103 activation review, E138

29 October 2026. **COD ACTIVATION READY / NOT APPROVED / NOT ACTIVATED.**

Owner work order: **OD-20261029-COD-FINAL-01**. Preparation only. No production
write, restart, migration, deployment, order, shipment, pickup, email, cash command
or provider API request occurred. Paymob inquiry was sent by the owner; await its
response without another investigation.

## Current baseline and qualification

**13:19:04.021 Riyadh sealed read-only preflight PASS:**

- Release `9aa61b64c2c5cf9f`, deployed source `8d75404`, schema103 ending
  `20261029010000`. Certificate, installed inventory, running release, schema/security,
  runtime, Caddy and monitor files match. App72557/Caddy26652 remain active.
- Public CARD initiation and Manual delivery50 remain available. Signup open,
  email confirmation required. COD and all outbound PDC gates remain off.
- MON-01 five-minute timer enabled/active/waiting. Automatic13:15:06.321 Riyadh
  report complete, **WARNING5 / critical0**, with the same two overdue and three
  terminal provider-unverified warnings. Financial/state, signed-success, duplicate
  and ownership mismatch counters0. No warning/history/dedup reset or manual scan.
- Original emergency purchasing-close budget1 unused; historical journal gaps2
  retained. Original uncertain CARD dispatch still attempt1/noAWB/original reference.
- **34 JavaScript/native checks plus10 Python runtime/monitor checks PASS**,0fail/
  0skip. Current deployed103 code/SQL used in disposable PostgreSQL17.11 and compiled
  local handlers. Updated activation guards account for exact103, owner confirmation,
  encrypted recovery binding, expiry, one-use intent and targeted emergency controls.
- Fresh encrypted DB **13,653,829 plaintext bytes**, authenticated decryption and
  full `pg_restore` readback PASS. All11 runtime/config recovery files pass full byte/
  hash readback. Encrypted artifacts and their receipt hashes are bound to this seal.
  Execution requires another fresh encrypted backup before the first mutation.

Native checkout tests verify delivery50, COD fee50, CARD fee0, authoritative totals,
one unpaid order under concurrent confirmation and no Paymob work for COD. The
serializer verifies exact decimal EGP, including **100.35 merchandise +50 delivery
+50 COD =200.35 cash**, discounts and invalid precision. Existing checkout retains
separate Shipping, Payment fee and Total rows. No new frontend copy or layout change.

These are local and read-only hosted checks. New hosted authenticated COD interaction,
real provider booking/collection/remittance and owner visual acceptance remain
unexercised. No build or broad/deferred test rerun was needed for this operator-only
packet. Earlier fixture failures were retained: old synthetic location data needed
an explicit lab-only103 reference row. Production code/reference data was not changed.

## Owner-confirmed collection contract

The owner reports direct PDC confirmation that `shipments[].cod` uses **EGP major
units** and that `cod:200.35` means EGP200.35. PDC collects the full final customer
cash amount. Staff approve and pack before Dashboard booking. This is source-hashed
**owner-reported provider confirmation**, not an independently obtained written
provider document. It closes the currency-scale question; no repeat probe is needed.

Reuse the installed schema101 implementation on schema103. SQL derives the saved
unpaid balance in exact integer minor units; the serializer divides by100. No
application release, migration or historical operator replay is required.

## Exact activation scope

| Boundary | Sole permitted change after new approval |
| --- | --- |
| Existing site settings | `payment_cash_fee:0 →50`; retain cash/card settings and all other fields. |
| Reviewed Manual courier | Enable COD collection and explicitly select PDC as collector. Delivery stays50; existing destination coverage is retained. |
| Existing PDC settings | `cod_enabled:false →true` only. Credentials, product, cached mappings, origin, reverse and automatic-label settings stay unchanged. |
| Public Beta policy | Add cash alongside CARD, retaining every other restriction and exclusion. |
| Narrow staff runtime gate | Set `NUXT_PDC_MANUAL_COD_ENABLED=true` for authorized Manual/PDC COD booking and existing-AWB PDF actions only. |
| Runtime activation | **At most one ordinary app restart**. Same installed application/schema. No Caddy, MON, service-unit or credential changes. |

The SQL transaction changes exactly three configuration rows and their existing
revision triggers. It preserves current order/payment/inventory/Auth/Treasury data.
The application retains named staff permission, quantity packing/private video,
trusted totals, saved addresses, cached coverage and current inventory-policy guards.
Global PDC outbound, automatic queues, reverse shipments, tracking and recovery stay
paused. **The operator has a zero-provider-request budget.** No shipment or pickup
is included in activation approval.

## Booking, cancellation and financial safeguards

- Staff authority and approval/packing are rechecked before dispatch. Booking uses
  full saved balance, never a browser amount, fee-only value or declared goods value.
- Stable original reference, one job/order, one durable dispatch before HTTP,
  order-first locks and attempt/token/lease/configuration fencing prevent another
  create. Timeout/ambiguous response remains uncertain; no second SaveShipmentEx.
- Uncertain dispatch prevents cancellation, address and cash-balance changes.
  Known-AWB/packed COD also cannot be locally cancelled through this ordinary path.
  Cancellation before fulfillment preserves existing stock disposition and cannot
  reopen the cancelled order. Local cancellation is never provider cancellation.
- Label retry needs an existing AWB and retrieves PDF only. General recovery remains
  gated off. Any future recovery needs separate authorization, provider evidence and
  exact original reference/account/AWB matching; no guessed AWB or speculative create.
- Placement, packing, booking, AWB and delivery do not mark Paid. Verified collection
  requires its actual amount/reference/date and immutable receipt. Treasury requires
  separate authority, actual full matched remittance and one reconciliation command.
  No automatic cash collection, settlement, refund, write-off or reconciliation.

## Commercial evidence and exact limits

Production contains **zero saved tariff records/revisions**. The retained
[owner-supplied draft](operations/shipping-tariffs/README.md) lists freight60–105
through2kg, additional5/kg, COD0.5%, VAT14%, optional insurance0.7%, failed delivery50%
and invoice14 days. These are **unverified draft terms**, not a current account
contract. No tariff was imported or activated.

Still unknown:

1. Current Product40/account applicability, effective dates and destination surcharges.
2. The0.5% calculation base, minimum fee, fractional rounding and applicable VAT.
3. Whether freight/collection/tax costs are invoiced separately or deducted from cash.
4. Actual gross/net remittance, per-order allocation/statement references and exceptions.
5. Remittance cadence, cutoff and bank-credit timing. **Invoice14 days is not evidence
   of a14-day remittance promise.**

The customer's EGP50 COD charge is not an evidenced PDC merchant fee. Earlier owner
reporting described full remittance; no current contractual statement independently
establishes deductions or timing. Do not invent a net amount or post assumed expenses.

**No blocker to this zero-provider-request activation packet remains.** The first
real booking remains separately held for exact order/parcel/cost review and provider
authorization. Financial reconciliation remains evidence-bound: a short/net payout
cannot be marked fully reconciled by the installed full-receipt command. Leave it
outstanding and review the actual statement. Supporting net deductions would need
a separately qualified accounting change; this packet introduces none.

## Emergency disable and stop handling

The new approval includes a **manual, one-use COD-only emergency disable**, for an
established COD pricing/booking safety or privacy/authorization incident. It removes
cash from the public policy, closes the narrow COD booking gate and uses at most
one additional app restart. CARD, callback handling, MON and every existing financial
record remain. This does not roll back SQL or consume the original purchasing kill
budget. It is never invoked automatically.

The existing **one-use whole-purchasing kill** remains available for its established
payment-integrity, privacy or monitoring-coverage emergency reasons. The packet
reuses that original budget; it creates no replacement. Signed callbacks remain.

Both emergency paths require exact seal, recorded approval/intent, a permitted
incident reason and known target/runtime state. If those guards fail, inspect
receipts/live state read-only and obtain newly scoped recovery approval. No blind
restart, automatic rollback, reapplication or consumed-packet replay is allowed.

## Targeted postflight

After approved execution, verify the same release/schema, exact three-row delta and
trigger revisions, loaded two-key runtime delta, one observed restart, CARD+CASH
capabilities, unchanged Manual50/card fee0 and signup confirmation. Recheck protected
financial counters, the original uncertain dispatch, callback/Caddy files, private
route denials and unused original emergency budget.

Then wait for the **next automatic MON report after activation**: complete, fresh,
non-critical and retaining the sealed warning fingerprints. Do not run the monitor
manually or reset its history. No test order/shipment/cash entry belongs in postflight.
Owner visual review and a first real provider acceptance are separate milestones.

## One exact approval and expiry

```text
APPROVE PDC COD SCHEMA103 ACTIVATION d13f2f0e57a9aaef7531dbe3fb424b64d43a30774cbc6de636e1bfac2559fda1
```

Expires **29 October 2026,17:18:44.767 Riyadh** (`14:18:44.767 UTC`).
Execution must start before **17:15:44.767 Riyadh** to retain the180-second margin;
expiry is checked again before each mutation and SQL commit. Fresh backup/preflight
must pass. No approval or execution intent exists now.

Private packet: `../../cod-pdc-activation-schema103-20261029/plan.json`, `seal.json`,
`operator.mjs`, `database.mjs`, `runtime.py`, `OPERATOR.md`, encrypted recovery,
qualification logs and `preflight-1793269144022.json`. The old101 activation and all
consumed deployment/Paymob approvals remain untouched and non-replayable.

**ONE next action:** owner supplies the exact activation-only approval above.
After COD, continue the preserved Pixel plan when Paymob replies. Existing live
payment experience, local email104, visual TODOs, SEO/redirects, migration/storage
work and all deferred tests remain preserved.
