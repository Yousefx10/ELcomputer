> E119: exact approval CONSUMED COMPLETE. Release9c74cf4d2c22a267/schema100 is deployed INACTIVE; COD remains OFF. [Final receipt](cod-inactive-deployment-receipt.md). Never replay the approval or operator.

# Inactive COD deployment review — E118

28 October 2026. **DEPLOYMENT READY FOR SEPARATE EXACT APPROVAL.**
Production is unchanged; COD activation is outside this packet.

## Exact cause and owner-selected policy

Read-only inspection distinguished the catalog from warehouse records:

| Current records | Count |
| --- | ---: |
| Published normal products, positive price and active model |223 |
| Active models across those products |237 |
| Published normal products with positive recorded stock |0 |
| Unpublished normal products |337 |
| Published preorders |1 |
| Recorded in-stock units/warehouse quantity |49 |

All49 recorded units belong to unpublished, Beta-excluded `TESTproduct2026`.
They do not establish quantities for the sellable catalog or physical availability.
The zero COD count was a **payment-method policy mismatch**: CARD already uses
`inventory_tracking_required=false`; COD still required recorded inventory.

The existing owner confirmation says the catalog is physically available without
warehouse counts ([opening scope](public-beta-minimum-launch.md#confirmed-business-scope)).
In this review the owner explicitly selects the same sell-without-recorded-stock
behavior for normal COD and identifies existing employees as the cash collectors.
Staff will manually deactivate unavailable products and record stock later.
**Recording stock is not a prerequisite for this approved opening model.**
This corrects E116's overly restrictive business prerequisite.

The current published normal categories are Mouse60, Accessories56, Keyboards56,
Headsets31, Microphones8, Mouse Pad7, webcams4 and Controllers1. Category names grant
no extra permission: each product must remain published, normal, positively priced
and bound to an active model. Drafts, test exclusions and genuine preorders retain
existing rules. No product/category is published, converted or edited by this work.

Normal purchase labels remain. There is no new “available to order/purchase” copy,
quantity claim, fake stock receipt, serial, warehouse balance or inventory movement.

## Prepared implementation and safety

- Existing `65eed27` source/worktree remains byte-identical. Additive source
  `local/cod-untracked-readiness-20261028` at **3911124efe9cc00d73879d9446d3f702d9d209f1**
  extends its existing inventory option. All26 opening worktrees are preserved;
  this is the additive27th. Separate location4843754 remains untouched.
- Migration99 adds the defaultFALSE Manual cash-collection capability and strict
  COD/cancellation controls from65eed27. Migration100 extends the existing optional
  inventory mode to normal COD. Both migrations are pending; original98 unchanged.
- With tracking off, normal COD snapshots `untracked`, creates an unpaid order and
  reserves no warehouse units. With tracking on, existing physical-stock validation
  and allocation apply. Existing order modes remain frozen. Old CARD methods cannot
  be converted to COD; no Pay Again or method-change endpoint is added.
- Manual coverage/price, confirmed account, publication/model/price, ERP ownership,
  trusted quote totals, durable replay, duplicate protection and permissions remain
  authoritative. PDC cannot receive Manual cash capability or outbound activation.
- Customers see **Placed / Awaiting COD collection**. Employees can prepare COD
  while it is unpaid; only actual cash receipts advance payment. Packing retains
  actual quantity scans, operator/session and validated private-video guards.
  Cash receipts and Treasury remittance remain separate and idempotent.
- Unfulfilled untracked COD cancellation creates no inventory return. Tracked COD
  returns original received stock once. Collected/shipped/packed/ambiguous cases
  require review; reopening a released order is blocked.

## Manual settings and the remaining operational decision

Current Dashboard Settings already has cash enabled and fee **EGP0**. Existing
Manual delivery is active at **EGP50**, with28 configured area labels (including
legacy North Coast). Shipping coverage and customer fee are already configurable;
new Shipping cash-collection confirmation defaults OFF.

The owner has confirmed **employees collect cash**. A later COD activation approval
must bind the actual cash-collection destinations, the EGP50 delivery/zero COD fee,
and the responsible staff process for recording full customer receipts and Treasury
remittance. Delivery coverage alone did not prove cash collection. If cash coverage
is a subset, qualify a cash-only restriction without narrowing current CARD delivery.
No PDC cash collection is assumed. No business setting changes in this deployment.

## Qualification and fresh production checks

- **95 focused native/SQL/CARD/cash/monitor/cart checks PASS, zero skips.** New COD
  tests cover zero-recorded-stock sales, repeated/concurrent commands, settings and
  receipt recovery, cancellation, packing scans/video and actual cash receipt.
- **46 browser/policy checks PASS**, including actual EN/AR desktop1440/mobile390,
  light/dark/RTL untracked COD checkout and confirmation, and homepage direct-cart
  preservation. Local fixture transport only; no real order or payment created.
- Native PostgreSQL17.11 schema98→100 exact footprint and transaction rollback PASS.
  Live schema98 matches the qualified native definitions. Only one defaultFALSE
  column, one constraint, one trigger, three new helper functions and six reviewed
  function bodies change. Original function ownership/ACL and other RLS/schema stay.
- Node22.23.1 typecheck/build PASS; secret scan PASS. Candidate archive
  **9c74cf4d2c22a267**, SHA256
  `9c74cf4d2c22a267911fa6992f54550b6d5edcef9dbecb85f78cbbd748a36b16`,
  21,786,189 bytes /3566 entries. All2479 retained browser files preserve their hashes.
- Local qualification caught seven retained leading-dash assets omitted by Nitro's
  generated serving registry. The existing reviewed registry-repair helper adds only
  those entries; old metadata and all other compiled bytes remain unchanged.
  Initial failed candidate/evidence retained. Final archive readback and **all2592
  browser asset HTTP/SHA256 checks PASS**; no Caddy edit or production asset change.
- Fresh encrypted database backup authenticates and passes full `pg_restore`
  readback. All11 runtime recovery files pass full encrypted byte/hash readback.
  Native fixture migration/rollback is distinguished from a production-data restore;
  no hosted COD acceptance or live collection is claimed.
- **17:15 Riyadh preflight PASS:** production42a61d03f3aba831/schema98, CARD available,
  Beta methods exactly CARD, Manual50, COD unavailable. MON enabled/active/waiting;
  successful17:15 report/WARNING3. Two overdue-unverified alerts plus one terminal-
  unverified alert remain. Critical amount/attempt mismatch, unreconciled signed
  success, duplicate charge and ownership counts are all0. Staff attention2 retained.
  No new critical payment exception observed; unpaid outcomes remain unverified.
- Original emergency purchasing-close budget1 is preserved and rebound by the
  proposed app switch; callbacks remain available. No MON timer/worker/config reset.

## Exact inactive deployment approval

```text
APPROVE INACTIVE COD DEPLOYMENT e3176505e22006ea79a65540889c730921952d31fc009f9797f181c8ceffefd9
```

Expires **21:15:22.032 Riyadh, 28 October 2026**
(`2026-10-28T18:15:22.032Z`). Fresh mandatory checks must pass immediately before use.
Private sealed packet: `../cod-readiness-20261028/plan.json` and `seal.json`.

If separately approved, the packet permits only:

1. One guarded transaction applying the two exact migrations98→100, recording their
   history and verifying145 old projections, Auth/history, ACL/RLS and exact footprint.
   No business rows, settings, stock or old financial/order values change. Bounded
   schema locks may briefly delay requests; lock/identity/seal/checkpoint failure stops.
2. One exact candidate app switch and one ordinary app restart. Runtime/Caddy/units/
   credentials and the existing CARD/Manual/signup settings remain unchanged.
3. Mandatory postflight privacy/CARD/COD-off checks, every2592 asset via the public
   serving path, and the next successful automatic MON report after cutover.

**Cash collection flags stay FALSE; Beta remains CARD-only; public COD stays OFF.**
No email, provider request, inquiry, charge, shipment, real test order, push or public
COD activation is included. Execution is single-use: no automatic retry, rerun or
rollback. If migration commits and a later step stops, preserve that checkpoint and
obtain a separate recovery approval. No approval/intent/execution exists now.

After inactive deployment, separately authorize controlled owner COD acceptance and
then exact activation of the reviewed collection scope. Customer-facing preparation
continues next with emails, collapsed saved address, checkout/profile locations,
then navbar username. Paymob/PDC investigations stay paused until that queue is done.
DTR-33, STOR-01, every deferred test, paid records and provider barriers are retained.
