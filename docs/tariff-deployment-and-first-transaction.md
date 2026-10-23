# Tariff release and first provider acceptance — 2026-10-23

The existing tariff artifact is preserved. No new application feature, rebuild,
production mutation or provider request belongs to this preparation.
The deployment packet was prepared, then **withdrawn before execution** when the
exact archive failed retained-client HTTP checks. The next review is local packaging
repair/reseal only. Financial tests require separate approval, using the deployed
restricted purchase capability.

## Tariff deployment packet

Production baseline: inactive release `1088e036c4f81048`, schema90.
Application source: `ba05770187a0a29fca225da957ed0ad8f7594d70`.
The [original local receipt](shipping-tariff-release.md) remains historical evidence.

| Pinned input | Value |
| --- | --- |
| Unchanged archive | `ad1b16367e5b1039cb6be2d61ac670f4f608479f27290997341bd5533b9d73f5` |
| Original review seal | `64d3c96e5b8e7328867f2015d189d4d80fd909257c38ca40439ac3f5f86b0505` |
| Proposed release | `ad1b16367e5b1039` |
| Only SQL | Migration91, `20261023010000_shipping_tariff_drafts.sql` |
| SQL SHA256 | `97cee839a01873a98e2cdcbdf9bbcfca6a742cf18d0a9c283bffae70635c45fe` |
| Withdrawn production seal; do not apply | `edc87bde697cecf6918a8a0b7d050204eb8d54766767d2b6e5206594dc41a489` |

Private withdrawn plan: `../tariff-production-preparation-20261023/prepared-2/plan.json`.
Fresh read-only preflight,138 protected projections and authenticated encrypted
full database/runtime backup readback passed. Production remains unchanged.
`STOP.json` now withdraws the plan; no execution intent or production apply exists.

**Verified blocker:**1082 retained files are absent from the new compiled static
serving registry, including1064 JavaScript files indexed by the accepted baseline.
Files exist with correct bytes, but file presence alone does not make Nitro serve
these URLs. Three current-production JavaScript URLs return200 with matching hashes;
the exact sealed candidate returns404 for those same URLs. This would break cached
clients loading older chunks. The original96 checks and four anonymous API checks
remain valid for their scopes; they did not establish static HTTP retention.

The new local guard now rejects this artifact before SSH. The remote candidate
also requires retained HTTP bytes before SQL, and stopped plans cannot be reused.
The old plan/seal and fresh backups are retained as evidence, not authorization.

Next exact authorization packet:
`../tariff-production-preparation-20261023/NEXT-EXACT-AUTHORIZATION.json`.
Its proposal lists every missing entry and the exact metadata, bound to original
archive, accepted baseline and source commit. Review seal:

```text
ee0da9bb58b65c7a6b0ea505adc82bcde05cc674cb36c7e79d5feae565b249fa
```

Owner approval text for this narrower action:

```text
Approve local tariff packaging repair and reseal only.
Proposal: ee0da9bb58b65c7a6b0ea505adc82bcde05cc674cb36c7e79d5feae565b249fa
```

The proposal reuses the completed build, adds only the reviewed immutable serving
metadata to a **new copy**, rejects collisions/path escapes/hash mismatches and
preserves the new Nuxt latest pointer. Current baseline metadata is reused where
available; older unindexed files have explicit content-derived MIME/size/path/
SHA256 ETag entries in the proposal. No old package is rewritten. Qualify the new
archive's current and retained HTTP bytes, then present a fresh target-bound
production seal for separate approval. No new feature or full rebuild is proposed.

This is not production deployment approval. It authorizes no SQL, business import,
price edit, access/grant activation, credential/Caddy change, payment, booking,
refund, return or Git push. The artifact was not repaired now because the owner's
current instruction explicitly forbids altering it before approval.

The new [operator](../scripts/shipping-tariff-release/operator.mjs) is independent
of consumed releases. Its `prepare` and `check` actions are read-only remotely.
It reuses the 96 completed feature/regression checks, typecheck, original build,
four compiled anonymous checks and extracted archive. Only new release guards
were tested:11 distinct cases, including eight remote faults, native transaction
rollback, exact schema delta, preservation, repeat rejection and artifact validation.
The original artifact and SQL were never rewritten.

After repair, resealing and separate exact deployment approval, execution must
check the new seal and live baseline again,
make fresh encrypted database/runtime backups and authenticate their readback,
stage the exact archive, and run private candidates against schema90 and91.
One transaction adds two private RLS tariff tables, four functions, the exact
reset-retention registration and one migration-history record. Existing tables,
data, schema, ACL/RLS, Auth security, files, assets and operational settings are
compared before commit and activation. Only Nuxt is switched and restarted.
Caddy, credentials, global gates and shipping/customer prices stay unchanged.
Post-deployment health and preservation checks must pass before a success receipt.

The import is deliberately separate. The proposed deployment creates no tariff
business rows.
The supplied six-zone file stays editable, inactive and unverified, without an
effective date. Product40 applicability, fractional rounding and suburb mappings
remain unverified; insurance remains off. A later exact company-bound draft import
requires its own approval. B1 contains no tariff checkout reader or activation path.
No rates become checkout prices by deploying, importing or verifying a version.

Any drift, uncertain SQL commit or failed phase stops execution. Retain its intent
and receipts; do not rerun or automatically roll back. Review the actual schema,
current symlink and service first. Any separately approved application rollback
preserves schema91 and all newer data; dropping tables or restoring an old database
is outside this packet. A candidate failure after SQL can leave schema91 with the
old application, which must be reported accurately.

## First real transaction: current facts and remaining decisions

A fresh read-only inspection still finds schema90, zero orders, attempts,
transactions, shipping jobs and dispatches. Runtime and public holds are checked
by the tariff plan. No authenticated provider endpoint was called.

| Requirement | Current evidence and exact remaining requirement |
| --- | --- |
| Account | One active, confirmed, nonanonymous internal customer profile exists. Use it through ordinary customer Auth/RLS, or separately approve another account's onboarding. Confirm the chosen browser session and its customer UUID; no owner bypass. Its saved phone fails the 11-digit Egyptian rule and its destination has no exact mapping. Approved checkout fields can supply the correct details; a profile edit is not inherently required. |
| Product | TESTproduct2026 is published, normal-sale, EGP1, with one active Default variant and 50 structurally consistent serialized stock/receipt records. The owner now reports one real unit exists. This does not verify 50 physical units. Privately identify the actual unit/serial and genuine inventory provenance before allocation/packing. Preserve the entered stock. |
| EGP1 | Application conversion accepts EGP1 as100 minor units. Paymob documents a total amount in minor units but publishes no merchant-specific minimum on the reviewed Intention page. **Live acceptance of this exact amount remains unconfirmed**, rather than established as supported or prohibited. Check the live integration/acquirer minimum in the merchant portal or support; alternatively, expressly approve one exact-total live attempt with the minimum still unconfirmed and accept a possible provider rejection. No such attempt is authorized now. Do not confuse payout or instalment limits with card-payment limits. |
| Delivery | One active PDC option exists. Checkout delivery is off and its governorates are empty. Choose one real destination, one exact covered governorate and verified city IDs. Both caches are empty; pickup city10 is uncached and382 aliases do not prove coverage. Scope one GetCities request and explicit cache/mapping updates, reusing accepted GetProducts evidence rather than repeating Test/Sync. Validate the existing product-cache format and entitlement before using it. |
| Customer charge | Stored shipping fee is EGP10; card customer fee is0. Neither is a new approval. Approve item price, any genuine discount, one delivery fee and the exact final EGP total. Paymob charges the **whole saved order total**, not only the EGP1 sticker price. EGP11 would be arithmetic only if the current fees were expressly accepted. |
| Merchant charge | Paymob merchant/acquirer fees remain unknown. Obtain a confirmed one-off PDC quote or applicable contract for the selected service, route, billable weight, VAT, surcharges and failed/return delivery. Approve genuine courier liability explicitly. The imported tariff does not establish Product40 applicability, rounding or suburb coverage. There is no enforceable carrier cost-cap field in this booking payload. |
| Parcel | Privately confirm actual goods value, measured weight, dimensions, one piece, pickup contact/address and opening choice. Current outbound payload sends saved weight and item-based pieces; dimensions are review evidence, not invented API fields. Billable weight and rounding need carrier confirmation. |

The EGP1 item is not rejected merely because its deliberate selling price is low.
Its material shipping constraint is declared value: existing code sends saved
subtotal minus discount, excluding shipping and payment fees. For this order that
would be EGP1 without a discount. If the truthful carrier-declared value differs,
this unchanged path cannot supply a separate override. Choose a suitable genuine
product/value path before booking; never underdeclare or alter the sealed artifact.

Official sources reviewed read-only:
[Create Intention](https://developers.paymob.com/paymob-docs/intention-apis/create-intention)
and [Transaction callbacks](https://developers.paymob.com/paymob-docs/developers/transaction-callbacks).
The absence of a published minimum is not merchant-specific approval.

## Separate authorization packets after deployment

The private `../tariff-production-preparation-20261023/FIRST-REAL-TRANSACTION.private.template.json`
binds the existing candidate account, product, variant and company. Missing facts
remain null and every new authorization remains false. Addresses, values, serials,
keys and card details do not belong in Git. No valid runtime grant is fabricated.

1. **Readiness/setup:** approve the exact city-only request, reviewed cache/mapping
   patch, one checkout delivery option/governorate, agreed customer price and PDC
   account/product/pickup/weight settings. Keep automatic booking, COD and reverse
   off. A one-off verified shipment quote can support this test while imported
   tariff versions remain drafts. The whole modular roadmap is unnecessary here.
2. **Access and order:** bind one confirmed customer, durable cart command UUID,
   product/variant, quantity1, company, canonical address hash, exact EGP minor total
   and UTC start/expiry of at most one hour. Generate the private review key only
   in the reviewed activation packet. Approve the precise runtime patch/restart
   and Caddy candidate, then one explicit durable checkout command. Global public
   purchasing and Paymob gates remain false; the grant authorizes request-local
   payment configuration only for this exact context.
3. **Money:** separately approve one Paymob intention and one card submission for
   that saved order/total/integration. The cardholder enters card details and3DS.
   Page load creates no order or payment. Require the persisted attempt/provider
   order, verified LIVE HMAC callback, unique transaction, amount/currency match
   and durable paid order before fulfillment. Browser redirects and screenshots
   cannot mark it paid. Record actual merchant charges separately.
4. **Physical fulfillment:** approve/perform the genuine scan and complete packing
   with private validated video. Review the resulting order, selected unit, parcel,
   exact route and commercial terms before authorizing any courier submission.
5. **Courier:** separately approve narrow manual PDC live access, one
   SaveShipmentEx for Product40/type1 or an explicitly selected eligible product,
   pieces1, COD0, `hasAWBs=false`, `allMustValid=true`, and durable
   `ORD-<actual order UUID>`. Include its automatic single-AWB template1 ExportPDF
   and one status poll after the documented indexing delay/five-minute throttle.
   Match exact REF/AWB, store the PDF privately on VPS with hash/size, verify
   authorized download and denied anonymous access. Poll status alone does not
   establish physical pickup/delivery or authorize inventory/financial changes.

## Caddy ingress, late events and closure

Local candidates are saved privately as `Caddyfile.purchase-window` and
`Caddyfile.receipts-only`. The opening candidate reuses completed two-host Caddy
qualification. The new receipt-only candidate needs Caddy adaptation/validation
and bounded route checks in the later activation packet before any installation.
Tariff deployment does not install or reload either candidate.

Opening permits GET/HEAD only for `/account/controlled-purchase` and its Arabic
equivalent, GET/POST only for `/api/checkout/controlled`, and **POST only** for
`/api/payments/paymob/webhook`, preserving its HMAC query. Upstream receives bearer
headers and private/no-store responses. Keep ordinary checkout/payment APIs,
signup, PDC webhook and worker ingress held. Verify unauthorized/wrong-account,
wrong-method, extra-path and changed-total/address attempts fail before charging.
Use the existing eligible account's authenticated session; Dashboard login stays
available. This does not require opening the public customer login or signup.

The intention sets the exact HTTPS `notification_url`. Existing SHA512 HMAC,
provider-order identity, amount, currency, integration and saved LIVE context
are authoritative. Verify delivery in the merchant portal; no credentials need
replacement. The callback code deliberately remains valid after outbound gates
close. It is not dependent on the one-hour grant or intention's1800-second display
expiry. Duplicates preserve success; late signed success remains reconcilable.
A cancelled/refunded order is flagged `order_requires_review`, not shipped.

At closure, deny controlled API POSTs while keeping its authenticated GET, page
and the exact Paymob POST receiver. Let the retained valid grant expire so its
read-only receipt remains accessible. Keep keys and callback ingress for every
outstanding attempt and the provider's confirmed retry horizon. Do not restore
the entire old Caddy file or remove the grant merely because the window ended.
Final receiver retirement requires all outcomes reconciled and separate approval;
no arbitrary automatic deadline is established.

For uncertain payment initiation, do not create another intention or resubmit the
card. Inspect the original attempt/special_reference in the merchant portal and
compare exact order, total, currency, integration and mode. If provider creation
succeeded but local provider-order persistence failed, callbacks cannot yet bind
it. There is no automatic merchant-query recovery path. Preserve the uncertainty;
separately review any exact existing-RPC binding repair and request signed provider
redelivery. Never use a browser response or manual paid flag as payment proof.

For uncertain booking, do not generate another reference or book again. Only
separately approved lookup of the original REF may recover one uniquely matching
AWB. Empty/ambiguous results stop the test. An AWB with PDF failure permits only
label recovery, not another booking. One status poll is the default budget; any
additional poll/recovery request needs its explicit conditional approval.

## Refunds and reverse shipments are separate acceptance

**Paymob refunds are not implemented.** There is no refund/void request endpoint
or ledger workflow. The current callback normalizer rejects refunded, voided,
capture, authorization-only and child/nonstandalone events with422. Preorder
manual-payment recording and an after-sales “refund” resolution are not gateway
refunds. A successful card sale proves none of this functionality.

An integrated real refund test first needs its own scoped implementation/release:
server/RBAC action, exact original transaction, amount within the refundable
balance, provider entitlement, durable request/reference and uncertainty handling,
signed refund reconciliation, duplicates/late events, partial/full amounts and
order/accounting treatment. Then separately authorize one exact refund and fees;
verify merchant evidence, ledger/order state and the actual card credit. A refund
performed in Paymob's portal would instead need separate owner approval and an
explicit manual reconciliation plan because today's handler rejects its event.
No refund or automatic retry is included in the first purchase approval.

**PDC reverse shipment code is implemented but live acceptance is pending.**
Claim-linked staff actions, a separate queue, `ASREV-` references, exact recovery,
private labels and polling exist. Fresh saved settings have `reverse_enabled=false`
and `reverse_shipment_type_id=null`; type3 readiness therefore fails.
Outbound type1 acceptance does not establish return entitlement or charges.

Its separate real test needs a genuine eligible delivered order and authorized
return claim, claims/logistics permissions, correct customer pickup and store
destination mappings, confirmed account/product/type3 entitlement and all return
charges, measured parcel and explicit narrow activation. Approve one claim-bound
booking/PDF/poll plus separately bounded original-reference recovery. Verify the
actual return pickup and store receipt, label privacy and preserved outbound AWB,
order/payment history. Refund, inspection, disposition and restocking each use
their own legitimate approvals/workflows; none follows automatically from a
return booking. No supported carrier cancellation endpoint is assumed.

The [gateway, carrier-account, subsidy and loyalty roadmap](modular-payment-shipping-plan.md)
remains independent releases after initial provider acceptance. Both handoffs and
all earlier receipts are preserved. No Git push is authorized or performed.
