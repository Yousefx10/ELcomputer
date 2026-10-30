> **E140,29October2026 — owner priority override.** PDC commercial fees are accepted for now. Merchant commissions, deductions, net remittance, settlement timing and ERP/Daftra accounting are LAST deferred work, not shipment-booking prerequisites. Basic customer totals/requested COD, verified collection and outstanding receivables remain guarded. Use the [current real-COD operations note](real-cod-pdc-operations.md); first shipment still requires a genuine approved/packed order and separate exact approval. Historical uncertain bookings stay quarantined. No new production/provider action is authorized here.

# First COD purchase: implementation and activation gates

Status: checkout, private packing and normal COD cash deployed on schema85.
Public purchases remain disabled.
No business settings or real orders were created by the release.
See the [release receipt and owner browser checks](commerce-foundation-release-receipt.md).

## Existing features reused

| Area | Existing implementation retained |
| --- | --- |
| Cart | Versioned cart identity/revision, cross-tab updates and consumed-cart acknowledgements. |
| Customer access | Supabase email/password, signup, confirmation and recovery; profiles use the verified Auth UUID. Existing active-account checks remain. |
| Review and orders | Migration82's five-minute quotes, trusted pricing/coupons, cart serialization, atomic stock allocation, durable receipts and exact-request recovery. |
| Inventory | Built-in procurement receipts, product models, primary warehouses and physical serialized units. New products remain serialized; stock projections cannot be manually manufactured. |
| Payments | Existing `cash` method, enablement and fixed-fee settings. COD creates an unpaid order; placing an order never proves collection. |
| Shipping | Existing Commerce shipping-company management, customer price, internal cost/return cost and carrier activity. |
| Dashboard | Existing authorized order list, detail and processing transition. Packing, scan, video and payment guards remain intact. |

Current card/PDC extension: [controlled-sales readiness](live-sales-readiness.md).
Migrations86–87 are local candidates; public checkout remains disabled.

## Task changes

Migration83 is `20261020120000_cod_shipping_checkout.sql`. It was applied before
the new application in the approved foundation release. Migrations1–82 and existing
installation certificates are unchanged; this is not installer recertification.

- Carriers gain disabled-by-default `checkout_enabled` and empty
  `checkout_governorates`. The existing Shipping form edits them. Enabling requires
  coverage and an explicit nonnegative customer price, including explicit zero.
  One option has one price for its selected governorates. Separate rates use
  separate configured options; no coverage or price is seeded.
- Authenticated `GET /api/checkout/shipping` returns at most 50 enabled active
  options: identity, name, customer price and governorates. Costs, return costs,
  internal notes and provider credentials are excluded. Failure differs from no
  service. Checkout filters the existing governorate choices and requires a
  selected eligible option for COD.
- COD review requires a confirmed nonanonymous email account, built-in inventory,
  ready stock, an active primary warehouse and sufficient stock projections.
  Existing physical-unit validation/allocation remains authoritative. The cash
  command always passes `allow_out_of_stock=false`, irrespective of the global
  flag. Preorders and external-ERP COD fail closed.
- Locked configuration supplies shipping name/price and the final total. Commands
  revalidate coverage, carrier activity, prices and stock. Shipping identity is
  part of the reviewed intent; changing it requires review. Forged financial
  fields are rejected. Orders retain the delivery identity/name/fee snapshot even
  after a carrier changes or is deleted.
- Delivery is included before payment-fee calculation and insert side effects.
  Customer confirmations, account detail, Dashboard detail and its printed totals
  show the saved shipping fee. COD fees remain separate.
- Existing replay precedes current stock/rate/enablement validation. Old82 commands
  without a delivery identity retain their original fingerprint and can recover
  their original order. New cash quotes require delivery. New code before
  migration83 returns 503 for cash instead of using the old unpriced flow.
- Checkout updates the profile email from authenticated Auth, preserving account
  identity when the delivery-contact email differs. It creates no Auth identity.
- EN/AR strings and existing components/styles are reused. No deployment-specific
  SKU, city, domain, account or fee is added to application logic.

## Initial production observations and purchase blockers

Read-only observation at **2026-10-20 11:37 UTC**:
This historical snapshot predates the foundation release. Current schema85,
four retained Storage metadata objects and release evidence are recorded above.

| Observation | Consequence |
| --- | --- |
| All original 560 imported product IDs remain; 561 products total after the owner's additional product, 559 published. | No original product was changed by this task. |
| Zero published normal products with positive stock, zero `in_stock` units, zero positive warehouse balances, zero procurement orders. | There is currently no verified saleable stock. |
| One active warehouse; `erp_mode=built_in`. | Select real stock and receive it through the existing workflow. |
| No shipping companies. | No customer delivery option or price exists. |
| Every payment method is disabled. | COD must be deliberately configured for private acceptance. |
| `allow_out_of_stock_purchases=true`. | Left untouched. New COD ignores it and rejects unavailable stock. Set it off before sales to align storefront availability. |
| Hosted signup disabled; email confirmation required; one Auth user/profile, no nonstaff customer profiles. | An approved confirmed customer identity and real email flow remain acceptance prerequisites. |
| Zero orders, 82 migration versions, zero Storage objects. | New migration/application are local only; no real order was generated. |
| PDC and automatic labels disabled. | No shipment/provider activation is implied by order persistence. |

The owner reports production health PASS, Dashboard login, product creation,
Draft saving and VPS image uploads working. Those are owner-reported results,
not new authenticated browser acceptance from this task.

The customer-access pages are now owner accepted. Browse-only ingress still denies checkout APIs.
It was not modified. Do not open it before owner-controlled acceptance. Review a
restricted acceptance environment/access gate separately; retain existing Auth,
RBAC, RLS, restrictive origins and deployment configuration.

**Packing video correction deployed:** [private VPS packing
videos](private-packing-videos.md) replace signed Storage uploads, verification and
redirects with authenticated streams and server-validated file evidence. Migration84
and the application are deployed with the private directory, decoder and Linux
service-sandbox probes accepted. Original scan/video coverage and completion guards
remain. Caddy routing is unchanged. Real camera/packing and dispatch acceptance
remain pending; the release created no order or packing evidence.

**Collection path:** [Normal COD cash collection](cod-collections.md) now records
verified partial/full customer receipts and separate exact treasury reconciliation.
It reuses order balances and the existing customer-receipt ledger, with locked
permissions, audit history and durable duplicate protection. Delivery never marks
cash paid. Migration85 and its application are deployed; actual delivery, cash
and reconciliation still need restricted owner acceptance. The preorder payment
endpoint remains separate and unchanged.

## Business inputs required before purchases

Enter these only after the corresponding production changes are authorized:

| Existing Dashboard area | Required owner decision/input |
| --- | --- |
| Products and Commerce → Procurement / Serialized Items | Choose existing saleable products and models/SKUs, current selling prices and an active primary warehouse. Physically verify units/quantities and record genuine procurement/receipt evidence through the existing workflow. Verify `in_stock` availability. Never type stock into serialized projections. |
| Commerce → Shipping | Enter the actual carrier/option name, explicit **Shipping Price for Client**, covered **COD governorates**, **Active** and **Offer COD delivery**. Use separate options for different prices. Enter internal costs only from real business records; checkout does not disclose them. |
| Settings → Payment methods | Confirm the COD fixed fee, explicitly zero if none. Enable **Cash on delivery** only for restricted acceptance; keep card, PayPal, bank transfer and InstaPay off. |
| Store / ERP settings | Keep built-in inventory as the verified source and disable out-of-stock purchases before sales. COD independently enforces available stock. |
| Customer access configuration | Approve signup versus controlled customer registration, the real confirmed customer email, confirmation/recovery mail delivery and deployment-specific allowed origins. Keep broad signup closed until that decision. |
| Fulfillment operations | Confirm who packs and delivers, the private VPS packing-video path and how actual COD collection will be recorded/reconciled. Providers remain off without separate approval. |

No product, warehouse quantity, shipping coverage, customer charge or COD fee has
been selected on the owner's behalf.

## Customer identity and the next migration

First buyers must use confirmed Supabase identities through the existing access
flow. Orders remain attached to their Auth UUID, not their delivery-contact email.

The later WordPress migration must inventory existing Supabase identities first,
reuse unique normalized **verified Auth emails**, retain existing UUIDs and new
orders, and keep an explicit legacy-ID mapping. Shared, ambiguous, staff and
unverified-email matches need review. Never match on an order's contact email,
auto-create a second identity, manufacture passwords or overwrite newer data.
No historical customer, order or address migration is included here.

## Isolated evidence

`tests/cod-checkout-native.test.mjs` creates and removes its own PostgreSQL17
cluster. It accepts executable/driver paths, never a hosted database URL. Only
synthetic products, received units, carriers and customer fixtures exist there.
No original catalog, production account or provider is contacted.

The 17 passing tests exercise actual migrations and compiled HTTP handlers with
fixture Auth/Supabase transport: old82 receipt upgrade, premature application
503, private carrier projection, final totals, Dashboard list/detail/processing,
concurrent identical commands, last-unit competition, lost-response recovery,
changed prices/coverage, forged totals, another configured area, explicit free
delivery, multiple units, inactive warehouses, zero stock despite backorders,
unconfirmed/inactive accounts, unapproved methods, grants and deleted carriers.
The synthetic example `100 - 10 + 5 + 40 = 135` is test data only.

Focused cart/payment/Auth/account regressions: 11 PASS. Commerce, amount,
packing-video, confidentiality and reset regressions: 53 PASS, six existing
native opt-in skips. The older full native Auth/PostgREST checkout harness was
adapted for configured delivery but was not run: its external native service
tools are unavailable. Fixture Auth checks do not establish hosted signup,
confirmation, RLS end-to-end or real email delivery. Checkout analytics is outside
this fixture; its best-effort warning is not analytics acceptance.

Typecheck, production build and `git diff --check` pass. The original isolated
implementation tests made no hosted change. The later approved release applied
83–85, as recorded in its receipt. No real browser purchase, provider call, packing
video, shipment or cash collection is claimed. No certificate was regenerated.

## Activation boundary

Keep public checkout off. Complete owner browser smoke and configure actual stock,
delivery and confirmed customer access. Then obtain authorization for restricted
owner-controlled end-to-end
acceptance: one reviewed COD order, exact totals, one stock deduction, identical
replay, customer confirmation, Dashboard visibility and real fulfillment evidence.
Accept dispatch/collection separately with actual evidence; do not mark COD paid
at checkout. Public activation requires the owner's acceptance and approval.

**One next owner action:** complete the
[post-release owner browser checks](commerce-foundation-release-receipt.md#exact-owner-browser-checks).
The combined release includes migrations83–85; public checkout stays off.
Verified inventory and delivery/COD settings remain required before acceptance.
Next, investigate the four reported access errors, then activate the existing
Paymob/PDC Quick Setup integrations under approval. WordPress identities, orders
and addresses are a required launch
workstream. Restricted acceptance and public activation require owner approval.
