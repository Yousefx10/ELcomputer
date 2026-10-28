> E124: this exact inactive deployment is CONSUMED_COMPLETE. Current615506cd7c047ca8/schema101.
> [Production receipt](cod-pdc-schema101-deployment-receipt.md). COD/PDC booking remain OFF.
> Independent73 activation is still HELD on written PDC units; expiry unchanged.
> Preparation evidence and approval text below are historical; never replay c82.

# COD/PDC schema101 deployment and independent activation — E122

28 October 2026. **INACTIVE DEPLOYMENT READY. PUBLIC ACTIVATION BLOCKED.**
Production remains **9c74cf4d2c22a267/schema100**, CARD live, Manual EGP50 live,
public COD OFF and general PDC outbound OFF. No production mutation occurred.

## Cash amount contract and exact external blocker

The supplied PDC **Courier Integration Test V4**, Version2.0/July2026, section4.3,
page3, defines **`shipments[].cod`**, type `number`, as the cash-on-delivery amount.
It defines `declaredValue` separately. The retained PDF SHA256 is
`8f2f5ae3047fb72ef8aebe495a2f48e1501b27b4c2df951c40cf6638e05fb186`.
The original file and duplicate were checked; no credential-bearing API request ran.

**The guide does not specify the currency or a major/minor-unit conversion.**
Its sample COD is zero, which cannot distinguish pounds from piastres. The current
adapter converts trusted integer minor units to decimal major units by dividing100.
The local tests prove that implementation; they do not prove PDC's production unit.

Preserved24October contract evidence explicitly records the owner's clarification
that historical WordPress shipments were managed manually. Those records cannot
prove API unit conventions or override the original uncertain booking barrier.
The public [PDC service page](https://www.pdc-eg.com/services/express-courier-2/)
confirms COD service but does not document the API amount scale.

The exact remaining provider question is:

> For production SaveShipmentEx, does `shipments[].cod=200.35` mean EGP200.35?
> Confirm that the value is decimal Egyptian pounds, not piastres.

Written provider documentation/confirmation must be source-hashed, owner-verified
and bound to the independent activation seal. No confirmation has been fabricated
or sent by the agent. No real booking will be used to guess the conversion.
No additional external investigation is running. Per owner instruction, proceed
with the saved-address improvement while this activation blocker remains.

## Amount agreement and collection policy

Customer pricing: **EGP50 delivery + EGP50 additional COD fee**.
For a new unpaid COD order, PDC must collect the full saved final payable amount:
merchandise minus applicable discounts plus delivery and COD fees. For EGP100
merchandise with no discount, final payable and PDC COD are EGP200.
Fractional qualification includes100.35−10.10+50+50=**EGP190.25**; the adapter sends
`cod:190.25`, not19025. This remains conditional on provider unit confirmation.
Current Beta coupon restrictions stay unchanged; no promotion is enabled.

SQL snapshots trusted payable minor units from the saved order/customer balance;
the browser cannot supply COD amounts. Initial unpaid COD has amount-paid zero.
Verified customer collections and PDC's actual **full remittance** remain separate.
Placement, approval, packing, booking and delivery alone do not mark payment paid.
Existing immutable receipts, exact remittance amounts, Treasury permissions and
receipt recovery remain. No old CARD order, fee, balance or method changes.

## Smallest inactive release

- Exact candidate **615506cd7c047ca8**, archive SHA256
  `615506cd7c047ca8af4701ee02bd9aa4a2aba613693a4f02be67a7e76ed7e8eb`.
- Source **e47e9a7480a9cdcf855e9c003b5b01c085084a55**, isolated branch
  `local/cod-pdc-dashboard-20261028`. The earlier correction is retained in c5c0e4a.
  No Git push or cross-branch merge occurred.
- Apply **only** `20261028200000_manual_cod_pdc_dispatch.sql`, schema100→101.
  One default-manual collector column, one constraint and two private function
  bodies. Existing data, Auth/history, grants, RLS and inventory remain intact.
- Reuse the existing Shipping collector selector, order details/PDC booking,
  private packing and label transport. Ordinary untracked COD retains actual scans
  and validated private video; recorded inventory retains allocation checks.
- Add default-OFF **`NUXT_PDC_MANUAL_COD_ENABLED`**. It can later permit only an
  authorized staff booking/PDF operation for explicitly configured Manual COD.
  The global PDC gate remains false. General lookups, tracking, recovery, reverse
  and queue workers receive no access from this switch. Uncertain bookings stay
  blocked against a second create; REF recovery is a later separately scoped action.
- **Exactly one ordinary app cutover/restart.** No Caddy/runtime/unit/credential,
  MON lifecycle, business configuration, provider, email or financial changes.
  Cash capabilities stay OFF/default-manual; Beta stays CARD-only. The narrow
  staff-COD switch stays OFF. Existing CARD/signup/Manual50 remain available.
- No pickup endpoint or pickup identifier is submitted. This packet makes no PDC
  request at all. Later staff booking does not automatically confirm collection.

## Qualification

The original64 native checks/typecheck/build and exact101 footprint qualification
remain retained. They were not broadly repeated. New/refocused qualification:

- **13 scoped native/API and amount checks PASS**, covering the staff-only switch,
  paused global PDC, automatic/reverse inactivity, RBAC, no recovery/lookup access,
  exact fractional/discounted amounts, duplicate/uncertain bookings and no payment.
- **2 database-operator guards and5 runtime guards PASS**. Expected schema matches
  fresh live schema100 exactly. Existing migration history and security are pinned.
- Exact100→101 native migration preserves139 original native projections and
  ownership/ACL/RLS; rollback restores100. Live deployment transaction additionally
  verifies all145 protected original projections, Auth/imported history and the
  exact qualified schema footprint before commit.
- Fresh encrypted schema100 database backup authenticates and passes full
  `pg_restore` readback. All11 runtime recovery files pass encrypted byte/hash
  readback. No production-data restore or recovery replay occurred.
- Exact archive unpack/inventory readback PASS:3672 entries; **2591 retained**
  hashed assets preserved, excluding the mutable current-build pointer.
  **All2698 browser assets pass local HTTP200/exact-SHA256 checks** on the actual
  packaged bytes. Secret scan PASS. The seven known retained leading-dash URLs
  required the existing local serving-registry repair; only that registry changed,
  original entries/bytes stayed intact, and earlier failed local artifacts remain.
- **19:40:45 Riyadh fresh sealed production preflight PASS.** Current9c74/schema100,
  protected checkout/PDC settings unchanged, CARD available, COD unavailable.
  MON enabled/active/waiting;19:40:05 automatic report WARNING3, critical financial/
  ownership0, overdue-unverified2. Original purchasing-close budget1 unused.

Final **19:55:46 Riyadh read-only recheck PASS**: installed release/configuration
unchanged, COD/PDC COD false, no critical payment or ownership mismatches.
MON enabled/active/waiting;19:55:03 automatic report WARNING3,
overdue-unverified2. No deployment, app restart, provider call or live write.

Local synthetic/Auth/transport evidence is distinct from hosted/provider acceptance.
No new real order, provider request, cash receipt, Treasury posting or card charge ran.

## Exact inactive deployment approval — READY

```text
APPROVE INACTIVE COD PDC SCHEMA101 DEPLOYMENT c82a5a516edca3027b5c36391dee7ebc45b7f03223fea5cd2231436c65e8501f
```

Expires **23:39:26.530 Riyadh, 28 October2026**
(`2026-10-28T20:39:26.530Z`). Fresh target/input/schema/CARD/MON guards remain
mandatory. No approval or execution intent exists. Operator is single-use: stop
on drift, expiry, transport uncertainty or partial checkpoint. No automatic retry,
rollback or migration replay. Preserve a committed schema if later cutover stops
and obtain separate exact recovery approval.

Private packet: `../cod-pdc-release-20261028/plan.json`, `seal.json`,
`release-operator.mjs` and `OPERATOR.md`. Mandatory postflight checks the installed
archive/schema, privacy/CARD/COD-off gates, every2698 asset through the real public
serving path and the next automatic MON report after cutover.

## Independent COD activation approval — CONDITIONAL, HELD

```text
APPROVE PDC COD ACTIVATION 73e5df08599cb2f7e7016e8ef7e328f439099f907dbb8ec18ff181b071c3f671
```

Same expiry: **23:39:26.530 Riyadh, 28 October2026**.
**Do not use this activation approval now.** Its operator refuses to accept or
execute it until the exact inactive deployment/public-assets/next-MON postflight
passes AND the written provider unit confirmation is pinned and owner-verified.
Its missing-evidence check was exercised: `BLOCKED_PROVIDER_COD_UNIT`, no writes.

If both prerequisites pass before expiry and this separate approval is then
accepted, its scope is only fee0→50, bound Manual COD flag/collector PDC, PDC COD
capability, Beta CARD+CASH and the narrow staff-COD runtime switch; one restart.
General PDC runtime gates, automatic labels, reverse, tracking/lookups and MON stay
unchanged. The operator places no order, books no shipment, requests no pickup and
records no money. Actual staff actions remain authenticated and duplicate-safe.
Seven native activation configuration/evidence guards and five runtime guards PASS.

Private independent packet: `../cod-pdc-activation-20261028/plan.json`, `seal.json`,
`operator.mjs` and `OPERATOR.md`. No provider evidence, owner approval or execution
receipt exists. Both packets retain the ORIGINAL one-use emergency purchasing-close
budget; they do not create another budget. Signed callbacks remain available.
All earlier consumed approvals and the held972c77 packet remain non-replayable.

## Basic shopping work continues

Owner queue now: saved-address summary → offline searchable locations at checkout
AND profile → navbar customer name → transactional emails → Paymob recovery/
reconciliation → remaining PDC integration → SEO/redirects/deferred work.
Emails now precede Paymob; unfinished work and branches are retained.
The summary is isolated on schema100 source so this provider blocker cannot delay
its application-only qualification. No unrelated feature or integration is activated.
