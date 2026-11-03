# Embedded Paymob methods

Pixel uses the pinned, unmodified `paymob-pixel@1.2.8` package. Merchant code
only supplies a scoped Intention secret and manages the iframe lifecycle.
Provider fields never pass card numbers or CVV through application APIs.

`NUXT_PAYMOB_PIXEL_ENABLED` defaults false. A reviewed, nonempty JSON UUID list
in `NUXT_PAYMOB_PIXEL_CUSTOMER_IDS` limits the experience to those authenticated
customers. Other customers retain hosted CARD. An empty list permits all
authenticated customers; it requires a separate public rollout decision.

Apple Pay uses the existing private `NUXT_PAYMOB_INTEGRATION_IDS` registry:
`apple_pay` contains the merchant-specific integer `id`, live `mode`, `enabled`,
`pixelVerified`, `certificatesVerified` and exact HTTPS `verifiedOrigin`.
These readiness flags record reviewed merchant evidence. They do not establish
a successful live transaction. Browser eligibility additionally requires secure
context, `ApplePaySession.canMakePayments()` and supported session version.
Google Pay remains unavailable.

The client selects CARD or Apple Pay before confirming checkout. Both retain
the existing CARD commerce, pricing and fee contracts. The server selects
exactly one integration ID for one Intention and freezes that actual ID in
the existing private attempt. No SQL change is required. `paymob_method` is
an initiation selector; quotes continue using the ordinary `payment_method`.

Each Intention sets its configured site's `/api/payments/paymob/webhook` and
localized `/checkout/payment-result?checkout_id=...`. Signed callbacks retain
the real integration ID. The existing database validates integration, mode,
amount, currency, provider mapping and ownership before finalization. SDK and
browser return events only open the owned status view.

One iframe creates one SDK instance and permits one submission. Removing it
disposes its globals and fields. Hosted fallback is offered only after an SDK
failure before submission, once the embedded frame has been removed. A possible
submitted payment always goes to server status. No automatic provider retry occurs.

Checkout retains private recovery commands without a permanent warning on a
normal visit. Status performs one initial read, plus explicit manual checks.
No unverified, abandoned or declined attempt creates an ordinary CARD order.
Try again stays disabled until the server explicitly retires an unfunded session.
A failed transaction or local expiration alone is insufficient. This release
does not implement automatic Intention retirement or claim provider finality.

Disabling the Pixel flag prevents new embedded starts. Keep the Apple registry
ID and new callback-capable application installed for genuine late callbacks.
An old application rollback needs fresh review once Apple attempts exist.
Deployment, merchant 3DS/Apple acceptance and public rollout are separate gates.

Official contracts: [Pixel](https://developers.paymob.com/paymob-docs/developers/checkout-experiences/pixel-embedded),
[Intention](https://developers.paymob.com/paymob-docs/intention-apis/create-intention),
[callback overrides](https://developers.paymob.com/paymob-docs/need-help/faqs),
[Apple Pay](https://developers.paymob.com/paymob-docs/payments-and-features/payment-methods/apple-pay-all-regions).
