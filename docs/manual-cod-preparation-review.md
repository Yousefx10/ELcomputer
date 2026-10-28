> E119: exact approval CONSUMED COMPLETE. Release9c74cf4d2c22a267/schema100 is deployed INACTIVE; COD remains OFF. [Final receipt](cod-inactive-deployment-receipt.md). Never replay the approval or operator.

> E118 supersedes the stock-recording prerequisite below. The owner selected normal untracked COD and employee cash collection. [Current qualified inactive deployment](cod-inactive-deployment-review.md) is ready for separate exact approval; production COD remains OFF.

# CX-COD-01 local implementation review — E116

28 October 2026. LOCAL PASS. Not deployed, activated or owner-accepted.
Source: `local/cod-preparation-20261028`, implementation `65eed276a5d71248373ab1fa0ef9e2cbd7b4434f`.
Base: deployed `d69d68dca9df1f2403f6022ecf712aaa7019ebb8`.

## Verified production boundary

Read-only verification at **16:19 Riyadh, 28 October 2026**:

- Release `42a61d03f3aba831`, schema98; latest migration `20261027100000`.
- CARD live; Beta capability permits CARD only. COD remains unavailable.
- The existing Dashboard cash setting is already true; its fixed fee is zero.
  That setting alone does not authorize COD under the current Beta policy.
- Owner-managed Manual delivery remains active at EGP50 with configured coverage.
  Configuration is not proof of cash collection in every listed area.
- Built-in ERP; inventory tracking is optional for CARD. **Zero of 223 published
  normal products meet even the positive recorded-stock/active-warehouse gate.**
  No COD product is currently eligible under the retained stock contract.
- MON-01 enabled/active/waiting; successful 16:15 report, WARNING/3 exceptions.
  No new incident is inferred. Original emergency purchasing-close budget1 retained.
- CX-CART-01 deployed: 37 direct-add cards, genuine Options/preorders preserved.
  Hosted technical tests passed; final owner acceptance remains pending.
- Signup remains open by accepted production baseline. Coupons disabled, PDC
  outbound paused, Pay Again and application email delivery off.

No production deployment, SQL/business/settings write, restart, provider inquiry,
shipment, payment, email, Git push or activation occurred in this preparation.
Read-only evidence: `../cod-preparation-20261028/baseline-readonly.json`.

## Smallest implementation

Existing checkout quotes, durable commands, ownership, cash ledgers, Treasury,
packing and Dashboard permissions are reused. No parallel order/payment system.

1. Optional private Beta `payment_methods` accepts only `card`/`cash`. Omission
   retains CARD-only behavior. Customer/product/delivery restrictions and coupon
   exclusion remain. The existing purchasing kill switch still gates checkout.
2. One new migration, `20261028170000_manual_cod_eligibility.sql`, adds a
   **false-by-default** `cod_collection_enabled` delivery capability. It requires
   the Manual provider. Existing shipping name, price and coverage remain intact.
   Dashboard Shipping adds one explicit cash-collection confirmation checkbox.
   Settings → Payment methods retains the existing cash toggle/fixed fee.
3. SQL rechecks active checkout delivery and cash capability under row locks at
   review and insertion. Existing coverage, price, confirmed identity, stock and
   ERP checks remain. PDC cannot obtain this capability. CARD delivery is unchanged.
4. Checkout combines Dashboard and runtime method restrictions, filters cash
   delivery choices, invalidates changed reviews and keeps exact pending commands.
   Cash creates no Paymob attempt. Gateway SQL still rejects cash orders.
5. Normal cash orders show **Placed / Awaiting COD collection** in saved customer
   views and Dashboard. Shipping or delivery never proves payment. Partial/full
   collection uses existing immutable receipts; Treasury reconciliation is separate.
   Preorder and CARD behavior is retained. No new method-change route exists.
6. The existing guarded stock-return transaction now also handles unfulfilled,
   unpaid normal COD cancellation once. It returns original received units/balances
   and prevents reopening. Collected cash, shipped states, packing/dispatch evidence,
   unexpected gateway attempts and ambiguous allocations require operational review.
   No automatic refund, return of shipped stock or CARD reconciliation bypass.

COD still requires received, available built-in inventory. It does not inherit
CARD's untracked-sale allowance. Stock is never manufactured. Exact committed
receipts survive the new delivery flag/global cash toggle being disabled; current
runtime access and order ownership still apply.

Only the new migration is pending: historical migrations are byte-unchanged.
The separate location-reference migration/source is excluded. A migration-first,
app-second release is required because the new shipping projection needs the column.
Do not replay unrelated migrations or any consumed operator.

## Local validation

All final runs passed without skips:

| Evidence | Result |
| --- | --- |
| COD/stock/ownership/payment safety run | 49 checks PASS; includes native competing carts/stock and existing receipt recovery |
| Cash ledger/CARD/monitor regressions | 62 checks PASS; partial/full receipts, audit rollback, lost acknowledgements, permissions, reset tombstones, signed CARD settlement and retry hold |
| Latest COD/account/browser run | 32 checks PASS; overlaps COD tests above and adds explicit zero-recorded-stock rejection |
| Browser cases within latest run | 16 EN/AR × desktop1440/mobile390 × light/dark checkout/confirmation cases, plus CARD-only Beta preservation |
| Nuxt | Node22.23.1 typecheck and production build PASS |
| Shared Git | All25 opening HEADs and pending-file inventories preserved before continuity updates; additive26th worktree |

Native PostgreSQL17.11 runs actual migrations/transactions and compiled HTTP APIs
with fixture Auth/Supabase transport. Browser tests run actual Vue checkout and
confirmation with fixture transport and local CSS; all external/business requests
are blocked. No hosted COD purchase, real packing, cash collection, Treasury
acceptance, email delivery or independent hosted Auth/RLS acceptance is claimed.

Older test assertions were brought forward to the current deployed contracts:
the normal creator is service-only, and an existing CARD attempt remains held for
reconciliation. No production retry behavior was loosened. Build retains existing
nonblocking duplicate-import/target warnings.

Private logs: `../cod-preparation-20261028/{cod-final-tests,regression-tests,
final-additional-tests,typecheck-final,build-final}.log`.

## Activation blockers and approval boundary

- Choose genuine COD stock and receive it through the established inventory flow.
  Current zero eligible stock cannot support a genuine COD acceptance order.
- Confirm actual Manual cash-collection responsibility and covered destinations.
  Confirm the existing zero COD fee and EGP50 delivery for that approved scope.
- Prepare a fresh sealed migration/app artifact, encrypted recovery/readback,
  retained-asset HTTP/hash checks, current live schema/lineage and MON/kill preflight.
  The local Nuxt build is not that deployment artifact or approval packet.
- After separately approved deployment, complete controlled owner COD acceptance:
  truthful confirmation, owned views, Dashboard fulfillment and actual collection/
  Treasury handling. Keep deployment, test orders and public activation distinct.

**No exact deployment/activation approval is ready or requested.** The next execution
approval must identify the sealed COD migration/app packet and leave COD closed.
A separate exact activation approval must bind approved stock, Manual collection
coverage/fees and acceptance evidence. No historical approval can substitute.
The next owner decision is the genuine stock and Manual collection scope.

## Required sequence after this feature

1. CX-COD-01 — COD.
2. CX-EMAIL-01 — transactional order/payment emails.
3. CX-ADDR-01 — collapsed saved checkout shipping address.
4. LOC-01 — validated offline governorate/city selectors, checkout AND profile.
5. CX-NAV-01 — authenticated navbar username.
6. CX-PAY-01 — Paymob Merchant Inquiry, retry/method change/abandonment recovery.
7. SHIP-01–12 — PDC creation/configuration/tracking/operations.
8. MIG-04 — Google/Search Console/legacy redirects/sitemap/canonicals/404 audit.
9. Existing admin, WooCommerce data migration, STOR-01 and other deferred work.

ONE feature at a time. No further Paymob inquiry now. Preserve merchant evidence,
provider-unverified2649/3149 outcomes, successful payments, PDC booking barriers,
MON-01, DTR-33, STOR-01, all original deferred rows and both accounts' work.
Emails/address/location/navbar are independent of Merchant Inquiry. After1–5,
Paymob and then PDC are the immediate integration priorities.
