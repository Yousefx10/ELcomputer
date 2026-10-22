# Controlled PDC and Paymob acceptance — 2026-10-23

**Both live executions are BLOCKED pending concrete setup and owner approval.**
The first shipment contract is established by the original PHP and PDC PDFs.
Webhook automation is not a prerequisite for one manually polled shipment.
The shortest path is one legitimate paid order used for both tests.
The [first-shipment owner checklist](pdc-first-live-shipment-checklist.md) records
the fresh release preflight, exact Dashboard setup and manual-payment boundary.
The correction is now [deployed](pdc-shipment-contract-deployment-receipt.md) as
`03aa6e565f5b5ad3`, schema90 unchanged. The release plan is consumed; all other
activation and transaction approvals remain outstanding.

## Current evidence and decision

Before deployment, read-only inspection on2026-10-23 Asia/Riyadh confirmed release
`881aadcfd4942ef8`, schema90, Premium selected, Product40/type1/template1,
allMustValid true,382 city aliases and empty lookup caches. Pickup fields and
independent encrypted secrets are present. The saved1kg default is configuration,
not evidence of the actual parcel's weight.

There are **zero received/available serialized units, zero positive warehouse
inventory rows, zero delivery companies and zero orders**. Payment attempts,
transactions, shipping jobs/events and dispatches are zero. These concrete
prerequisites block the existing safe flows, independently of PDC support.

Paymob LIVE key shapes, HMAC presence, matching live modes and positive card
integration ID pass. Saved values equal the running process. The configured ID
matches the historical LIVE EGP card integration. Prior owner account confirmation
is retained; current merchant entitlement, credentials and real3DS operation are
not independently proven without provider/merchant acceptance.

All runtime charging/shipping/purchasing gates remain false. Caddy/runtime/unit
hashes match. Saved Cash/Card/InstaPay presentation flags are true; Card fee is0.
These existing values were preserved. They do not enable charging or public access.

| Decision | Result / exact boundary |
| --- | --- |
| PDC ready for one real shipment? | **BLOCKED now.** Contract correction is deployed; complete stock, delivery/cache, paid-order, packing and owner parcel/charge approval. |
| Paymob ready for one real charge? | **BLOCKED now.** No payment code defect found in focused checks. Real stock, a configured delivery option, valid verified card order, controlled customer access and the exact signed callback receiver must be ready before charge approval. |
| Confirmed corrections | Normal PDC payload: fromContactPerson, contents, allowToOpenShipment and separate exact net-merchandise declaredValue. No speculative status/envelope aliases. |
| Can PDC use polling first? | **YES.** POST GetShipmentsStatus is explicitly documented and historically exercised. Keep the PDC webhook403; exact REF/AWB matching and uncertainty guards remain. |
| Code/schema required? | Small application-only PDC correction is deployed. **No further code/schema change, Paymob rewrite or shipping redesign** is needed for the existing card-to-PDC path. Current Dashboard/server support the single-item, single-parcel paid-order test. |
| PDC support needed before that test? | No unresolved optional-field/template/webhook contract question currently requires waiting. Ask only if actual city/account access fails, response matching/recovery is ambiguous, or the owner lacks current carrier terms/coverage. Automation questions remain separate. |
| Owner inputs/approvals | Genuine SKU/stock, confirmed existing customer, pickup/recipient and city, measured parcel, declared goods value, exact EGP charge, delivery cost/maximum carrier charge, cardholder consent, narrow access/activation and exact one-charge/one-booking approval. Keep private details outside Git/chat. |
| Public checkout after test success | Still held pending business stock/rates/coverage, payment and refund/reconciliation operations, guarded customer/packing/label acceptance, monitoring and access controls. WordPress identity/login/profile/address/history migration remains required before unrestricted signup. Automation and public opening need separate authorization. |

## Shortest safe sequence

### 1. Finish the one-time setup without transactions

1. The [application-only contract release](pdc-shipment-contract-deployment-receipt.md)
   is complete, preserving all gates. Do not rerun this consumed deployment or
   the accepted GetProducts diagnostic. The [original PHP/PDF comparison](pdc-wordpress-contract-review.md)
   remains the contract evidence.
2. Choose one genuine, correctly priced SKU and physically receive one real unit
   through Procurement into an active warehouse. Do not edit catalog quantities,
   fabricate inventory, use a synthetic production product or create a fake sale.
3. Configure one existing Shipping Companies option for PDC with actual supported
   governorate/city and explicit customer charge, including explicit zero if agreed.
   The carrier's bill is separate from that customer price. Product40 remains
   High Value; normal shipment type remains1. Confirm pickup details privately.
4. Separately authorize **one GetCities GET** and a bounded, atomic cache update.
   Use the accepted GetProducts result for the product cache; no second GetProducts
   is needed. Bind cache preparation to the same unchanged account/token/mode and
   saved-settings revision. Verify both actual city IDs against the returned list
   and one unambiguous existing mapping. Historical382 rows do not establish today's
   service coverage. Dashboard Sync would repeat GetProducts; do not use it here.
   The city-only diagnostic/cache procedure must be concretely sealed before approval.
5. For the shared paid-order path, separately approve PDC settings enablement with
   auto-label/reverse/COD off and shipping runtime still off. Checkout's existing
   SQL requires configured PDC cities/products even before payment. Verify no queued
   work can become eligible. Public PDC webhook remains held by Caddy.
6. Approve narrow owner/customer acceptance access, payment initiation gates and
   the exact Paymob POST callback receiver. Keep public checkout/signup closed,
   all other providers/methods held, PDC worker and automatic booking disabled.
   Review exact deployment-specific configuration changes and rollback first.
   Do not broadly expose `/api/`, replace origins or weaken authentication.

These are future owner actions, not performed by this readiness task. The city/cache
and activation packets require their own exact review; the code release seal does
not authorize them. Existing settings/edit permissions and revision/conflict guards
remain required. No private account identifiers belong in reusable application code.

### 2. Choose an eligible paid order; otherwise one real card charge

PDC itself does not require Paymob. `private.pdc_order_eligibility` accepts a
fully paid noncash/noncard customer order with the same stock, carrier, city and
packing safeguards, producing COD0. No such order exists in production today.
This SQL branch is not a Dashboard manual-order or payment-recording facility.

The current `POST /api/admin-orders/:id/payments` and its “Record verified
payment” form call the preorder-only payment recorder. The normal checkout
accepts a delivery-company selection only for cash/card; its insert guard also
restricts that selection to nonpreorder cash/card. Manual Sales creates a separate
`commerce_sales_orders` invoice, not the customer order used by PDC. Normal cash
requires PDC COD enablement and genuine collections after delivery/completion.
It is not a prepaid COD0 shortcut with COD disabled. Never fake a preorder,
delivery, receipt, paid flag, card attempt or imported active order to bypass these
contracts. Adding a supported manual prepaid normal-order path would be a separate
feature, not necessary for the currently qualified card-to-PDC acceptance path.

Use the existing confirmed customer and ordinary quote/checkout transaction.
Record the real SKU/variant, quantity1, destination, courier, item/discount,
customer shipping charge, card fee and final **EGP** total. The owner explicitly
approves that exact small payable amount and possible merchant/acquirer fees.
Do not invent a nominal amount or override the saved payable snapshot.

The normal checkout reserves/allocates the actual unit once. Its card attestation,
quote/cart command receipt and owned order must be valid; old/unattested orders
cannot be made payable by manually flipping flags. The existing order UUID and
expected `ORD-<UUID>` shipping reference are recorded privately for the later test.

Open one owned payment session and enter the card personally in Paymob Pixel/3DS.
No card details, SDK payload, credentials, cookies or screenshots containing them
are captured. Accept only the HMAC-verified server transaction with exact persisted
provider-order, integration, mode, amount and currency. The browser return alone
cannot prove payment. Expect one attempt/transaction and one paid transition,
without extra stock allocation or shipping job.

If initiation times out, returns5xx, cannot persist its result or has an uncertain
response: **stop**. Never create another intention/order or charge to investigate.
Reconcile the same private attempt/provider order in the merchant Dashboard.
Unexpired persisted sessions can be reused only through existing guards; uncertain
or expired attempts do not create replacements automatically. A browser cancel
only navigates to status; it does not authorize a refund or prove no charge.
Reopening a session does not authorize a second card submission.

Verify a successful charge in the merchant account and the private application
ledger. Gateway receipt is not a bank payout or treasury cash receipt. Signed
success remains authoritative even after outbound initiation is closed. Keep the
approved callback available for outstanding receipts; do not disable it mid-flight.

Refund, void, authorization-only/capture and child transactions are deliberately
not automated. If reversal is desired, obtain separate exact owner approval and
use the merchant's supported reconciliation/refund process. Do not mark a refund
locally without its verified provider evidence. Existing staff cancellation and
late-paid review guards remain. No automatic stock release is added.

### 3. The same order: one PDC booking, PDF and manual polling

1. Confirm paid-card receipt and zero collectible COD. Scan/complete packing and
   the existing private packing video. Use one item in one physical parcel; weigh
   it and confirm the saved weight. The generated declaredValue is saved subtotal
   minus discount, excluding delivery/card fees. The owner must confirm that this
   equals the actual declared goods value. If it does not, stop for a separate
   parcel override design; never silently substitute COD or total payable.
2. Produce a private execution packet containing exact order UUID, unique
   `ORD-<UUID>` reference, sender/recipient, both city IDs, Product40, type1, weight,
   pieces1, contents, declaredValue, COD0, opening preference and allMustValid true.
   Include merchant-pays-carrier terms and an owner-approved maximum charge.
   COD0 does **not** mean free shipping. Approve this exact booking/PDF/poll scope
   and narrow manual shipping runtime activation. Keep automatic booking off.
   The PDF documents no carrier quote or charge-cap field; confirm costs from
   the existing merchant tariff before approval. Do not promise an API-enforced cap.
3. Use the existing authorized Dashboard booking action once. Its SQL persists
   the unique reference and durable dispatch barrier before SaveShipmentEx.
   Send one shipment, allMustValid true, hasAWBs false, no supplied AWB and no
   blanket overrides. Freeze concurrent order/config edits for the attempt.
4. Require batch and row success, exactly matching ref and one valid AWB.
   Persist that AWB before ExportPDF. The existing flow then requests template1
   with only that AWB and writes a private VPS PDF with bounded signature/hash/size
   validation. A later authorized download/print reads that file. PDF failure
   leaves label recovery; it never repeats SaveShipmentEx.
5. After the documented1–2 minute indexing delay, explicitly poll only this AWB
   and original reference. Existing Dashboard Refresh throttles polling to five
   minutes. Verify exact AWB/Ref plus documented Status/Reason. Missing optional
   StatusID/date stays absent; unknown status stays neutral. The shipping ledger
   may record the observation, but order/payment/inventory must remain unchanged.
   Keep related SMS/notification automation disabled.
6. On lost acknowledgement, timeout,5xx, mismatched/ambiguous success or persistence
   failure, stop with the original reference retained. Reconcile by that reference
   before anything further. Empty results, including during indexing delay, never
   establish absence. No new reference, replacement order, blind retry or forced
   rebooking is allowed. An unresolved match may genuinely require PDC assistance.

The current Dashboard can book/recover/download/refresh with automation off.
It does not expose arbitrary parcel overrides. This deliberately constrained first
test needs no new UI or schema. Broader multi-item parcel handling remains separate.

## Paymob implementation and validation

Current code uses Token Secret Key authorization, modern Intention/Pixel,
fixed-decimal integer cents, the saved EGP order total and matching LIVE card mode.
The current [official Intention contract](https://developers.paymob.com/paymob-docs/intention-apis/create-intention)
confirms account/mode matching, minor-unit amounts and per-intention callback URLs.
The [credential guide](https://developers.paymob.com/paymob-docs/need-help/setup-guides/getting-integration-credentials)
separates mode-specific keys and integration IDs. No legacy API key is substituted.

The exact20-field SHA-512 [HMAC order](https://developers.paymob.com/paymob-docs/developers/webhook-callbacks-and-hmac/hmac/hmac-transaction-callback)
matches the implementation. Signed provider order ID binds the attempt; unsigned
extras/return fields do not. Locks, unique attempts/provider transactions, terminal
success protection, failed-then-success reconciliation, test isolation and late
cancelled-order review remain. Amount/currency/context mismatches fail closed.
There is no code path from a paid callback to enabled automatic PDC booking while
its existing settings/runtime gates are false.

Focused offline validation passes68 checks without skips/cancellations, including
native concurrent claims/replays, trusted card checkout, interrupted booking/REF
recovery, private PDFs and populated migration preservation. Three new contract
tests validate canonical PHP/PDF fields, exact declared goods value and documented
success/rejection. Typecheck passes. Separate release fault tests and exact-artifact
qualification are recorded in the release receipt. Provider calls and production
writes remain zero. Completed PDP and GetProducts testing was not repeated.

## Preserved roadmap

After controlled acceptance, retain merchant settlement/refund/reconciliation
operations, actual stock and delivery coverage/rates, secure callback operations,
monitoring and hosted customer/staff acceptance. Before unrestricted signup,
complete the [WordPress identity/login/profile/address/history migration](wordpress-customer-migration.md)
while preserving Auth UUIDs, preventing duplicates and keeping imported history
inert. Public purchase, automatic shipping/reverse/COD and other payment methods
still require their own owner decision.

Next owner action: select the genuine SKU/unit, supplier receipt, destination and
exact test costs privately, then authorize actual business setup as needed.
No live test is authorized yet.
