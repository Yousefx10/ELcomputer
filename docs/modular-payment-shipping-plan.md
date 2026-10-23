# Modular payment and shipping — 2026-10-23

## Immediate production status

The [inactive controlled-purchase deployment](controlled-purchase-deployment-receipt.md)
finished before this work started. Both handoffs agree: release `1088e036c4f81048`,
application `32f152f3e75380db1f7ca9c054098231dbbd3226`, schema90. Its approval is
consumed. No previous operator or provider diagnostic may be rerun.

This milestone performs local development and one targeted PostgreSQL read-only
shipping-configuration inspection. It does not repeat the release audit. The
inspection confirms90 migration identities, one PDC company,382 city aliases,
empty product/city caches and saved Product40. It reads no credential values.
Private evidence: `../modular-commerce-planning-20261023/`.

The existing deployed architecture supports the first legitimate Paymob/PDC test.
**No tariff manager, credential editor or provider refactor is a prerequisite.**
Execution still requires a real received unit, accurate selling/declared value,
valid recipient/mobile, exact cities, verified Product40 coverage/commercial terms,
measured parcel and exact approved costs. The EGP1/50-unit test product does not
establish any of those facts. Existing runtime credentials need no relocation.

Prepare one private city-only/cache/delivery packet using the accepted products;
Test/Sync would repeat GetProducts. Separately approve its writes, scoped purchase
grant/access and one exact EGP card submission. Keep the signed Paymob POST receiver
reachable for outstanding attempts after new initiation closes. Only signed,
context-matched payment and completed physical packing permit a separately approved
Product40/type1/COD0 booking. Retain the original durable REF, exact AWB, private
VPS PDF and manual polling. No blind retry; PDC public webhook/automation remain off.
See [the existing checklist](pdc-first-live-shipment-checklist.md).

## Independent implementation and release units

| Unit | Scope | Dependencies / production effect |
| --- | --- | --- |
| B1 — tariff configuration | **Implemented locally in this milestone:** company-scoped editable six-zone drafts, verification, revision history, JSON import/preview/diff/export | One proposed migration91 plus matching application. No checkout integration, business seed, provider call or gate change. Import is a separately approved business write. |
| A1 — canonical provider accounts | Shipping Companies owns adapter/account association and configuration; preserve the current account as an explicitly bound legacy record | One separate migration/application. No automatic reassignment, credential copy or operational activation. Independent of confirming tariff terms. |
| D1 — payment gateway management | Owner-only Payment Gateways and Quick Setup entry, runtime-reference readiness first | Separate release. Existing Paymob transaction functions remain in place. Secret editing/migration is explicit and never a first-purchase prerequisite. |
| C1 — customer shipping strategies | Carrier pass-through, fixed price, subsidy, cap, configurable rounding and order snapshots | Separate migration/application after verified tariff quoting. No use of draft rates. |
| C2 — repeat-purchase promotions | Eligibility/grant/reservation/redemption ledger and conditions | Separate migration/application. Requires C1 pricing snapshots; no WordPress eligibility until independently validated migration. |

Each unit receives its own qualified artifact, target-bound release plan and fresh
owner production approval. Do not combine these migrations or reuse consumed seals.
The first-purchase preparation can proceed alongside local architecture work.
Unconfirmed commercial terms block rate verification/activation, not development.

## Canonical Shipping Companies model

Keep the existing company IDs, checkout selection and compact list/Add/Edit forms.
The installed adapter registry initially contains Manual and PDC. Other adapters
appear only after a tested API contract is implemented. Unknown carrier names do
not imply integration support.

Add a company-owned provider account with an immutable adapter type, account UUID,
configuration revision and separate encrypted secret versions. A company selects
its explicit account; never choose the first active carrier/account. Manual companies
need no credentials. Multiple companies and independently configured accounts are
supported without adding carrier-specific branches to checkout/order controllers.

The company configuration contains connection, service/product, pickup, coverage,
tariffs and tracking tabs. Adapter interfaces cover readiness, coverage/quote,
booking, exact-reference recovery, label and tracking capabilities. Registry dispatch
selects the installed implementation; unsupported operations fail closed.

Retain `shipping_provider_settings.id='pdc'` as the legacy source initially.
Explicitly bind the existing company to it after review; do not infer a binding by
name, company count or merchant ID. New-account settings use private encrypted
records. Unbound/ambiguous configurations remain visible for owner resolution.
Legacy routes resolve or redirect to the bound company while preserving permissions.
The present global PDC record must never be presented as independent credentials
for several companies. Until A1 ships, its existing API editor stays unchanged.

Carry existing Product40, city aliases/caches, status mappings, jobs, shipment
history and private labels forward. New jobs snapshot company/account/configuration
identity before dispatch. Historical or uncertain jobs retain their original account
and durable no-repeat barrier. Editing/deleting a company cannot switch providers,
replace an uncertain shipment or lose reconciliation credentials. Retire referenced
accounts; do not delete them. Account-specific cache/coverage refresh remains gated.

B1's tariffs already use the selected shipping-company UUID, allowing A1 to attach
the correct provider-account revision later without reassigning tariff ownership.

## Payment Gateways design

Add **Settings → Payment Gateways**, separate from **Payment methods**. Quick Setup
opens the provider page. Both route and server requests require the existing active
owner role; hiding controls alone is insufficient. Preserve RBAC/RLS and normal
customer authorization. No deployment-specific owner exception.

The installed Paymob card adapter shows environment/currency, integration IDs,
implemented methods and configuration source. Initial source is `runtime_env`:
presence-only references to the existing private runtime variables. Show separate
indicators for credential presence, integration/mode consistency, last signed
callback verification and commerce/charging holds. Presence is not live acceptance.
Never call a provider merely to open the page or compute readiness.

Secret editing uses a dedicated private encryption key and versioned authenticated
encryption, following the existing shipping encryption pattern. Persist encrypted
secret material outside browser-readable tables. Responses contain presence/version
only; clear entry controls after success. Never return saved secrets, HMACs or
plaintext rollback values. Audit actor/time/version and changed field names only.
The page manages no card details.

Do not automatically import `/etc/storefront/runtime.env`, rotate keys or change
the configuration source. A later owner-approved private import or explicit secret
entry creates an encrypted candidate. Validating format locally is distinct from
provider authorization. Switching sources requires an exact reviewed revision and
an explicit fallback plan; preserve the runtime source until the candidate is
accepted. Retain previous encrypted key versions for outstanding payment receipts.
Rollback selects a prior known version; it does not overwrite current ledgers.

Add a configuration resolver before the existing Paymob functions; preserve their
transaction/amount/currency/integration checks and HMAC authority. Persist the
provider/configuration version on new payment attempts. Reconciliation resolves
the original version and remains available when new charging closes. Future gateways
implement the same explicit capability contract; arbitrary IDs do not enable them.
Method visibility, provider configuration and charging authorization remain separate.

## Customer pricing, subsidy and rounding contracts

Keep actual carrier freight, carrier VAT, COD, optional insurance and surcharges
separate from the customer delivery charge. The latter includes carrier fees only
when explicitly selected in its pricing configuration. Never fabricate a crossed-out
price or advertise internal merchant subsidies as a customer charge.

Strategies are mutually explicit: pass-through eligible carrier cost; fixed charge;
or a percentage store-funded discount on eligible carrier cost. Optionally apply a
customer cap. For EGP100 eligible cost: fixed60 or40% discount yields customer60 /
merchant40; pass-through yields customer100 / merchant0. Fixed charges above carrier
cost produce a disclosed internal margin, not a negative subsidy.

Represent EGP as integer piastres, percentages as basis points and weight as exact
decimal/rational quantities. Never multiply binary floats for money. Calculate the
strategy, round the customer amount by the configured increment (exact/up/down/
nearest, explicit half-tie policy), then enforce the optional cap. A cap may be an
exact non-increment amount. Zero is explicit; omission never means free delivery.
Define VAT-inclusive/exclusive bases before verification. Merchant accounting keeps
the original carrier amounts; customer rounding cannot rewrite them.

Trusted quote/command transactions validate tariff/account validity and destination,
then snapshot tariff version/revision, mapping, service, measured/billable weight,
charge components, VAT bases, rule version, rounding, cap, customer amount and subsidy.
Recheck revision inputs before order creation; later settings changes cannot reprice
an existing order. No draft/unverified/expired/unsupported rate produces a quote.
B1 deliberately does not connect draft tables to this financial path.

## Free-shipping promotions

Admin conditions include enablement, campaign/version, dates, eligible companies/
zones, minimum real merchandise subtotal and qualifying purchase definition.
Qualifying purchases must be completed, paid and not cancelled, refunded, unpaid
or fraudulent. Exclude the current order. Historical imports have a separate
unvalidated origin until migration acceptance explicitly enables their eligibility.

For **all subsequent purchases**, evaluate prior qualifying purchases under the
customer eligibility lock. For **next purchase only**, issue one grant per customer
and campaign after the first qualifying purchase, not one new grant after every
purchase. The latter would unintentionally become perpetual free shipping.

Preview/abandoned carts never consume a grant. Reserve under the same order/quote
transaction with a unique active reservation; concurrent checkouts cannot both spend
it. Consume only at the configured qualifying paid-order event with an idempotent
ledger entry. Release an abandoned order's reservation only when outstanding provider
attempts are definitively reconciled/cancelled; a local timeout cannot prove that a
late signed payment will not arrive. Never release uncertainty into double spending.
Refund/cancellation/fraud invalidates unspent source eligibility. Spent grants remain
auditable; replacement requires an explicit policy/owner action.

If both rules apply, prefer the unlimited rule and retain an unused next-purchase
grant. A free customer charge always retains actual company cost in the order
snapshot and accounting. No promotion triggers booking, refunds or imported stock.

## One next release

Prepare and review **B1 only: Shipping Company tariff drafts/history**, with its
single migration91 and application. Import the supplied six-zone file only after
separate approval of the exact company/version/diff. Preserve all production gates.
No architectural enhancement is required before the separate first-transaction
details/approval packet. A1, D1, C1 and C2 remain separate implementation units.
