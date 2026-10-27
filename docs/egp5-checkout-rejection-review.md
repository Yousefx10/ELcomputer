# EGP5 checkout rejection — E84 read-only investigation

**No order, quote, Paymob attempt or payment transaction exists for the selected
customer at15:51:19 Riyadh,27 October2026. Root after coupon remains UNCONFIRMED.**

OD-20261027-EGP5-CHECKOUT-01 continues BETA-11. The owner stopped after
“This purchase is unavailable.” before/after trying FRE5. No speculative repair,
new deployment, grant change, restart, SQL write, provider request or payment ran.

Production remains a402cf24a9685e0d/source113b313/schema98/PID53535.
The renewed grant remains14:59:04–15:59:04 Riyadh. No implicit extension.
Public signup OPEN, public purchasing OFF, PDC PAUSED. FRE5 remains unchanged,
active, usage0/limit1, merchandise25/delivery45, and correctly customer/product/
Manual scoped. Product25, Manual50 and cardfee0 remain unchanged.

## Confirmed authorization path

The normal checkout uses POST `/api/checkout/quote` and POST
`/api/checkout/coupon`. Both call `reviewCheckout`, then
`authorizeNormalCheckout` BEFORE `commerce_checkout_quote`.
The guard compares account/window, payment and shipping methods, Manual ID,
exact coupon, normalized address hash, one product, model and quantity1.
Only after those pass does SQL create a quote. Final review must total500 minor
units; order/review-token and payment authorization remain separately strict.

Without FRE5, exact coupon equality fails before the SQL RPC. This explains
the initial403. It is not an EGP75 amount calculation failing after quoting.
Correct coupon submission is independently possible: the coupon route receives
its explicit coupon_code, not merely the cart's previously applied coupon.
A missing initial coupon does not by itself prevent the separate Apply request.

Caddy's current exact POST allowlist includes both paths. Anonymous empty-body
probes receive Nuxt JSON401 “Missing authorization token.” from both, versus
Caddy's distinct plain403 “Unavailable”. No authenticated owner request was
replayed or impersonated. Production quotes remain0. The reported text is emitted
by Nuxt authorization, not the quote SQL or Paymob.

## Bindings and SQL verified

The unique verified active Outlook customer UUID matches the live grant.
Grant product, Default model, quantity, Manual ID, FRE5 and500-minor total match.
The current saved profile hashes identically through operator and actual
checkout-prefill/normalization code. All seven address hash fields agree.
The live process/runtime, Caddy, retained assets and application remain unchanged.
This does not prove what the stopped browser actually submitted.

A live read-only pricing SELECT returns merchandise25, delivery50, merchandise
reduction25, delivery reduction45, cardfee0, total5. A new disposable native
PostgreSQL/HTTP test matched SIX deployed function definitions exactly and passes
five focused checks, zero skipped. Actual existing handlers and SQL accept the
complete matching coupon request and quote5 with total discount70/delivery45.
Changing only the browser cart ID also passes. Changed address, quantity or model
fails with the same generic403 before quote creation. No payment tests were rerun;
no local order/payment/provider call was made.

The production quote RPC was deliberately NOT called: it inserts a durable private
quote and takes row locks. The investigation remains read-only. The local identical
SQL result is not hosted owner acceptance or a newly created production quote.

## Remaining evidence and minimum correction

After-coupon root is UNCONFIRMED. No mismatch exists in captured saved production
bindings. The actual failing browser request, cart/revision and pending-recovery
state are unavailable to this session; no matching owner browser tab is connected.
Do not claim a particular field or deploy a guessed correction.

The requested next evidence is the failed FRE5 request path/status and ONLY
items(product ID/model ID/quantity), coupon_code, payment_method and
shipping_company_id; no token, cookie, authorization header or address details.
A private alternative `browser-readonly-check.js` reports match flags for the
selected account's owned cart, coupon, normalized address, Manual and pending
checkout. It performs no requests, clicks, storage writes or token/cookie reads.
Run it only on the stopped checkout page and return only its printed match flags.
Never clear a pending command, reset the fixed grant cart, mint a new review key,
create another order/intention or loosen the final EGP5 check speculatively.

Smallest correction is pending that actual rejected field. No application code
change or deployment authorization packet is justified yet. If a defect is
confirmed, prepare a minimal reusable correction and new guarded approval;
if a client binding is stale, recover that state without widening the grant.
After15:59:04 a renewed purchase window requires new explicit approval. The existing
af7112 approval's runtime-only closure remains separately authorized and pending;
no closure ran during this read-only investigation.

All32 deferred tests, frozen135 paths, clean location4843754/version26190000,
Storage work, existing branches/commits/uncommitted work remain preserved.

Private packet: `../checkout-egp5-guard-repair-20261027/`: `readonly-result.json`,
`final-readonly-price.json`, `pricing-functions.private.json`,
`coupon-path.native.test.mjs`, `coupon-path.native.log`, `qualified-results.json`,
`browser-readonly-check.js`. No customer address or session/token is in this report.
