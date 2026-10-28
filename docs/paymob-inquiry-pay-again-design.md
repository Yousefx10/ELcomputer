# CX-PAY-01: credential-independent Inquiry and Pay Again design

28 October 2026. **DESIGN PREPARED; NOT IMPLEMENTED OR DEPLOYMENT-READY.**
Base: deployed source `bb21a160450c38c04477ae0081211d5fb5f17d58`, schema98.
Isolated branch `local/paymob-inquiry-recovery-20261028`. The deployed first-fix
source, archive, consumed approval and emergency-close binding stay immutable.

## Evidence and current limits

The existing ledger has one `payment_attempts` row per order/provider, globally
unique provider order/transaction identifiers, order-first locking, immutable
financial context and an idempotent callback settlement function. The first fix
holds existing attempts; it does not offer reconciled Pay Again. Private status
reads use a single-attempt lookup today. Removing the unique constraint alone
would break those assumptions and is not an acceptable recovery implementation.

Owner confirms the merchant API Key has not been identified/configured. No key,
provider response or session-finality contract is available for qualification.
No new schema number is assigned. The separate LOC-01 schema96 work remains
undeployed; future migrations need fresh ordering against deployed98.

Paymob positions callbacks as primary and inquiry as fallback/manual verification:
[Transaction inquiry](https://developers.paymob.com/paymob-docs/payments-and-features/core-features/transaction-inquiry-and-reports).
The documented order/reference inquiry returns the **last transaction**, not an
exhaustive nonpayment proof:
[Order/reference inquiry](https://developers.paymob.com/paymob-docs/developers/transaction-inquiry-apis/transaction-inquiry/by-order-id-or-reference).

## Read-only provider boundary

Use a separately referenced private merchant API Key. Authenticate once using the
documented regional API-key/token flow. Keep the token in memory and redact query
tokens, Authorization, raw errors and responses. No credential is copied into
frontend runtime, a build, MON's ledger credential or Auth SMTP.

The official provider reference documents full order retrieval using
`GET /api/ecommerce/orders/{provider_order_id}` and transaction-ID retrieval using
`GET /api/acceptance/transactions/{transaction_id}` after token authentication.
[Provider reference](https://raw.githubusercontent.com/PaymobAccept/Paymob-AI-Integration-Skill/main/skills/paymob-integration/references/transaction-inquiry.md).
Actual merchant/region response shape and completeness/pagination must be qualified
before treating these routes as an implemented adapter. Do not infer the regional
endpoint from the storefront URL or guess aliases after an error.

Only a provider order already bound to an owned local attempt may be queried.
Never accept arbitrary provider IDs, API origins, amounts or credentials from the
browser. Bound pages, bytes, transactions, timeouts and rate; incomplete, malformed,
unavailable, unauthorized or truncated history yields HOLD. No broad account lists.
No automatic authentication/POST retry after ambiguous transport outcomes.

Validate merchant identity, stored provider order, special reference, original
integration, explicit Test/Live mode, exact minor-unit amount and currency. Check
all historical transactions across all attempts, including pending, earlier
success, authorization/capture, refund/void and partial-paid states. Unsupported
financial workflows remain held; do not reduce them to failed/unpaid.
The merchant API Key is shared across Test/Live according to the credential guide;
response mode must be checked explicitly rather than inferred from the key.

## Decisions and evidence

| Evidence | Customer/reconciliation decision | New payment allowed? |
| --- | --- | --- |
| Matching verified success | Reconcile through a trusted atomic server path; display verified payment only after coherent settlement | No |
| Pending transaction / active authentication | Payment pending; retain provider uncertainty | No |
| Complete history has only failures, or no transactions | Record **no payment observed at this time**; this does not close the old checkout | No, until independent provider-finality gate passes |
| Latest transaction failed but earlier success exists | Preserve/reconcile success; flag inconsistencies | No |
| Cancelled/expired local row, browser return or customer abandonment | Context only; provider outcome remains unverified | No |
| Unknown/incomplete/error/mismatched context | Hold and expose safe review guidance | No |
| Provider-confirmed old checkout terminal and all in-flight settlement risk excluded, fresh coherent negative inquiry | Candidate for a version-fenced recovery reservation | Only after all local authorization/concurrency gates |

The last row is a **required contract, not a known Paymob guarantee**. A negative
inquiry at timeT cannot prevent an old open tab/3DS flow settling atT+1. A database
lease or local30-minute expiry alone cannot close that remote session. Confirm
the merchant's supported terminality/revocation and settlement semantics with
Paymob before enabling replacement attempts. Do not invent a cancellation API
or substitute an Update Intention amount/expiry operation for proof of finality.

## Durable reconciliation proposal

Extend the existing private payment subsystem; no parallel order/payment store.
Names below are proposed contracts, not applied tables or RPCs.

- A reconciliation-run receipt binds local order/attempt, credential/config revision,
  merchant/region/mode, schema version, financial snapshot/settlement version,
  observation time, completeness, sanitized normalized facts and response digest.
  Persist bounded success and failure outcomes. Do not retain raw billing/card
  fields, credentials, cookies, browser redirects or provider error bodies.
- Normalized transaction evidence keeps global uniqueness by provider/transaction
  ID and immutable attempt ownership. Record **merchant_inquiry** separately from
  **verified_callback**; never manufacture an HMAC signature or call inquiry proof
  a signed callback. Existing historic callback evidence stays intact.
- Commit receipt, normalized evidence, idempotent settlement and any event intent
  atomically under the existing order-before-attempt lock order. Same transaction
  discovered through inquiry and callback settles once. Success cannot be erased
  by a later failed/pending/negative observation.
- A successful payment discovered for a cancelled/refunded order is recorded and
  escalated. Never silently reopen the order, release/create stock, refund it or
  trigger shipment. Detect all successes across attempts; multiple charges stop
  further recovery and create a critical staff exception.
- Capture a uniquely keyed future notification event transactionally if designed
  later; email sending remains a separate disabled task with no backlog replay.

## Recovery reservation proposal

1. Authenticate the customer and resolve ownership before any provider query.
   Recheck current purchasing/card availability; enforce existing normal-purchase
   policy, original method/integration/mode and immutable amount/currency.
2. Serialize reconciliation/recovery by order. Use a durable request key; repeated
   clicks/tabs/processes reference the same operation. No customer-supplied totals.
3. Require fresh complete inquiry plus qualified remote-session terminality. Under
   an order lock, compare the receipt's financial/settlement/config versions to
   current versions. Any callback or order change invalidates the reservation.
4. Preserve every old attempt and provider identifier. If replacement attempts are
   supported, maintain at most one active attempt/reservation per order with a
   database-enforced invariant. No deletion/recycling of attempts or client secrets.
5. Persist the new attempt and send-intent **before** the single provider initiation
   request. A timeout, server crash or lost response becomes initiation-uncertain;
   it never authorizes another POST merely because a lease expires. Reconcile the
   exact original reference instead of resending blindly.
6. Before returning a session, recheck settlement/reservation version. A late old
   callback must revoke further local recovery. Remote terminality is still
   essential: local fencing cannot revoke an already exposed provider session.
7. After initiation, verified callback remains the primary settlement path.
   Refreshing/viewing an order must not create an intention or retry payment.

Audit all existing single-attempt assumptions before implementing multi-attempt
history: claim/store/reconcile RPCs, immutable-context/packing/fulfillment guards,
normal-purchase authorization, owned status/account queries and monitor projections.
Update only necessary monitoring evidence classification; preserve its timer,
service, reports, deduplication and single-use emergency budget. The customer
projection must recognize both qualified proof sources without mislabeling them.

No payment-method change or COD activation in this feature. Future method changes
require the same finality/ownership/amount protections and their own approved scope.

## Qualification gates and test matrix

No runtime code, migration, provider call or automated test was executed for this
documentation-only preparation. Existing first-fix local tests remain prior
evidence; they do not qualify these new contracts.

After the secure key reference is available, qualify read-only inquiry first.
Then implement locally with disposable database and fake-provider transports:

| Case | Required result |
| --- | --- |
| Abandoned/local-expired/cancelled order | No inferred provider nonpayment, retry or paid label |
| Failed transaction followed by old/new success | Success preserved, no second settlement/charge |
| Earlier success followed by latest failure | Full history finds success; latest-only response cannot clear it |
| Callback missed, inquiry finds success | Audited inquiry-source reconciliation; no fabricated callback |
| Callback races inquiry or duplicate retries | One settlement/reservation; deterministic receipt recovery |
| Old callback arrives after recovery reservation | Reservation invalidated; late-success review; no blind new POST |
| Old provider session not proven terminal | Retry remains blocked despite a clean inquiry |
| Two tabs/processes; lease timeout; crash after send | One active attempt; ambiguous send held, never automatically repeated |
| Foreign customer/order/provider reference | Deny before network or private-data disclosure |
| Amount/currency/mode/merchant/integration mismatch | Hold; preserve original financial context |
| Provider unavailable/401/429/5xx/oversized/pagination gap | Durable safe failure receipt; no new payment |
| Secret/card/PII canaries | No logging, browser response, build or durable raw-payload leak |
| Existing pending/paid/cancelled records and late callbacks | Preserve history, stock, shipping, manual50, privacy and kill budget |

Fresh deployment approval is prepared only after these gates pass for the actual
merchant contract. It must identify exact application/schema/runtime changes,
recovery, retained assets, single-use execution and original emergency budget.
No approval seal or installer is created while credentials/finality are unqualified.
