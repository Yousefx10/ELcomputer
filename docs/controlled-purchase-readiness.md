# One controlled purchase — local preparation, 2026-10-23

Production remains `03aa6e565f5b5ad3`, schema90. No gate, credential, Caddy,
provider or business record was changed. The new purchase capability is local only.
The [separate inactive application release](controlled-purchase-release.md) is
prepared as `1088e036c4f81048`. Deployment and later activation require distinct
owner approvals. Neither has been executed.

## Exact current blockers

1. `productPage.buyingHeld` is “Purchasing is currently unavailable.” Premium PDP
   combines stock eligibility with `runtimeConfig.public.purchasingEnabled`.
   `NUXT_PUBLIC_PURCHASING_ENABLED` is absent in the saved and loaded production
   environment, so the configured default is false. This disables its purchase
   controls independently of stock and Dashboard payment method flags.
2. Caddy's retained `@dormant` rule denies cart/checkout pages. `@commerce` denies
   checkout/payment APIs and callbacks before Nuxt. Current GETs to `/checkout`,
   `/api/checkout`, `/api/payments/capabilities` and the Paymob receiver all return403.
3. `NUXT_PAYMOB_ENABLED` and `NUXT_PAYMOB_LIVE_REQUESTS_ENABLED` are false.
   Ordinary `getPaymobConfig()` therefore rejects initiation with `gateway_disabled`.
   No account-specific purchasing exception exists in the deployed application.

These are deliberate controls, not a broken inventory/PDC payload or bad API keys.
Changing only the public presentation flag would not safely enable one purchase.

## Owner's new setup, verified read-only

| Area | Actual state / consequence |
| --- | --- |
| Inventory | TESTproduct2026 is published, normal-sale and serialized. Its active Default model, active primary warehouse, product/model/balance projections and50 `in_stock` records agree;50 receipt links exist. **The owner clarified these are test entries, not50 physically verified units.** EGP1 is an intentional test price, not genuine market price. This is structurally consistent test data, not real-stock acceptance. Preserve it; do not create supplier receipts or represent it as genuine inventory. |
| Shipping company | PDC exists, Provider=PDC and Active. **Offer delivery at checkout is false; Delivery governorates is empty.** Customer shipping price is EGP10. That stored customer fee is not evidence of the actual carrier tariff. |
| PDC settings | Saved Product40/type1/template1, allMustValid true and pickup fields present. Provider enablement, automatic booking, reverse and COD remain false. Both caches are empty;382 aliases remain. Saved pickup city10 is not cached. |
| Customer | One active, confirmed, nonanonymous internal profile exists. Its saved mobile fails the required11-digit Egyptian format; its saved destination has no exact PDC mapping. Full private recipient details were not printed. A real destination has not been selected or approved. |
| Transactions | Zero customer orders, payment attempts, transactions, shipping jobs and durable dispatches. |

Before a PDC-selected checkout, Dashboard **Shipping → Shipping companies** needs
Offer delivery at checkout, an actual covered Delivery governorate and the agreed
customer fee. The existing SQL additionally requires enabled saved PDC settings,
valid pickup, exact current pickup/destination city cache entries, Product40 cache
and one unambiguous mapping. Runtime shipping and automatic booking may stay off.
Do not enable these settings or seed caches in this preparation task.

Separately scope one GetCities read and a bounded cache update, reusing the accepted
GetProducts result. Dashboard Test/Sync would repeat the consumed GetProducts call.
Cities and aliases do not establish tariffs. The owner still needs current account
coverage, carrier charges, weight/dimension/High Value terms and return costs.
No tariff or destination has been invented.

## Paymob settings and callback

Merchant secrets remain in `/etc/storefront/runtime.env`, root-owned0600:
`NUXT_PAYMOB_SECRET_KEY`, `NUXT_PAYMOB_PUBLIC_KEY`, `NUXT_PAYMOB_HMAC_SECRET`,
`NUXT_PAYMOB_CARD_INTEGRATION_ID`, `NUXT_PAYMOB_MODE` and
`NUXT_PAYMOB_CARD_INTEGRATION_MODE`. They match the running process and deployment
baseline. LIVE key shapes, modes, positive card ID, method registry and HTTPS origin
pass; the HMAC secret is present. No value was printed, replaced or provider-tested.
No new merchant credentials are needed. Current merchant entitlement/real3DS remain
live acceptance, rather than something this read-only check can prove.

Dashboard **Settings → Payment methods** edits method availability, fees and transfer
instructions. It has no Paymob secret/HMAC credential editor. This is intentionally
server runtime configuration, described in [provider configuration](provider-configuration.md).
Adding a Dashboard credential editor is unnecessary for the first controlled test.
Enabled Card/Cash/InstaPay/Bank Transfer rows do not override runtime/edge controls.

The existing POST `/api/payments/paymob/webhook` validates the signed HMAC and
persisted order/amount/currency/integration/mode, and reconciles duplicates safely.
It deliberately ignores outbound gate closure. Its public ingress is currently403.
A prepared local Caddy candidate permits only this exact POST receiver, the exact
controlled API GET/POST and the EN/AR controlled page GET/HEAD. Authentication,
HMAC, ownership and all other held routes remain unchanged. Keep that receiver
available for outstanding receipts after the purchase window closes.

## Minimal local correction

A separate `/account/controlled-purchase` page and `/api/checkout/controlled`
GET/POST reuse normal customer authentication, quote/command RPCs, physical stock
allocation, one-per-order payment attempt and Paymob Pixel. Public Add to Cart,
checkout, signup, payment APIs and PDC workers remain held.

Private `NUXT_CONTROLLED_PURCHASE` defaults to `{}` and fails closed. Nuxt may
decode environment JSON to an object; both object and JSON-string inputs are
validated identically in source and the exact compiled archive. A future
reviewed grant binds one existing confirmed customer UUID, one persisted cart
command UUID, one product/model, quantity1, one shipping company, exact EGP minor
units and a hash of the approved billing/delivery fields. Its ISO UTC window is at
most one hour. A separate ephemeral review key signs quote IDs against that entire
scope; it is not a Paymob credential. The server enforces the scope before RPCs,
then rechecks the claimed order/payment context before provider initiation.

The existing durable cart receipt prevents a second order, including concurrent
submissions or lost acknowledgements. No schema/RLS change is needed. The browser
starts neither an order nor Pixel on page load; explicit owner actions are required.
Requests have no automatic retries. Uncertain order acknowledgement permits only
saved-order lookup in the UI; uncertain payment initialization blocks resubmission.
An expired window still permits the same customer's saved-order status. A browser
return alone never proves payment. Refunds remain outside this flow.

The request-local payment configuration is available only after these exact Auth
and scope checks. It does not change the global purchasing/Paymob flags or credentials.
The shipping runtime, automatic booking and PDC public webhook remain disabled.
The local access candidate is not deployed by the inactive application release.

## Exact future acceptance approval

Technical qualification uses synthetic local database/browser/provider fixtures.
The owner's EGP1/50-unit production entries are not treated as a genuine sale or
shipment. No charge, live intention, supplier write, stock adjustment, order or
booking is authorized. Current merchant minimum-payment terms are unverified.

After technical preparation, choose either an expressly approved nominal payment
acceptance with truthful test accounting, or an actual physical item/order with
its accurate approved price. Do not silently present test records as physical stock.
Before a real PDC shipment, confirm one actual unit/parcel, legitimate recipient,
valid mobile, exact city/coverage, measured kg/dimensions/pieces, pickup and charges.
The existing declaredValue is saved net merchandise value; an EGP1 test price must
not silently underdeclare a different parcel's genuine goods value. If those values
cannot agree for the selected order, stop before booking and review the exact path.

Activate only after the owner approves the completed private account/product/
address/total/window packet, any necessary city/cache/settings changes, the exact
callback access and one card submission. Cardholder enters details personally.
Reconcile signed success, scan/complete packing and private video, then separately
approve one Product40/type1/COD0 SaveShipmentEx with durable `ORD-<order UUID>`,
matching AWB, one private ExportPDF and bounded polling. Resolve uncertainty by
original reference; never blindly book again. PDC's public webhook may remain off.

Preserve the roadmap: WordPress customers/orders migration → complete payment/
shipping reconciliation → actual inventory/delivery readiness → public checkout.

## Final local qualification

42 focused source checks, typecheck, clean build,20 exact-archive HTTP checks,
release guards (including nine remote fault cases), and the two-host local Caddy
policy pass. These use isolated/native fixtures and synthetic provider transports.
They do not establish a real charge, signed live receipt or shipment.
All production checks were read-only. Both handoffs retain the migration roadmap.
