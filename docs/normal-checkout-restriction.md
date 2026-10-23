# Restricted purchasing through normal checkout

The existing private grant also protects ordinary storefront purchasing.
Customers choose products, use their saved profile address, review delivery and
place their own order through Cart and Checkout. The application does not create
an order or initialize Paymob merely because a page loads.

No new configuration variable, schema, customer role or provider credential is
introduced. `runtimeConfig.public.purchasingEnabled` retains its existing default
false. With public purchasing enabled, normal Auth, shipping, payment settings,
quote, order and recovery behavior remain available.

With public purchasing disabled, `runtimeConfig.controlledPurchase` must pass the
existing strict grant validation. It binds one confirmed, nonanonymous, active
customer, product/model, quantity1, shipping company, exact normalized address
hash, EGP minor-unit total and UTC window of at most one hour. An internal account
flag grants no exception. Payment initiation also requires `payment_enabled=true`.
All global purchasing and live-provider flags can remain false.

## Server and browser contracts

- Every ordinary shipping-option, quote, order and payment initiation request
  checks current Auth and the private grant. Cash, transfer, coupons, other items,
  extra quantities and changed delivery fields cannot bypass the restriction.
- `/api/payments/capabilities` returns only safe purchasing/card capabilities.
  Private availability requires a bearer-authenticated eligible customer. It
  never returns the review key, approved address hash or durable command UUID.
- Normal Cart/Checkout middleware and product controls use these capabilities.
  Account changes, expiry and errors close access. SSR requests do not share
  private capability state. Server checks remain authoritative.
- The ordinary browser cart identifier, selected items, completion markers and
  unresolved checkout recovery envelope remain unchanged. Nothing constructs a
  product selection or enters an address for the customer.
- Under a grant, its `cart_id` is the single durable SQL command identity.
  The signed quote additionally binds the normal browser cart. A changed browser
  cart cannot reuse that review. A new cart/review still resolves against the
  same durable command, so it cannot create a second order. The older controlled
  API shares this same receipt boundary and is not an additional order path.
- The existing quote/command RPCs still decide stock, financial values and
  replay/conflict outcomes. No schema or RLS change is needed.
- Normal Paymob initiation uses request-local configuration only after exact
  order/item/address/amount checks. The grant is rechecked around the durable
  payment claim. Explicit owner action is required. HTTP retries are disabled,
  and uncertain initialization hides the retry button.
- Grant expiry removes displayed secure fields. Already issued provider sessions
  and late signed events require reconciliation; closing an application gate is
  not a provider cancellation or refund.
- Owned order/status reads and the signed callback receiver remain independent
  of outbound grant expiry/revocation. Neither redirects nor SDK completion mark
  an order paid. Caddy must separately preserve the exact callback POST and owned
  receipt paths when initiation is closed.

## Address continuity

Checkout prefills both saved profile address lines in separate editable fields.
Review displays both. Server normalization combines them into the existing
single order street field, which is used by Paymob billing and PDC delivery.
The post-order profile save retains separate lines instead of duplicating the
combined address. Retained clients that omit line2 do not clear the saved line.
An explicitly blank line2 from the new form can clear it.

This change does not introduce multiple saved addresses, relax required delivery
fields, choose PDC city IDs or approve any customer/carrier price.

## Release and acceptance

The owner-approved account/profile Caddy access is recorded in the
[access receipt](account-profile-access-receipt.md). That access does not deploy
these application changes or enable purchasing.

Local qualification covers real isolated PostgreSQL, actual normal Vue pages
in Chrome with synthetic transports, SSR capability isolation and existing
Paymob/PDC/cart/PDP regressions. Provider fixtures cannot establish merchant
minimums, a real charge, signed live reconciliation or a real shipment.

Before activation, approve the inactive application release, confirm the saved
address and authoritative PDC mapping, approve charges and exact gross amount,
then review the narrow grant and Caddy opening/closure packet. The owner performs
checkout personally. One payment and one PDC booking retain separate approvals.
Do not use the obsolete special-page opening candidate.

The editable PDC tariff drafts, refund/reverse acceptance and modular gateway,
carrier, subsidy and loyalty roadmap remain separate.
