# PAY-FIRST-01 — inspected lifecycle and qualified local design

Owner decision OD-20261101-PAY-FIRST-01 supersedes new unpaid CARD orders.
Local work only. No production, provider or notification action is authorized.
Read-only production at2 November00:25 Riyadh is 5fa9ef1bf4b05359/schema107. All107 migrations and18 active
function definitions were inspected read-only; private evidence is outside Git.

## Existing creation and settlement points

`POST /api/checkout` validates identity/quote and calls
`commerce_checkout_command`, which calls the established normal/preorder creator.
It commits customer_orders/items, stock/coupon effects and order-received capture
before `POST /api/payments/intentions` claims an order-bound payment_attempt.
The Paymob webhook verifies the existing HMAC field sequence, correlates only the
signed provider order ID and calls commerce_reconcile_payment_transaction.
That RPC updates the existing order and verified-paid notification trigger.
Controlled checkout paths share the same guarded command. Browser return is not
payment proof. These existing orders/attempts/callbacks remain supported unchanged.

## New prepaid branch

Separate private sessions retain owner/cart/quote identity, immutable normalized
intent, server-priced commercial review, item/address/shipping snapshots, expiry
and audit. Separate attempts claim one outbound dispatch before any provider POST.
A lost response is uncertain, never a replacement attempt. One unresolved prepaid
session per customer prevents parallel tabs or lost local state starting duplicates.
No order, stock allocation, coupon use, financial posting or email exists yet.

The current server quote/authorization/location/stock contracts are reused.
Quotes are revalidated before freezing. Expiry closes new initiation, never erases
an attempt, proves failure or rejects a later genuine charge. Customer status is
owner-scoped, no-store and exposes no provider secrets or private diagnostics.

A durable signed-callback inbox is stored before finalization. It binds transaction,
provider order, integration, mode, exact minor amount and currency. Unknown mappings
are retained; intention persistence drains the inbox, including callback-before-
response races. Pending/failed events never create an order; success cannot regress.
Existing legacy attempts route to the unchanged reconciliation transaction.

Verified live success creates one order/items and existing payment ledger evidence
inside one SQL transaction, then changes payment to Paid. Existing receipt/RLS,
warranty/after-sales, paid-event and fulfillment guards remain. New order-received
capture is suppressed for the intermediate private transaction; only the verified
paid event is queued after its evidence exists. No client callback can finalize.
Duplicate callbacks reuse the receipt. Additional genuine successful transactions
remain private review evidence and never create another order or automatic refund.
Finalization failure preserves the verified receipt for DB-only recovery.

Quoted totals, discount, delivery and identities are honored after a late charge.
No stock is reserved for an unpaid session. The current untracked policy stays
untracked; tracked/changed/unavailable stock yields a paid on-hold order for the
existing authorized staff allocation workflow. No negative or invented inventory.
No automatic PDC booking, collection, ERP action or marketing activation is added.

Only durable paid-order status acknowledges purchased cart lines. Immutable
per-line completion markers preserve unrelated edits and distinguish removed/
re-added lines. Abandoned/failed/uncertain sessions keep the cart and recoverable
checkout snapshot. No unsafe Pay Again or original intention replay is introduced.
COD continues to create an unpaid order at confirmation through the original RPC.

## Independent phases

A: additive prepaid model, callback/finalizer, owner UI/cart safety, legacy age-based
cancellation correction and dual OFF activation gates. Server and DB gates must
agree; old cached prepaid paths cannot bypass a future activation. Callbacks keep
working when new initiation is disabled. Existing records are never backfilled.

B: separate InstaPay snapshot/submission/proof/review. Private VPS files only,
bounded content validation and digest/reference deduplication. Proof is not funds.
Named authorized staff must attest actual bank credit, amount, recipient and unique
reference before the shared finalizer creates one paid order. Rejection/correction
remains private checkout activity, not an order. Recipient/settings revisions and
review receipts prevent stale or repeated approval. All controls default OFF.

C: configurable method readiness reuses Paymob's registry. Apple Pay Egypt is
documented; merchant enablement, live integration, domain/certificates remain
unverified. Google Pay regional documentation lists KSA/UAE, not Egypt. Egyptian
wallets are documented but need the actual merchant integration and flow. All
unqualified methods stay unavailable. Pixel remains separately held pending reply.

D: catalog/accessories remain in their original worktrees, outside this change.

Actual history ends at107. New sequence is assigned to A/B only after native
composition; older local catalog108/109/payment110 labels confer no reserved
checkpoint. Historical migration bytes will not change. No deployment seal until
local SQL/API/ownership/concurrency/cart/EN/AR/WebKit and rollback are qualified.
Rollback disables new sessions but retains callbacks, evidence, paid orders and
all unresolved sessions; never drop funded records or revert to an unsafe writer.

## Qualification closeout — 2 November 2026

See [the local review](payment-first-checkout-review.md) for test evidence, exact
108/109 boundaries and remaining hosted/merchant acceptance. Unknown signed
provider identities remain quarantined; no amount/age/email inference or Pay Again.
Six existing MON warning identities remain intact. Optional GET-only private-session
coverage is locally qualified and defaults OFF until a separate guarded install.
Disabling starts retains the callback/finalizer and activation history. It cannot
restore the old unpaid prepaid writer. Existing COD and all real records remain.
No deployment seal/expiry is issued by local architecture qualification.
