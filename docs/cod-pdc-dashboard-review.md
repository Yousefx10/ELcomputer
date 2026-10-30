> **E140,29October2026 — owner priority override.** PDC commercial fees are accepted for now. Merchant commissions, deductions, net remittance, settlement timing and ERP/Daftra accounting are LAST deferred work, not shipment-booking prerequisites. Basic customer totals/requested COD, verified collection and outstanding receivables remain guarded. Use the [current real-COD operations note](real-cod-pdc-operations.md); first shipment still requires a genuine approved/packed order and separate exact approval. Historical uncertain bookings stay quarantined. No new production/provider action is authorized here.

> Superseded for release/activation by [E122](cod-pdc-schema101-deployment-review.md).
> Inactive schema101 deployment READY; public activation BLOCKED on written PDC amount units.
> E121 evidence remains below. Neither packet has been approved or executed.

# COD through Dashboard PDC booking — E121

28 October 2026. **LOCAL CORRECTION PASS / PRODUCTION ACTIVATION HELD.**
Production remains **9c74cf4d2c22a267/schema100**. Public CARD remains live.
COD and PDC outbound calls remain OFF; no production change occurred.

## Clarified owner decision

**OD-20261028-COD-02** supersedes E120's employee cash-collection premise.

1. A customer places an unpaid COD order.
2. Staff approve it through the existing order workflow and complete packing.
3. Staff request PDC from the existing **Nuxt Dashboard**.
4. PDC delivers and collects the customer's full order amount.
5. Authorized staff record the verified customer collection with its evidence.
6. PDC remits the **full collected amount**, confirmed explicitly by the owner.
7. Authorized Treasury staff reconcile that actual full remittance separately.

This is staff-requested PDC booking through the application, not external portal
booking and not automatic booking at checkout. `auto_create_labels` remains OFF.
Collection requires proof; dispatch, delivery and customer redirects do not mark
an order paid. The customer may be paid while PDC still owes the store remittance.
Treasury is credited only after the actual payout. No deduction or expense amount
was inferred from the owner's full-remittance confirmation.

Customer pricing remains **EGP50 Manual delivery + EGP50 COD fee**. The final total
is merchandise plus EGP100, reviewed before confirmation. The existing Payment fee
row displays the COD fee separately. CARD delivery/fees and old orders stay intact.

## Why the submitted seal was held

The exact `972c77a4c3f3fbe30fc8059f7c4fe06495a372458cc5c797cc5beef51d9f0d52`
approval was received together with the changed collector model. The sealed packet
binds **employees collecting cash**, zero application changes/migrations and zero
PDC configuration/outbound activation. It does not authorize the clarified model.

Status: **RECEIVED / HELD_SCOPE_CHANGED / NOT ACCEPTED FOR EXECUTION**.
It was neither executed nor converted into broader authority. Its private owner
receipt has `accepted=false`, `seal=null` and the original `requested_seal`;
the existing operator refuses apply. Never overwrite this receipt or replay the seal.
No new activation seal or expiry has been issued for the changed scope.

## Verified schema100 gaps

Fresh read-only production inspection confirms:

- Current checkout binds Manual delivery, while the PDC booking guard requires
  a company with provider PDC. A Manual COD order has no Dashboard PDC card.
- The PDC guard requires recorded serialized allocations, which do not represent
  the approved ordinary untracked-stock sale model.
- The manual-AWB fallback additionally requires paid, allocated stock. It cannot
  turn an unpaid COD order into the requested Dashboard PDC booking.
- PDC `is_enabled=true`, `cod_enabled=false`, automatic labels OFF; outbound runtime
  gates remain OFF. Origin, encrypted-secret presence and selected product checks
  pass. Cached cities411/products2; mappings382, of which381 are in the current
  city cache. Configuration presence is not live COD/provider acceptance.
- Existing cash receipts already separate customer payment from Treasury. Their
  full-receipt reconciliation matches the owner's confirmed full remittance.

The schema100 diagnosis passes6 disposable PostgreSQL/API checks. It creates no
hosted order, live provider request, charge, receipt or Treasury transaction.

## Minimal isolated correction

Preserved source: new 28th worktree `../cod-pdc-dashboard-20261028/source`, branch
`local/cod-pdc-dashboard-20261028`, based on1615993/deployed application3911124.
Changes are local and uncommitted; every original worktree remains intact.

The correction extends existing surfaces only:

- One proposed migration101, `20261028200000_manual_cod_pdc_dispatch.sql`, adds
  explicit `cod_collection_provider` to existing shipping companies. Default
  **manual** preserves employee collection for independent stores. PDC is an
  explicit Dashboard choice, with existing authorization/RLS and collection flag.
- The existing offline PDC destination guard now also validates Manual COD with
  explicitly selected PDC collection. Disabled COD, unmapped/ambiguous/out-of-cache
  destinations fail before a new COD order is accepted. CARD Manual delivery
  retains its current independent behavior; no mapping/coverage row is changed.
- The existing dispatch guard accepts those explicitly configured Manual COD
  orders after packing. Saved ordinary untracked COD uses actual quantity scans
  and validated private video without fabricated serial allocations. Tracked
  inventory keeps its original allocation checks. Other payment modes retain
  their existing dispatch conditions.
- Existing order details expose their existing PDC card after readiness. The
  booking button waits for `ready_to_deliver`. The existing staff booking action,
  exact original reference, trusted COD balance, private label and one-dispatch
  uncertainty barrier are reused. Checkout shipping identity/fees are not rewritten.
- The existing Shipping form gains a compact EN/AR collector selector. No screen
  redesign, new public method-switch route or parallel shipping/payment system.

## Qualification and evidence boundaries

**64 native PostgreSQL/compiled HTTP checks PASS, zero skipped**, including10 new
COD/PDC workflow checks and existing COD, tracked/untracked inventory, cash/Treasury
and CARD regressions. Mock PDC transport is local; no provider was contacted.

The tests exercise authorized staff approval, quantity/video packing, one exact
EGP200 collection request for EGP100 merchandise plus50+50, selected destination,
unchanged unpaid order/checkout totals, explicit collector choice/defaults, no
automatic queue, RBAC, rejected client COD assertions, disabled capability/runtime,
unsupported destination rejection before order creation, duplicate booking and
uncertain-outcome barriers, recorded stock and separate collection/remittance.

Native schema100→101 qualification matches the live original dispatch function,
adds exactly one default-manual column/constraint, and changes exactly two private
function bodies. Original function ownership/ACL, other schema/RLS and139 original
native table projections are preserved. Transaction rollback restores schema100.
Typecheck, production build and `git diff --check` PASS.

Private evidence: `../cod-pdc-dashboard-20261028/native-qualified.log`,
`schema-qualification.json`, `typecheck-final.log`, `build-final.log`;
`../cod-pdc-collection-review-20261028/native-diagnosis-final.log`, read-only
configuration/host observations and `approval-held.json`.

This is **LOCAL PASS**, not deployment, actual PDC COD collection or owner acceptance.
The old E120 activation qualification does not establish this new dispatch scope.

## Remaining activation work

The genuine blocker is the production scope mismatch: schema100 lacks the qualified
bridge, and its sealed runtime-only approval excludes the required deployment and
PDC controls. No activation is permitted under that seal.

A replacement guarded packet must bind the exact new source/archive and migration,
current backups/security/history/protected rows/retained assets, fee50, Manual
collection capability and explicit PDC collector, PDC COD capability and the precise
outbound runtime changes. Automatic booking must remain OFF. Preserve the original
emergency purchasing-close budget and all existing PDC uncertainty barriers.
Stop on any drift or partial checkpoint; no automatic retry, rollback or booking.

Then obtain the replacement exact approval and perform the approved deployment/
activation once. Restart count and expiry must come from that newly qualified
packet; E120's one-restart/zero-redeployment scope cannot be reused.
No fake hosted order or agent provider transaction is permitted during postflight.
Actual PDC booking/collection/remittance acceptance requires genuine order evidence.

COD remains the only current feature. After activation, retain the exact E120 queue:
saved address → checkout AND profile locations → navbar → Paymob → remaining PDC
operations → transactional emails → Google/redirects/Search Console → deferred work.
No Paymob investigation, external PDC investigation, provider call or unrelated
feature was started. Original paid/unverified attempts and deferred work remain.
