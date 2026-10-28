# Paymob read-only Merchant Inquiry qualification review

Prepared 2026-10-28. **LOCAL PASS / PRODUCTION PREFLIGHT PASS / AWAITING OWNER APPROVAL.**
Provider authentication and inquiry have **NOT** been exercised.

## Verified baseline

Owner stored the Merchant API Key privately. Independent metadata-only SSH checks
confirm `/etc/storefront/paymob-merchant-api-key` is nonempty, root:root0600, with
root:root0700 parent. No key contents were read, printed, hashed or copied locally.
This file remains separate from runtime.env and is not loaded by the application.

14:09:21.798 Riyadh preflight: production **acfc97b72fe85237 / schema98**, app PID61817,
Caddy PID26652, unchanged reviewed files and certificate. MON-01 remains enabled
and active, with fresh successful report14:05:05 and3 existing warning exceptions.
Report history, permissions, deduplication, signed callback implementation, working
LIVE Secret/Public/HMAC keys and the original single-use emergency budget1 remain
unchanged. No new purchasing authority or emergency budget is created here.

Read-only public GET checks: storefront/cart/signup entry/capabilities200; CARD
available in Live mode; COD absent; anonymous monitoring401; unsigned callback
GET403. These preserve known ingress behavior; they do not exercise a signed
provider callback or create an order. Latest financial checkpoint13:50:29 Riyadh
retains Manual EGP50, signup OPEN, critical financial/ownership/duplicate counts0,
two overdue-unverified orders. Customer email OFF/unconfigured; Auth SMTP untouched.

## Exact selected local context

14:08:53.794 Riyadh, schema98/latest20261027100000, one Live attempt per order:

| Order | EGP | Local evidence | Inquiry role |
| --- | ---: | --- | --- |
| ORD-20261023-8C0C964CBD | 2 | Paid; one succeeded transaction; ready_to_deliver | Preserve original paid control |
| ORD-20261027-D42FA123A8 | 5 | Paid; one succeeded transaction; Processing | Preserve original paid control/WOLF |
| ORD-20261027-6E27BA3BD3 | 2649 | on_hold; payment pending; paid0; no transaction rows | Provider outcome UNVERIFIED |
| ORD-20261027-A5FC5269EA | 3149 | cancelled; payment pending; paid0; no transaction rows | Provider outcome UNVERIFIED; owner-confirmed abandonment |

Local cancellation, expiry, an empty ledger or a latest failed transaction never
proves final provider nonpayment. No historical local state will be rewritten.
These four immutable attempt/order/integration/amount bindings are privately sealed.
The third MON warning is outside this packet's provider scope; no broad merchant
listing or extra order inquiry is authorized. Do not invent fulfillment.

## Narrow production procedure after approval

Private packet: `/Users/imac/Documents/ELcomputer/paymob-merchant-inquiry-qualification-20261028`.
No installer, deployment, SQL migration, service action or application restart.

1. Verify exact seal, unconsumed local intent, expiry, source hashes, pinned SSH,
   machine/release/PID/runtime/units/key metadata, original kill budget and local
   financial bindings. Existing consumed first-fix operator is used only for its
   read-only `inspect`; none of its approvals or write modes is replayed.
2. Record this separate owner's exact approval locally. Write an exclusive durable
   single-use intent before any provider request. File creation refuses overwrite.
3. Read the API Key only inside the VPS process. Authenticate once with
   `POST https://accept.paymob.com/api/auth/tokens`. This creates an authentication
   token only; it does not create a payment or change an order.
4. Read the two paid controls first, then2649 and3149, using four allowlisted
   `GET /api/ecommerce/orders/{provider_order_id}?token=...` requests. Inspect the
   full `transactions` arrays, not the latest-transaction-only inquiry endpoint.
5. Read every listed transaction by `GET /api/acceptance/transactions/{transaction_id}`
   with Bearer authentication. Require original known succeeded transactions in
   provider history; validate merchant/order/reference/integration/mode/amount/
   currency. No independently guessed transaction IDs or alternate endpoints.
6. Save safe projected observations and before/after local snapshots separately.
   Never export raw provider responses, billing/card data, API Key or auth token.
   Recheck production/public availability. No local payment-state update.

Maximum25 provider requests: one auth POST, four order GETs, at most20 transaction
GETs across all four histories. No automatic retry, redirect, proxy, broad list,
latest-only fallback or payment/refund/void/capture/cancellation/email request.
Each response is bounded to1MiB; socket timeout10seconds, total read deadline120
seconds (a final in-flight socket read can extend this by at most10seconds).
The SSH boundary has a180second timeout. Stop on any failed/malformed/unavailable/
incomplete/mismatched response or paid-control discrepancy. Preserve partial safe
observations; never repeat a consumed or transport-uncertain inquiry.

## Evidence limits and remaining Pay Again safeguards

The official latest-order inquiry returns the last transaction only. It is
insufficient for retry safety. Full-order array support and field contracts must
still be qualified against this merchant's legacy Accept API. Missing/unsupported
contracts cause BLOCKED, with no automatic fallback. An absent independent total
count is reported explicitly. Empty transaction arrays or negative transactions
are observations, not final session closure or permission to retry. The generic
Merchant API Key itself does not establish Live mode.

Pay Again stays OFF. Later work still requires durable reconciliation/audit,
customer ownership and RBAC/RLS, immutable totals, unique provider transaction
identity, serialized/idempotent recovery, callback/inquiry conflict rules,
existing-session finality checks, atomic duplicate-charge prevention and verified
paid-order preservation. Provider uncertainty must hold recovery. Any local
state reconciliation or customer-facing retry implementation needs its own review
and deployment approval. Customer notification email delivery remains separate.

## Focused validation

20 synthetic Python tests PASS; no real provider requests. Coverage includes all
four targets, earlier success plus later failure, preserved paid controls, missing/
truncated/paginated history, order/merchant/mode/amount mismatches, unsupported
financial states, unknown statuses, secret/card/billing canary redaction, auth-only
POST allowlist, HTTP/network failures, redirect denial, response/request/deadline
budgets, exact approval and expiry including the180second start margin.
Node syntax checks PASS; sealed operator read-only production preflight PASS.
No broad application test suite, build or deployment repeated.

## Exact next approval

`APPROVE PAYMOB READ-ONLY MERCHANT INQUIRY 32093a558586264347e7c902939ebc94a1f51fec6b4efd34662369294f54f5e5`

Seal: `32093a558586264347e7c902939ebc94a1f51fec6b4efd34662369294f54f5e5`.

Expires **2026-10-28T18:08:56.703+03:00 Riyadh** (**2026-10-28T15:08:56.703Z**).
Execution must start before **2026-10-28T18:05:56.703+03:00 Riyadh** to preserve the180second margin.
No owner approval, execution intent, provider observation or completion receipt
exists at preparation. Old MON/CX approvals remain consumed. Only metadata,
read-only SQL/public checks and local preparation occurred: provider calls0,
application restarts0, runtime edits0, financial/local-state writes0.

After inquiry qualification, resume the owner's queue: safe COD preparation,
then homepage Add to Cart, checkout address, LOC-01 checkout AND profile,
navbar; MIG-04 later. COD remains OFF, PDC PAUSED. Preserve DTR-33, STOR-01,
all original32 deferred rows and the complete deferred-test register.

## Primary contract references

- [Paymob token authentication](https://developers.paymob.com/paymob-docs/developers/authentication-request-generate-auth-token-1)
- [Paymob latest-order inquiry limitation](https://developers.paymob.com/paymob-docs/developers/transaction-inquiry-apis/transaction-inquiry/by-order-id-or-reference)
- [Paymob transaction-by-ID inquiry](https://developers.paymob.com/paymob-docs/developers/transaction-inquiry-apis/by-transaction-id)
- [Paymob full-order reference](https://github.com/PaymobAccept/Paymob-AI-Integration-Skill/blob/main/skills/paymob-integration/references/transaction-inquiry.md)
- [Paymob official Postman collection](https://github.com/PaymobAccept/API-Postman-Collections/blob/main/Transaction%20Inquiry%20API.postman_collection.json)
- [Paymob credential mode distinctions](https://developers.paymob.com/paymob-docs/need-help/setup-guides/getting-integration-credentials)
