# Abandoned embedded payment forms

`PAY-ABANDON-20261104-01`. Local correction on the deployed schema112 source.
Installation requires the narrowly reviewed schema113 migration and app release.
This file does not authorize production execution or a provider transaction.

## Root cause and reuse

The existing explicit Pay action creates a private checkout and a provider
intention. Storing the intention immediately sets financial `pending`, even when
the customer has not submitted the form. A SQL guard and the unique
`payment_checkout_one_unresolved` index then prevent every further checkout for
that customer. The API also returns no fields for an acknowledged existing
intention, and the browser retains a single pending command for the account.
Hiding its warning did not remove those server/database restrictions.

Reuse the existing sessions, immutable snapshots, attempts, callback inbox,
funds, paid-order finalizer, cart-line completion and transactional notification.
Keep the pinned Pixel1.2.8 SDK, embedded iframe, scoped CARD/Apple methods and
hosted CARD fallback. No replacement payment system or product-family work is
introduced. Authentication, Products, RLS and payment permissions stay intact.

## Presentation and financial evidence

| Interface state | Meaning | Financial treatment |
| --- | --- | --- |
| `unknown` | Existing attempt, or no qualified new interface evidence | Preserve uncertainty; never infer abandonment |
| `initialized` | New guarded form can open on the existing intention | No sales order; normal cart remains |
| `submitted` | Server accepted the one-use permission to submit | Payment may proceed or authentication may start; this is not proof of a charge |
| `superseded` | An unsubmitted form was replaced by an explicit new cart journey | Invalidate its UI token; retain intention, mapping, financial status and late callbacks |

Financial status remains separate. An authenticated callback or an explicitly
authorized, authenticated targeted inquiry can establish a transaction result.
A browser message, wallet dismissal, route change, quote deadline, local age,
missing callback or failed inquiry cannot establish that an intention cannot pay.
No cleanup deletes, retires, cancels, refunds, fails or fabricates historical
payment/order records. The migration adds eight metadata columns; all existing
attempts receive only the `unknown` default with null supplementary metadata.
Original-column projections remain exact.

The SQL unique index becomes a non-unique owner lookup. Existing user advisory
locks serialize preparation, interface opening, supersession and submission.
An uncertain/submitted attempt protects its affected product/SKU items. Unrelated
items can start a separate journey. An old unknown attempt is never silently
converted into a new initialized one. Transfer behavior and OFF gates remain.

Reopening an unchanged unsubmitted cart returns the same intention and frozen
amount. A refreshed quote cannot replace its immutable snapshot. Cart, method,
price or expiry changes return a definitive `checkout:restart` before provider
dispatch. The browser may renew the cart, re-quote and repeat once. A changed
payable summary requires owner review. Transport failures never use this retry.
Quote expiry withdraws UI permission; it never establishes financial finality.

Each explicit form open rotates a server token held only in memory. Only the
latest token can pass `beforePaymentComplete`, once. CARD validation failure
does not contact the submission gate. The parent waits for server permission;
denial, lost acknowledgement and timeout cannot authorize payment. Hosted
handoff consumes the same gate before exposing its destination. An acknowledged
private session clears the global browser command; an unacknowledged request
retains the exact original financial payload. Ordinary page visits make no
intention or submission requests.

A genuinely verified decline can reopen **the same intention**. It does not
retire that intention or create a different financial action. Consumed failure
receipts cannot unlock another submission through callback replay. A later
pending transaction is shown as unverified, rather than inheriting an earlier
decline label. Unknown results show status/support for the affected payment.

Replacement cart identities are recorded once and remain immutable. Genuine
late success still enters the existing funds ledger. The existing finalizer
creates one matching paid order, or preserves funds for review if that explicit
replacement chain already has an order, including COD. It never creates a
second order for that replaced action or automatically refunds/voids it.
Separate purchases after paid-cart acknowledgement remain possible.

The old four-argument payment claim fails closed after schema113. New claims
require UI protocol2. This prevents stale application bundles from creating
unguarded new intentions. Late authenticated callbacks remain compatible.

## Official SDK and inquiry boundaries

The official [Pixel lifecycle](https://developers.paymob.com/paymob-docs/developers/checkout-experiences/pixel-embedded)
documents `beforePaymentComplete`, `cardValidationChanged`,
`afterPaymentComplete` and the Apple-only `onPaymentCancel`. The pinned SDK
awaits the pre-payment hook; its Apple flow invokes that hook before the wallet
sheet. Therefore closing Apple Pay after the gate may still leave uncertainty.
Cancellation closes the UI and preserves the cart, without resetting the server
fence or claiming financial failure. No generic CARD cancellation API is invented.

The existing [processed callback](https://developers.paymob.com/paymob-docs/developers/transaction-callbacks)
and [HMAC verification](https://developers.paymob.com/paymob-docs/developers/webhook-callbacks-and-hmac/hmac/hmac-transaction-callback)
remain authoritative and unchanged. Client completion only requests status.

The private inquiry adapter implements only documented
[transaction-ID lookup](https://developers.paymob.com/paymob-docs/developers/transaction-inquiry-apis/by-transaction-id)
and [order/reference lookup](https://developers.paymob.com/paymob-docs/developers/transaction-inquiry-apis/transaction-inquiry/by-order-id-or-reference).
It performs at most one authentication request and one targeted inquiry, with
timeouts and no automatic retries. It checks mode, integration, amount, currency,
transaction/order/reference binding and unsupported financial actions. Missing,
ambiguous or timed-out results remain unresolved. A returned `financialFinality:
false` means it does not establish finality of the whole intention; a matched
normalized transaction is returned separately as authenticated evidence.

No customer status endpoint invokes inquiry or receives its credential. The
adapter's credential is supplied privately by a separately authorized operator;
there is no new runtime key, credential installation, provider probe or worker.
`commerce_record_checkout_inquiry` requires existing `payments.verify` and
`payments.review` authority. It reuses reconciliation and writes a digest/audit
without manufacturing a callback HMAC. Live execution needs its own exact scope.

## Qualification and limits

83 focused backend tests pass with zero skips: real PostgreSQL17.11, HTTP
handlers, HMAC success/replay, paid order/email capture, native concurrency,
legacy account/RLS boundaries, five historical fixture attempts, private inquiry
and CARD/COD. The migration matches all seven actual hosted function preimages;
eight columns, two constraints, nine added functions and one index replacement
are the complete delta. All154 original native projections and DDL rollback pass.
No production schema or financial row was changed during qualification.

34 checkout/browser cases pass in each of Chromium and WebKit, covering EN/AR,
RTL, mobile/desktop, themes, leave/reopen/refresh, quote restart, Apple dismissal,
decline retry, cart retention and private account changes. Another26 Pixel frame
checks pass across both engines, including the actual pinned package rendering
with isolated provider responses, validation, one-use authorization, denial,
timeout, origin/channel ownership and disposal. Production build and typecheck
pass. Initial fixture/test failures and their corrected final evidence remain.

All financial/provider responses in these tests are isolated fixtures. Real CARD,
issuer3DS, Apple authorization, live inquiry and notification delivery are separate
acceptance evidence. The owner's embedded CARD/iPad Apple visibility report is
preserved as display/device evidence. The five genuine production attempts stay
unchanged and unknown; none was used as a test fixture.

Release execution is one SQL migration plus one compatible app cutover, with
one bounded pause/resume each of the existing MON/Email/PDC timers. No runtime,
flag, Caddy, unit, credential, payment-method activation, provider transaction,
manual worker, product mapping or Git push is included. Old applications cannot
initiate with the new claim contract: recovery favors a freshly approved forward
correction. No automated rollback, migration replay or restore over new customer
activity is allowed.
