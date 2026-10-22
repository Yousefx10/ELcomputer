# First genuine PDC shipment — owner checklist, 2026-10-23

**Release preflight PASS. PDC and Paymob live execution remain BLOCKED.**
Production remains `881aadcfd4942ef8`, schema90. No deployment ran.
Use the existing candidate `03aa6e565f5b5ad3`; no rebuild is needed.

Existing deployment approval seal:

```text
eb104358167fa5c104054652177f3134db3471bf4ce4f7eade9c650f8377b4ed
```

The existing operator's read-only check passed again at 2026-10-23 Asia/Riyadh.
It verified clean application inputs, plan/operator/archive/evidence hashes,
authenticated backup readback, retained assets, unconsumed execution state,
target/runtime/Caddy/service identity, schema90, protected data/settings/Auth,
disabled gates and public health. No test suite or build was repeated.
Fresh encrypted execution backups and final preservation checks remain mandatory
inside the separately approved deployment. No execution intent has been consumed.
See the [release boundary](pdc-shipment-contract-release.md).

## Eight owner actions and decisions

| Item | Exact action / decision |
| --- | --- |
| 1. Correction release | Approve only the candidate and seal above. Deploy before stock, customer or delivery edits; those writes change the sealed preservation baseline. This application-only release changes no schema, credentials or activation gate. |
| 2. Dashboard stock | **CRM → Contacts:** create the genuine supplier; there are currently none. **Inventory → Warehouses:** use the existing active warehouse. **Products:** choose one real published, normal-sale product/model, confirm its actual selling price and primary warehouse. **Purchasing → Purchase invoices:** enter the real supplier reference, that warehouse, model, quantity1, actual unit cost and actual supplier payment only. Receive the physically verified unit. **Inventory → Serialized items:** verify its unique ID/QR and `in_stock` state; never type a quantity into a stock projection. |
| 3. Delivery and fees | **Shipping → Shipping companies:** create one actual PDC option, Provider=PDC, Active, Offer delivery at checkout, the single supported Delivery governorate, explicit Shipping Price for Client, actual internal Shipping Cost and Return Cost. “Offer delivery at checkout” controls cash/card delivery; it does not enable PDC COD collection. One option has one customer price across its selected governorates. Confirm saved pickup privately, measured weight and dimensions, service40/type1/template1, allMustValid=true, and keep COD/reverse/auto-booking off. Separately approve one city-only lookup and bounded cache setup using the accepted products; do not click Test/Sync, which repeat GetProducts. Verify both city IDs and one exact destination mapping, then current service coverage and tariff. |
| 4. Product and order | Select quantity1 of a genuine received unit and a real consenting recipient. Confirm the existing customer account, delivery address/mobile, exact city, selling price, any real discount, delivery fee and final payable EGP total. One confirmed active profile exists; there is no separate confirmed nonstaff customer yet. A genuine owner purchase may use the existing account through ordinary authorization, without a special exemption. Otherwise named customer onboarding needs separate authorization while broad signup stays closed. Use ordinary reviewed checkout and its durable order receipt; no direct inserts or manual paid flags. Complete **Orders → Confirm & pack**, including scans and validated private video, before booking. |
| 5. PDC without Paymob? | **Supported for an already legitimately paid, eligible customer order; none exists now.** Current Dashboard cannot turn a normal transfer/InstaPay order or a manual sales invoice into that COD0 PDC order. Its verified-transfer recorder is preorder-only; normal cash requires COD enablement and genuine post-delivery collections. Do not manufacture a preorder or mark delivery/receipt early. The shortest existing path from today's empty state is one genuine live card order, then PDC. No added code/schema is needed for that path. |
| 6. Exact live approval | After deployment/setup, review one private packet containing the order/unit, exact charge, sender/recipient, both cities, measured kg and L×W×H, goods value, carrier tariff/approved charge, service40/type1, pieces1, COD0 and opening choice. Approve narrow customer/payment access and the signed Paymob POST receiver before one card submission. After verified payment and packing, approve narrow manual PDC activation, one SaveShipmentEx plus its automatic one-AWB ExportPDF, and one status poll. Conditional original-reference recovery must be included or separately approved; no booking retry. The current release approval authorizes none of these later effects. |
| 7. Expected costs | Exact amounts are **unknown until genuine SKU and merchant tariffs are supplied**. Card charge = saved item subtotal − genuine discount + customer delivery + saved card fee (currently0). Merchant Paymob/acquirer fees are separate. PDC merchant freight, High Value/insurance, pickup/size/weight surcharges, taxes and possible return charges depend on the account's actual terms. COD0 means no customer cash collection, not free carriage. No documented API quote or enforceable maximum-charge field exists; approve the tariff contractually before booking. |
| 8. Decisions now | **Release: PASS, awaiting approval. PDC real shipment: BLOCKED** by deployment, genuine received stock, delivery/caches, eligible paid/packed order, details/costs and narrow execution authorization. **Paymob real charge: BLOCKED** by the genuine payable order/setup and approved signed-callback/access activation. Existing local qualification is reused; neither provider has passed this real transaction. PDC webhook may remain disabled; documented polling is sufficient for this first test. |

Fresh read-only operational inspection found one active warehouse, zero suppliers,
zero physical stock/balances, zero delivery companies and zero customer orders.
There are223 priced, published serialized catalog candidates with an active model
and warehouse. These catalog records do not prove physical availability or correct
current prices. Payment attempts and durable PDC dispatches remain zero.

## Codex preparation and execution boundaries

Codex has verified the existing release and administrative prerequisites, traced
the supported payment/order paths, and prepared a private, non-executable details
template. No business facts were filled in. The private directory is
`../pdc-paymob-acceptance-readiness-20261023/`; the new template is
`FIRST-LIVE-TRANSACTION.template.json`. Do not put addresses, card data or secrets
in Git. After owner details are supplied, Codex can bind the exact order snapshot,
configuration revision, provider request budget and activation/closure controls
for review. City-only/cache and access/runtime execution still need concrete,
separately authorized packets; no claim that they have run or are sealed is made.

The existing Dashboard/server provide manual booking/recovery/private label/status
actions with automatic booking off. The SQL persists `ORD-<actual order UUID>`
and its durable dispatch barrier before the provider request. Require exact REF
and AWB association, then request only that AWB's template1 PDF into private VPS
storage. A label failure permits label recovery, never another booking.

Use one item in one physical parcel. The existing payload sends saved weight and
item-based pieces; it has no arbitrary parcel/dimension editor. Record dimensions
for carrier suitability and tariff review. Declared goods value is saved subtotal
minus discount, excluding delivery/payment fees; stop if the actual approved
goods value differs. Do not add overrides to make an unsuitable order fit.

Paymob must confirm an exact HMAC-verified LIVE EGP receipt in its existing ledger
before packing/booking. The approved receiver is POST
`/api/payments/paymob/webhook`; browser return is insufficient. Keep receipts
available for outstanding payments after closing outbound initiation.
Keep automatic PDC booking and its public webhook disabled.

After PDC's documented indexing delay, use one explicit status poll for the exact
AWB/reference; Dashboard refresh has a five-minute throttle. On an uncertain
booking, reconcile the original reference first. Empty, missing or ambiguous
results do not authorize a new reference, another booking or another payment.
Retain uncertainty and stop. No automatic financial, order or inventory change
is authorized from tracking. No refund is included.

No PDC support answer presently blocks the established single normal-shipment
contract. Contact support only if actual access/coverage/tariff is unavailable,
the response fails exact matching, or reference recovery remains uncertain.
Webhook/status automation questions remain separate.

Preserve the roadmap: WordPress customers/orders migration → complete
payment/shipping reconciliation → actual inventory and delivery readiness →
public checkout acceptance. Public checkout/signup/payments and automatic booking
remain held throughout preparation.
