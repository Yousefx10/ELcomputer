# Preorder CARD and Apple Pay safety

The owner selected CARD/Apple Pay with each product's full-payment or deposit
terms on 2026-11-05. Installation adds `payment_preorder_card_enabled=false`.
It never enables the capability, changes products, creates stock, or starts a
provider operation. Activation needs separate reviewed settings approval and
hosted acceptance. The existing CARD and verified manual-payment paths remain.

The customer reviews the real SKU/options, availability terms, delivery quote
and initial charge, then explicitly accepts the preorder terms. Preorders and
normal products remain separate carts. Coupons remain unavailable for preorders.
The current built-in inventory contract is required; external ERP fulfillment is
not inferred or bypassed. No delivery date is invented.

The authoritative quote freezes the full order value, each line's full/deposit
terms, the initial amount due, delivery, the remaining balance and availability.
Delivery and any existing CARD fee are paid with the initial charge. The initial
charge must be positive after currency rounding. The intention and verified
funds use `payableNow`; the order retains `totalAmount`. Clients cannot supply
financial values. Existing session fingerprints remain unchanged unless the new
explicit consent key is supplied.

Product row locks serialize allocation checks. Accepted noncancelled preorder
quantities and submitted/unknown financial obligations consume global and
customer limits. Unsubmitted forms consume no allocation. Terms and capacity are
checked again before the submission fence. Browser dismissal, missing callbacks
and timeouts never release submitted financial evidence. Turning the new setting
OFF prevents new submissions while retaining late verified-success processing.

Only authenticated callback/inquiry proof can finalize the initial payment.
Exactly one held preorder is created. Deposit orders are `partially_paid`, with
the actual verified amount and an unpaid balance; full-payment orders are paid.
Both await real stock. The payment session may be confirmed after its initial
deposit is verified, but the UI separately shows the full total, balance and
stock state. Cart cleanup removes only frozen purchased line quantities, once.
New quantities and re-added line identities survive cleanup.

The existing staff balance flow requires an actual checked bank-transfer or
InstaPay reference, amount, verification checkbox and existing Orders access.
The new explicit method overload preserves the original CARD method and initial
provider proof. Omitting that method for a CARD preorder is rejected. It cannot
manufacture a second CARD success. Existing manual preorders keep their original
four-argument operation. Cancellation/refund never implies automatic repayment.

Existing stock release requires full verified payment and actual serialized or
warehouse stock. Packing and courier guards remain in force. Release allocates
real stock; it does not itself book PDC. Existing email workers exclude preorders
and remain unchanged: no ordinary fully-paid notification is fabricated for a
deposit. New preorder email acceptance is separate from this local capability.

The paired MON-01 source change compares a verified linked CARD preorder's signed
initial charge with `initial_amount_due`, while retaining missing-signature,
duplicate-charge, ownership, currency and amount alarms. It does not describe a
deposit as a fully paid order. The worker replacement needs its own exact file
hash binding in Release B and must be installed before preorder activation.

Migration `20261105012000_preorder_card_payment_first.sql` uses strict function
preimage assertions and one transaction. All private helpers remain inaccessible
to browser roles and service-role direct calls; public entry points retain the
service-only boundary and existing identity/permission checks. Qualification
proves existing financial rows survive installation and exact DDL rollback.
Physical migration slots must be assigned from a fresh deployment ledger.

Local qualification uses disposable PostgreSQL, real H3 handlers, authenticated
synthetic sessions, intercepted provider requests and signed synthetic callbacks.
It covers CARD/Apple Pay full/deposit amounts, duplicate/forged callbacks,
allocation contention, changed terms, late success after OFF, deposit cart
cleanup, verified balance, stock release and EN/AR browser consent. It performs
no real payment, refund, courier booking, email or SMS operation.

## Balance by card or Apple Pay

`site_settings.payment_preorder_balance_mode` decides how the rest is collected.
`staff` keeps the verified staff form. `online` adds a Pay the rest button on the
customer's order page. Change it in Dashboard → Settings → Payment methods.

- `commerce_prepare_preorder_balance` creates a session for the exact amount left.
  The session keeps the normal attempt, callback and funds checks.
- A partial unique index allows one open balance session per order.
- `private.finalize_preorder_balance` needs a primary gateway fund for that exact
  amount. Money that cannot apply stays in review as `preorder_balance_conflict`.
- A balance session keeps `order_id` empty because the deposit session owns that
  unique link. `public.payment_attempts` keeps one row per order and provider.
- Balance receipts live in `preorder_payments` with method `card` and no staff user.

## Stores without tracked stock

External-ERP stores with tracking off can sell pre-orders too. The order is
`untracked`, waits on hold and needs full payment before release. Release moves it
to processing without allocating stock. The ERP export and courier booking start
only after that release. Tracked stock on an external ERP stays refused.

