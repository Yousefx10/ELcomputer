# Normal COD cash collection

Implementation, isolated validation and guarded production release PASS.
Public checkout remains disabled.
Migration85 and the application are deployed on schema85.
No real orders, cash, inventory or provider operations were created.

The [foundation release receipt](commerce-foundation-release-receipt.md) records
migrations83–85, private runtime and activation. Owner browser acceptance remains.

## Existing infrastructure reused

Normal orders retain their immutable checkout totals and stock allocations.
`customer_orders.amount_paid`, `payment_status` and `paid_at` represent verified
customer payment. Treasury uses its existing positive `customer_receipt` entries,
permissions, income reporting and built-in ERP guard. Preorder payments and
provider reconciliation keep their existing paths. No manual sales invoice is
manufactured for an online order.

| Event | Customer balance | Treasury | Fulfillment |
| --- | --- | --- | --- |
| COD checkout | Entire total outstanding; payment pending. | No entry. | Existing order and inventory rules. |
| Dispatch or delivery | Unchanged. | No entry. | Existing status and packing guards. |
| Verified cash receipt | Increment `amount_paid`; partial or paid according to the exact total. | Awaiting reconciliation. | Status unchanged. |
| Verified reconciliation | Unchanged. | One customer receipt for the exact collected amount. | Status unchanged. |

The customer owes `total_amount - amount_paid`. Unreconciled cash equals recorded
collections without a reconciliation. Customer payment and treasury settlement
are separate even when both happen on the same day.

## Operator workflow

Open the existing Dashboard order details and use **COD cash**.

1. Confirm delivery through the existing order workflow.
2. Select **Record cash receipt**. Enter the actual amount, unique customer
   receipt reference and actual collection date. Confirm cash was received.
3. Review received cash, customer balance and amounts awaiting reconciliation.
4. Authorized treasury staff select **Reconcile to treasury**, choose a receipt,
   and enter its exact amount, unique remittance reference and treasury date.
   Confirm the entire receipt reached treasury.

Dates are explicit, finite, no earlier than the order and no later than the
database's current date. A treasury date cannot precede its collection date.
Recording time and confirmed actor are stored separately from the cash date.

Partial customer collections are supported. Zero, missing, negative, nonfinite,
sub-cent and excess amounts are rejected without a financial write. Missing
cash stays outstanding. A partial or incorrect treasury remittance cannot settle
a receipt: leave it unreconciled and resolve the discrepancy. Each collection is
reconciled in full, once; batch remittances and partial settlement of one receipt
are outside this feature. Use a separate traceable remittance allocation reference
for each receipt. Do not reduce order totals or net courier fees against cash;
existing expenses/accounting need their own evidence.

Confirmed records cannot be edited or deleted through this workflow. Incorrect
confirmed history, refunds, reversed receipts and cancelled/refunded orders need
financial review; this feature never silently repairs them. No automatic refund,
write-off or reversal is introduced.

## Authority and durable results

`POST /api/admin-orders/:id/cod-cash` takes exactly:
`command_id`, `action` (`receive` or `reconcile`), `collection_id` (null for receipt),
`amount`, `reference`, `received_on` and `confirmed=true`. Amounts must have at most
two decimal places. The authenticated actor comes only from verified bearer Auth.
Unknown fields, actor IDs, totals and client payment statuses are rejected.

- Receipt confirmation requires active owner access or Dashboard view and Orders.
- Reconciliation additionally requires Treasury view and edit.
- The service-only SQL command locks and rechecks current admin authority, even
  on replay. Browser roles cannot execute it or read/write the private ledgers.
- Only delivered/completed, normal, cash orders using built-in accounting accept
  fresh commands. Existing order ERP ownership and active ERP mode must agree.
  Daftra accounting stays external; nothing is posted twice across systems.
- A locked order serializes competing balances. A command UUID binds the actor,
  order, action, collection, exact amount, reference, date and confirmation.
  Identical authorized retries return the original IDs without another write.
  Changed commands fail. Collection references are unique per order, ignoring
  case; remittance references and reconciled collection IDs are globally unique.
- The customer balance update, immutable receipt/reconciliation, treasury entry,
  admin audit and durable command outcome commit together. A failed audit or
  result write rolls everything back. SQL/HTTP uncertainty means retrying the
  same command, including after a configuration or order-state change.
- The dashboard stores each pending command in tab storage, scoped to actor and
  order. It retains exact values across reloads and disables editing while the
  outcome is unknown. Storage failure blocks sending. A known rejection permits
  correction; a confirmed result permits explicitly starting another entry.
- Reads and writes use private, no-store responses. Staff see receipt references,
  actor IDs and recording dates in order details. Customer APIs retain their
  existing safe projection; private remittance references are not exposed.

New migration85 is `20261020200000_normal_cod_collections.sql`. It adds two
service-readable, RPC-written ledgers (`order_cod_collections` and
`order_cod_reconciliations`), minimal private command tombstones and an optional
online-order FK on the existing treasury table. Existing ledger rows, totals,
Auth and historical migrations are untouched. Legacy cash amounts/statuses that
cannot match the new receipt ledger fail closed for review; nothing is backfilled.
A database trigger prevents direct cash-paid assertions, protects collected
order totals and permits financial fields to advance only against a new receipt.
Confirmed timestamps and unmatched historical balances cannot be reset directly. Routine admin-log trimming excludes COD audit keys; receipt FKs
also prevent deleting their audits. Generic log submission cannot forge them.

Orders Reset blocks recorded COD financial history. Existing explicitly
owner-authorized Commerce/Full reset scopes retain their erasure policy, capture
all new tables and retire command tombstones before deletion. Old commands cannot
post again after reset. Unrelated reset scopes retain the cash records.

## Local evidence and acceptance boundary

`tests/cod-collections-native.test.mjs` runs real disposable PostgreSQL17.11 and
compiled HTTP handlers. It checks receipts, partial/full balances, exact treasury
posting, authorization and revocation, competing commands, lost acknowledgements,
audit/receipt rollback, direct-role grants, protected audit retention, legacy
upgrade, ERP ownership and Commerce/Full reset tombstones. Only owned synthetic
products, received inventory and orders are used. Auth verification and Supabase
transport are fixtures, not hosted Auth/PostgREST acceptance.

`tests/cod-collections-validation.test.mjs` checks strict inputs and the actual
Vue command controller's lost-response, reload, actor-change and storage-failure
behavior. It uses a local Vue renderer, not browser acceptance. Related checkout,
private packing, preorder, provider, amount, ERP and reset regressions are run.
Final results:27 new COD checks,42 checkout/packing checks,23 SMS checks and89
focused regressions PASS. Five existing native amount-migration opt-in checks
remain skipped. Typecheck, production build and diff check PASS. The stale SMS
label assertion was corrected; SMS provider code remains unchanged.

Keep public checkout disabled. Before a restricted owner-controlled purchase,
confirm verified stock, configured delivery coverage/customer charges, COD fee and
eligible methods, confirmed customer access and named fulfillment/treasury staff.
The combined migrations83–85, private runtime and application release has passed.
This document does not authorize purchases or provider activation. After an
approved restricted order, verify cash
receipt and treasury reconciliation with actual evidence before public activation.


## Reproducing local validation

Use Node22.23.1/npm10.9.8 from the repository root. Native tests accept executable
and driver paths only; they create and destroy their own loopback cluster.
Configure EMAIL_REVIEW_PG_BIN, EMAIL_REVIEW_PG_DRIVER and the PostgreSQL library
search path for your local tool installation. Never supply a hosted database URL.

```sh
npx --yes --package node@22.23.1 --package npm@10.9.8 node --test --test-concurrency=1 tests/cod-collections-native.test.mjs tests/cod-collections-validation.test.mjs tests/cod-checkout-native.test.mjs tests/private-packing-videos.test.mjs
npx --yes --package node@22.23.1 --package npm@10.9.8 node --test --test-concurrency=1 tests/order-sms.test.mjs
npx --yes --package node@22.23.1 --package npm@10.9.8 node --test --test-concurrency=1 tests/preorders.test.mjs tests/order-amount-reconciliation.test.mjs tests/paymob.test.mjs tests/paymob-security.test.mjs tests/erp-ownership-migration.test.mjs tests/erp-state.test.mjs tests/salary-payment-validation.test.mjs tests/system-reset-compatibility.test.mjs tests/system-reset-database.test.mjs tests/system-reset.test.mjs tests/order-packing-video-database.test.mjs tests/storefront-payments.test.mjs
npx --yes --package node@22.23.1 --package npm@10.9.8 npm run typecheck
npx --yes --package node@22.23.1 --package npm@10.9.8 npm run build
git diff --check
```
