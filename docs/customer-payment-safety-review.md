# CX-PAY-01: truthful payment status and conservative recovery

Prepared 28 October 2026. LOCAL qualification only. No production approval or
deployment. This first fix does not complete the entire Pay Again requirement.

## Production evidence

- Production b4b502a03207713a, schema98. CARD, Manual delivery EGP50 and signup
  remain available. COD disabled; PDC paused; application email disabled.
- MON-01 is enabled and runs automatically every five minutes. Owner-signed-in
  protected API200 at03:10:21 Riyadh, report03:10:06, complete/not stale. Actual
  Dashboard panel/expanded alerts verified03:24:53: both unpaid warnings and both
  staff backlog rows visible. Identity is owner-reported; browser credentials and
  tokens stayed in the dedicated local profile. Business writes were blocked.
- EGP2649 remains overdue/pending; EGP3149 is locally cancelled and intentionally
  abandoned according to its customer. Both provider outcomes remain UNVERIFIED.
  No provider inquiry, retry, refund, charge or fulfillment was performed.
- Read-only03:13:47 checkpoint: financial mismatch, duplicate settlement,
  unreconciled success and ownership mismatch counts0. One newer order/attempt,
  zero newer transaction records since the prior22:18:26Z boundary. WOLF remains
  Processing; older paid fulfillment backlog remains open.
- Application email metadata03:21:24: disabled, no API key, no approved sender,
  no account/activation approval. Auth SMTP was not inspected or changed.

## Exact findings and evidence boundary

The customer recalls green “CONFIRMED” at `/checkout`. The exact text and state
have not been reproduced. There is no unconditional paid/completed message in
that page's audited source. Its delivery step turns green and displays “Address
saved” before an order or payment exists. This is a confirmed ambiguous cue,
not proof that it was the customer's exact message. Embedded provider UI is a
separate surface; its completion/cancel events are not settlement evidence.

Two independent confirmed defects exist in the payment-status endpoint: local
order cancellation is returned as payment cancellation, and a local attempt
deadline is returned as expired payment without provider evidence. It also
accepts the order's raw Paid field without checking the private payment ledger.
The result page uses a check/shield cue while payment is still unverified.

Account cards, details and shipment payment milestones use raw payment fields.
Lifecycle states Processing/Shipped/Delivered remain separate from settlement.
The correction changes payment presentation, not historical records.

## First safe fix

1. A shared private server projection requires a matching live succeeded attempt,
   exactly one matching succeeded transaction, correct immutable amount/currency,
   actual paid amount and settlement timestamps before displaying confirmed Paid.
   Incoherent snapshots, duplicates, local expiry or cancellation remain unverified.
2. Checkout uses a neutral delivery label and says the order is not yet placed or
   paid. The saved order shows “Order placed — awaiting payment” before payment
   begins. Return, account cards/details and summary use the same EN/AR payment
   states. Nonpaid return states use a clock. Fulfillment progress stays separate.
3. An owned, payable order with no attempt can start its first CARD session under
   existing purchasing authorization and the same serializing claim RPC. Existing
   attempts cannot expose a client secret or mint another intention through retry.
   They show verification/contact guidance. Order Again is hidden for unpaid CARD
   orders so it cannot be mistaken for payment recovery.
4. Created/paid/failed/pending notification input preparation is available locally,
   uses existing email validation and deterministic idempotency keys, and rejects
   Paid without verified evidence. It has no hooks, queue or transport activation.
   No email delivery is claimed. Existing email service gates stay unchanged.

No schema, Caddy route, systemd unit, timer, credential, purchasing policy or
payment-method configuration change. The existing GET payment status and POST
intentions paths remain sufficient. Customer ownership is resolved before private
ledger access. Anonymous/foreign-order status remains denied/private/no-store.

## Pay Again and change-method dependency

Existing retry capability: **PARTIAL**, an unexpired same-session reopen without
provider inquiry; expired/uncertain attempts already stop. It is not a safe full
Pay Again contract. The first fix intentionally holds existing-session recovery.

The production ledger permits one attempt per order/provider, freezes financial
context once an attempt exists, and does not have a replacement-attempt lease or
durable inquiry receipt. No merchant Inquiry API key is configured in runtime.
The existing Secret/Public/HMAC keys are not an interchangeable inquiry grant.

Before enabling Pay Again: qualify the merchant's supported authenticated full
order/transaction inquiry, authoritative nonpayment decision, stable reconciliation
receipt and concurrency/late-callback policy; then review any additive attempt
lease/history schema against deployed98 and the separately preserved location
work. A latest-transaction-only response, local expiry or browser cancellation
must never authorize a new charge. Provider unavailable/unknown/success/pending
must hold. New attempts and method changes need their own narrowly scoped review.
No invented inquiry adapter, live credential extraction or historical retry.
COD remains disabled and future collection must never imply payment in advance.

## Validation and release limits

Focused fixtures cover abandonment, cancelled return, failed signed transaction,
verified success, late callback, double-click, foreign ownership, unavailable
status/provider and accurate customer copy. Real Vue pages run in Chrome with
all non-local traffic blocked; provider results are synthetic. Native PostgreSQL
tests use an isolated disposable cluster and actual claim/reconciliation SQL.
These are local evidence, not real Paymob acceptance or email delivery.

Production action, if separately approved: switch one reviewed immutable app
archive on schema98, perform one application restart with bounded GET-only
readiness checks, retain every existing browser asset and leave MON-01 unchanged.
The independent execution intent is single-use. Failure stops without another
restart, automatic rollback, broad installer or consumed MON operator replay.
The emergency close path is rebound to the new release using the ORIGINAL shared
kill-intent budget1. It does not create another emergency allowance.

Material limitation: customers with existing attempts still need staff/provider
reconciliation. Payment lookup adds bounded owned ledger reads. Automatic email
and full Pay Again are BLOCKED, not presented as deployed or accepted.

PDC PAUSED. DTR-33, STOR-01, original32 and all deferred work stay open. Homepage
cart, COD, saved address, LOC-01 checkout/profile, navbar and MIG-04 remain queued
in the owner's order; none is combined with this correction.
