# E148 — first COD order is cancelled; no packing or booking

Read-only check **30 October 2026, 03:36:25 Riyadh**: ORD-20261029-C1403FCFC6 is **cancelled**,
updated29 October 2026, 20:32:48 Riyadh. No packing session, shipment job, dispatch or AWB exists.
Amount paid and verified collections remain0. The saved EGP1540 total is historical;
this is not an eligible shipment or instruction to collect cash. No agent cancellation,
refund, collection, reconciliation or order change was performed.

**Do not follow the historical E147 packing instruction for this cancelled order.**
Do not reopen it, create a synthetic replacement, retry the historical PDC incident
or issue a booking approval. There is1 historical COD row and0 active eligible rows.
For the next eligible genuine COD order: staff verify details, approve/physically pack,
retain validated evidence and measure weight before one separately approved shipment.
Commercial fees and ERP remain LAST, not booking prerequisites.

Private Email delivery is now owner-confirmed. Application sending/capture/workers stay
OFF. Live1e/schema104/CARD+COD preserved; MON at30 October 2026, 03:35:05 Riyadh complete/active,
5 terminal-unverified warnings/0 critical. No provider outcome resolution is inferred.

---

## Historical E147 first-order snapshot — superseded by cancellation

# E147 — first genuine COD order requires staff processing

**19:53:52 Riyadh,29 October2026 — READ-ONLY / NO BOOKING APPROVAL.**

Live1e931d20/schema104, CARD+COD and MON preserved. One normal storefront COD order:
**ORD-20261029-C1403FCFC6**, created19:30:43 Riyadh. Internal pending_payment/pending is correctly
shown as **Placed** for cash, awaiting collection. Amount paid and verified collections
are0; outstanding receivable **EGP1540**. No Paid or collection inference.

| Saved checkout amount | EGP |
| --- | ---: |
| Merchandise | 1440.00 |
| Discount | 0.00 |
| Delivery | 50.00 |
| COD charge | 50.00 |
| Full final unpaid customer cash balance | **1540.00** |

The saved breakdown matches total. Recipient name/contact/address fields are structurally
present, phone is well formed, one cached destination mapping matches. Exact customer/
address/item data stays in the private snapshot. Staff must confirm those actual details.
No live PDC lookup or provider request was made.

Dashboard Orders includes cash without paid-only filtering. Current pending status is
eligible for staff processing/packing; one active Orders authority exists. Actual hosted
staff interaction remains unexercised. No packing session/completed validated video,
shipping job, prior dispatch attempt or AWB exists for this order.

**PDC BOOKING BLOCKED:** staff review/approval, actual physical packing with required
validated private video, measured parcel weight and final saved recipient/cash recheck.
Commercial fees/net settlements/ERP are not blockers. No booking seal, expiry or provider
approval is issued. No stock census or invented warehouse units are required by the
configured untracked-stock policy.

**ONE next action:** authorized staff open Dashboard → Orders, find the reference,
review/approve and actually pack it using the existing Confirm/packing workflow.
Confirm quantity, retain validated packing evidence and measure the finished parcel.
Then prepare a newly scoped approval for ONE shipment using full **EGP1540.00**, subject
to rechecking the live saved balance. Do not use the default carrier weight as actual.

No automatic booking/retry, pickup, cash receipt, reconciliation or Paid update.
SaveShipmentEx creates the shipment only. The unrelated historical uncertain CARD
shipment remains quarantined. No synthetic order or historical dispatch is used.
Normal customer email remains OFF; this order created no email backlog/backfill.
The separately approved private email probe was accepted, with mailbox confirmation pending.

Private evidence: `../customer-email-one-message-20261029/first-cod-order.private.json`,
`first-cod-order-sanitized.json`, `first-cod-booking-preparation.private.json`.
The latter is non-executable, with null weight/seal/approval/expiry.

---

## Historical E140 readiness baseline — superseded by E147

> E141,29October2026: real COD orders still preempt other work;14:36 read-only finds0 COD/0 new orders. Customer-email local preparation may proceed now while waiting, with outbound OFF. [Email next action and approval scope](customer-email-configuration-review.md). Pixel/recovery waits for Paymob answers; commercial settlement/ERP remains LAST. E140 operational evidence below is retained.

# Real COD orders and PDC shipping — E140

29 October 2026. **P0 operational priority / READ-ONLY REVIEW COMPLETE.**
Owner decision: **OD-20261029-COD-OPS-FIRST-01**. This supersedes previous notes
requiring merchant tariffs, deductions or remittance terms before shipment booking.
The owner accepts PDC's commercial fees for now. Those details are **LAST**, under
FIN-PDC-01 / DTR-35. No commercial data is invented or applied.

## Current health and exact booking blocker

Read-only inspection through **14:05:19 Riyadh** verifies production
`9aa61b64c2c5cf9f / schema103`, running app76747 and Caddy26652. The installed
inventory, schema/security and activated runtime match the consumed activation.
CARD and COD are available; delivery50 +COD50, CARD fee0. MON's14:05:05.866 automatic
report is complete: five existing warnings, zero critical; timer active. Existing
payment-integrity/duplicate/ownership counters remain0. Emergency controls remain.

**New COD orders requiring staff action:0. Total normal COD orders:0.**
The Dashboard Orders query includes cash orders without a paid-only filter. Its
permission-protected data currently contains no COD rows. One active staff account
has Orders authority. No staff impersonation, customer account change or new role
grant occurred. Positive hosted staff interaction with a real COD row remains
unexercised; current source and retained native handler tests verify the path.

**PDC first-real-booking approval: BLOCKED only because no eligible real COD order
exists to approve and pack.** Commercial fees/accounting are not booking blockers.
No booking approval seal or expiry is issued for an empty/synthetic candidate.
The existing workflow needs no rebuild, migration, application deployment or runtime
change for an eligible staff-controlled Manual/PDC COD booking.

Private current evidence: `../../cod-real-orders-readiness-20261029/host.json`,
`orders.private.json`, `public-check.json`, final-prefixed readbacks and worktree preservation. No provider
request, production write, order, shipment, pickup, collection or restart occurred.

## Staff workflow using installed schema101/103

1. A genuine customer selects COD through ordinary checkout. The server saves
   merchandise after applicable discounts, delivery50 and COD fee50. The order is
   unpaid / awaiting collection. Do not create a synthetic or direct-SQL order.
2. Authorized staff open **Dashboard → Orders**, review the saved order/address,
   approve it through the existing status/review workflow and complete packing.
   Existing quantity scans and validated private packing video remain required.
   Preserve the configured untracked-stock policy; do not invent warehouse units.
3. Before a shipment approval, verify the actual recipient/destination, saved cash
   balance, item quantity and real parcel weight against the configured payload.
   Current default1kg is configuration, not proof that a parcel weighs1kg. Do not
   add a dimensions requirement or change settings to disguise a mismatch.
4. Prepare a new approval bound to exactly that unbooked order and staff authority,
   its immutable snapshot, original reference, Product40/type1/template1, full COD
   amount, measured parcel and provider/configuration identity. Verify there is no
   prior dispatch/AWB or uncertainty barrier for it. Recheck CARD/MON/emergency state.
5. Only after the owner's separate approval, the authenticated staff Dashboard
   action may make **one SaveShipmentEx**, followed by at most one existing-AWB
   ExportPDF. No queue automation, broad runtime enablement, lookup/sync, historical
   booking retry, pickup request or financial command belongs in that scope.
6. Verify provider success, exact echoed reference and valid returned AWB. Persist
   the AWB with the existing token/dispatch transaction, then validate/store its PDF
   privately. A failed PDF can retry only that existing-AWB label under its own scope.

SQL derives full unpaid cash in integer minor units; the serializer sends decimal
EGP major units. Example:100.35 merchandise +50 delivery +50 COD =`cod:200.35`.
Declared goods value remains separate. Existing verified collections reduce the
outstanding balance only when supported by their authoritative receipt records.
No customer/browser value can override the saved cash amount.

## Booking safety and truthful payment

The existing API requires Orders authority and rechecks authorization. Staff confirm
the booking; concurrent clicks cannot create another dispatch. Order-first locks,
one job/order, stable reference, unique AWB, token/lease/configuration fencing and
the durable dispatch marker precede the non-retrying provider call.

Ambiguous response, timeout or uncertain commit remains quarantined. Do not create
another shipment, reset a job, guess an AWB, change its cash/address or infer no
booking from an HTTP500. The historical uncertain CARD dispatch stays separately
quarantined, attempt1/noAWB/original reference; it is never the new COD candidate.

Booking and AWB do not establish pickup, delivery or collection. Preserve unpaid /
awaiting collection until actual verified collection evidence is recorded. Preserve
customer total, requested COD, actual collected amount and outstanding receivable.
No settlement enhancement is needed to keep these amounts truthful.

## Pickup and basic tracking — next operational priority

The owner confirms **SaveShipmentEx creates a shipment and does not request pickup**.
The installed adapter sends no pickup request and exposes no verified normal-outbound
pickup-request API. After a verified AWB/private label, staff arrange pickup through
their established PDC process. Do not invent an API, pickup ID, daily schedule or
collected-by-courier milestone. Confirm the actual handover before recording it.

Existing dated GetShipmentsStatus and local status history are reusable. They require
the actual saved AWB+reference/account match, bounded response and verified state/
time semantics. Unrecognized states remain unknown. Tracking cannot mark cash Paid.
Customer refresh reads local history only; it does not poll PDC.

The narrow live COD switch currently permits **book/label only**. General tracking,
recovery and webhook/provider cutover remain gated. After the first real AWB, qualify
a separately scoped existing-AWB status action; do not open global outbound access
to obtain tracking. Authenticated webhook/mapping acceptance remains DTR-20, not a
prerequisite for the first shipment. No old inquiry or uncertain recovery is replayed.

## Deferred financial/accounting phase — LAST

FIN-PDC-01 / DTR-35 retain merchant commission calculations, tariff/invoice deductions,
fee/VAT rounding, gross/net remittance, settlement schedules, profitability and
ERP/Daftra accounting integration. Unknown terms remain unknown; their acceptance
tests are preserved and deferred, not deleted or passed.

Basic collection evidence and outstanding receivables remain mandatory now. The
existing full-receipt Treasury command remains unchanged: a short/net payout must
stay unreconciled. Do not infer fees, fabricate net settlement or force a receipt
to balance. This financial limitation does not block taking or shipping an order.

## Owner's current sequence

1. Real COD intake, staff approval/packing and one controlled PDC booking.
2. Pickup handover, basic tracking and truthful fulfillment status.
3. Paymob Pixel and safe payment recovery after the provider response/SDK qualification.
4. Customer transactional emails; preserve local proposed104 and outbound-off state.
5. Google SEO and legacy redirects.
6. Remaining customer/admin work and visual acceptance.
7. Historical migration and storage work.
8. LAST: detailed PDC financial settlement and ERP/Daftra integration.

**ONE next action:** staff process the first genuine COD order through approval and
packing. Then prepare its one-shipment approval. Do not reuse any activation seal.
