> **E140,29October2026 — owner priority override.** PDC commercial fees are accepted for now. Merchant commissions, deductions, net remittance, settlement timing and ERP/Daftra accounting are LAST deferred work, not shipment-booking prerequisites. Basic customer totals/requested COD, verified collection and outstanding receivables remain guarded. Use the [current real-COD operations note](real-cod-pdc-operations.md); first shipment still requires a genuine approved/packed order and separate exact approval. Historical uncertain bookings stay quarantined. No new production/provider action is authorized here.

> **E139,29October2026: COD ACTIVATED / TECHNICAL POSTFLIGHT PASS / d13f2f0e CONSUMED_COMPLETE.** [Activation receipt](cod-schema103-activation-receipt.md). Same9aa61b64/schema103; one app restart, CARD+COD/delivery50+COD50/signup retained, next automatic13:35 MON WARNING5/critical0. No provider/order/cash action. First booking/commercial reconciliation remain separately held; never replay the approval. Preparation/approval/readiness wording below is historical.

# Codex 2 commerce takeover — E137, 29 October 2026

**Read-only preflight complete. COD readiness READY; execution remains held.**
No deployment, migration, restart, provider API call, email or financial write ran.

## Current production and Beta health

Pinned host inspection at **12:46 Riyadh**, followed by database and public-route
checks through **12:48 Riyadh**, verified:

| Boundary | Current evidence |
| --- | --- |
| Release | `9aa61b64c2c5cf9f`, deployed source `8d75404`; certificate, installed inventory and running release agree. No newer release found. |
| Schema | 103 migrations, last `20261029010000_customer_delivery_locations`; schema/security matches the installed baseline. Proposed email104 remains local. |
| Processes/configuration | App72557 and Caddy26652 remain active, restart counters0; fixed runtime, Caddy, service and monitor files match the deployed receipt. |
| Commerce | Public CARD initiation available; payment methods exactly `card`. Manual delivery EGP50. Signup pages available; accepted signup configuration unchanged. COD unavailable, inactive cash fee0. |
| Shipping | Global outbound and narrow staff-COD gates off; PDC COD, automatic labels and reverse shipments off. All382 saved city mappings remain mapped. No PDC request. |
| Monitoring | Existing five-minute MON-01 timer enabled/active/waiting. Automatic **12:45:05.887 Riyadh** report complete: **WARNING5 / critical0**. Two overdue and three terminal payment-unverified warnings; all fingerprints match E136. |
| Payment integrity | Amount/state mismatches0, unreconciled signed successes0, duplicate successful transactions0, ownership mismatches0. Two overdue attempts remain provider-unverified. |
| New activity | Since E136's11:59:24.854 Riyadh checkpoint: no new orders, attempts or recorded transactions; no attempt/transaction updates. This is local evidence, not a new provider inquiry. |
| Recovery | Original emergency purchasing-close budget1 remains unused. Two historical journal gaps remain recorded; no monitor reset or manual scan. |

Ten anonymous public/privacy route checks passed. These do not establish authenticated
customer acceptance. Address-book, location and navbar owner visual acceptance remain
pending. Previously reported successful CARD payments remain retained.

Private evidence: `../../codex2-commerce-takeover-20261029/` contains the host,
schema/function, payment-health, route and worktree receipts. Reports exclude secrets,
customer records and raw provider payloads. Read-only database sessions explicitly
used repeatable-read/read-only transactions and rollback.

## COD decision

**OD-20261029-PDC-UNITS-01:** the owner reports direct PDC confirmation:
`shipments[].cod: 200.35` means **EGP200.35**, in major units. This is
**owner-reported provider confirmation**, not an independently obtained provider
document. The provided request is retained privately as the source. The unit-scale
blocker is closed; do not ask the same question or repeat its investigation.

Installed schema101 already derives the full saved unpaid balance in integer minor
units and serializes it as `codAmountMinor / 100`. Seven deployed source bindings,
nine dispatch/cash function projections, schema and restricted ACLs were freshly
checked. Retained64 native/API and13 scoped-gate checks remain applicable; they were
not rerun. **No application deployment or database migration is needed.**

**READY for preparation of a new independently guarded activation approval.**
There is no newly identified booking-safety code blocker. This is not execution-ready
approval: the old activation packet targets schema101 and expired on28October. Its
proof and guards must not be bypassed, edited in place or replayed.

The exact remaining safeguard is a **new schema103 settings/runtime-only packet**,
with its own qualified operator, source confirmation binding, current backups,
MON warning fingerprints, expiry, seal and separate owner approval. It must:

1. Retain delivery50; set the existing cash fee50. Enable COD on the reviewed Manual
   courier with PDC as collector, enable PDC COD capability, and add cash alongside CARD.
2. Enable only the narrow staff-COD booking/PDF runtime switch, with at most one app
   restart. Leave global outbound, queue automation, recovery and reverse gates off.
3. Preserve Orders authorization, staff approval, quantity packing/private video,
   cached coverage, authoritative final balance, one dispatch and uncertain barriers.
4. Make zero shipments, pickups, orders, collection receipts or Treasury entries.
   Preserve live callbacks, CARD, MON history, original kill budget and all payment data.
5. Stop on drift, expiry, failed guard, partial write or uncertain outcome. No automatic
   retry, rollback, consumed-approval replay or Git push.

Activation permits customer selection only within the approved scope. A first real
booking requires its own authorization after staff approval/packing. It sends the
**full final customer cash amount**, including EGP50 delivery and EGP50 COD fee.
Booking, AWB and delivery never establish Paid. Verified collection and Treasury
remittance remain separate, evidence-bound commands.

The original CARD shipment remains uncertain, attempt1, dispatch-started, no AWB,
with its original reference preserved. Its provider reconciliation is independent.
Neither this unit answer nor COD activation authorizes retrying that shipment.

## Remaining provider/financial evidence

The supplied example supports two fractional EGP digits. Internally, accept only
existing exact integer minor units; do not introduce rounding, fractional piastres
or additional precision. Provider limits, rejection behavior and a written rounding
policy remain unqualified for future out-of-policy values; no new precision is enabled.

Keep the customer COD fee separate from PDC's merchant charges. Obtain the account's
service/collection tariff, VAT, deduction rules, remittance schedule and statement
identifiers. Until those are reconciled, never derive net remittance from an assumed
EGP50 provider fee or clear a short settlement as fully reconciled. Existing full-match
Treasury guards remain. Provider booking, collection and remittance acceptance are
still unexercised; no request is authorized here.

## Independent payment preparation

**OD-20261029-PIXEL-01 / PAY-02:** [Pixel migration preparation](paymob-pixel-preparation.md)
reuses the existing Pixel component and server intention boundary. The owner reports
the successful customer journey as Unified Checkout Redirect. Inspected deployed
source already mounts Pixel; a separate Redirect selector/adapter was not found.
Treat this as a source-versus-observed-journey gap, not proof that Pixel is qualified.
Preserve the working live journey and verify the fallback before a new rollout.

**OD-20261029-PAYOPS-01 / PAY-06:** [payment operations design](payment-operations-design.md)
defines bounded, permissioned local-ledger views and explicit unavailable provider
fields. No assumed refund, void, settlement or retry operation is implemented.

Official [by-order inquiry](https://developers.paymob.com/paymob-docs/developers/transaction-inquiry-apis/transaction-inquiry/by-order-id-or-reference)
documents the **latest transaction**, not complete history. It cannot resolve the
preserved exceptions or prove old-session finality. Pay Again/method changes remain
off. No consumed inquiry was repeated. The owner's Paymob technical questions are
pending; no support message was sent by Codex.

## Continuity and next action

All34 worktrees, branch tips and14055 pending-file hashes were inventoried before
edits. Main3747575 is continuity; deployed8d75404 is the implementation baseline.
No reset, merge, cleanup, push or other-account source edit occurred.

The local email444c8fd/proposed104 candidate remains off and untouched. Dedicated
application sender/key qualification remains pending; private Yahoo is test-only,
never a reusable default. Auth SMTP is untouched. Resume emails after current
commerce qualification. SEO/legacy redirects, admin improvements, customer migration,
STOR-01, DTR-33 and all deferred tests remain open. No hosted acceptance is inferred.

**ONE next engineering action:** prepare and qualify the fresh schema103 COD
activation-only packet above, then present its exact independent approval. No
activation approval or executable seal is issued by this readiness report.
