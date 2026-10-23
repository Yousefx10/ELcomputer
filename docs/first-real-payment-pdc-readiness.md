Current scope: [one nonphysical live PDC API test; exact approval pending](pdc-one-live-test-authorization.md). Packing is complete. The owner now accepts test data and unquoted test fees; physical-delivery conditions below remain historical and do not block this API-only test.

# First real payment verified; PDC booking preparation — 2026-10-23

**PAYMOB VERIFIED. PDC BOOKING BLOCKED.**
Production remains release `0ea60833a5071f27`, schema91. No application build,
deployment, credential change or provider request was performed in this review.
The owner completed normal storefront checkout and bank3DS personally.

## Payment and closure

Order `ORD-20261023-8C0C964CBD` is durably paid/processing. The live Paymob attempt
and provider transaction `559384846` succeeded for200 minor units, EGP2.
Item1 + customer delivery1 + card0 =2; amount_paid=2. One successful transaction
was found for the selected account/order; no duplicate success was found.
Paid time is2026-10-23 22:07:16.491 Asia/Riyadh.

The deployed callback receiver requires SHA512HMAC before transaction processing.
Its reconciliation checks live mode, integration, provider order, amount and
currency, and atomically updates the paid ledger/order. Anonymous/authenticated
roles cannot execute that reconciliation. This is signed-callback-path and durable
ledger evidence. The raw callback/signature was not retained for an independent
offline replay, and no new Paymob portal/API inquiry was made. Bank3DS remains
owner-reported; bank settlement is not asserted.

The previously approved EGP2 closure ran once at22:22:33.253 Riyadh. Its approval
is consumed for opening and closure. Never rerun either mutation. The grant is
empty, the qualified closed Caddy policy is installed, and public purchasing and
global payment/shipping outbound gates remain false. Exact signed Paymob POST
ingress, keys and owned receipt/status reads remain available for late events.
The pinned production artifact is unchanged; both services are active.

## Shipment state and retained evidence

The paid order selects the active PDC company. No shipping job, durable dispatch,
AWB, packing session or packing video exists. One allocated sold unit exists;
the owner must pack that actual unit. No synthetic order or parcel was created.

| Evidence | Established | Still unconfirmed |
| --- | --- | --- |
| Current accepted product cache |40 High Value(elc), with36 General also available. | Suitability and price for this actual parcel. |
| Current accepted411-city cache | Ramses10 exists; the unique current alias agrees. | Street-level coverage for the saved physical Al Azbakeya address. Native zone46 is not the six-zone tariff's Zone1. |
| Archived WordPress current database |131 AWBs/references;112 orders have matching created and polled events. Saved live integration selects40 and pickup10 for the same company. | No destination10 booking or merchant charge/insurance metadata was found in selected records. Original raw provider responses were not retained. |
| Archived older database |129 overlapping AWBs, with110 matching created-and-polled orders. | This is an overlapping snapshot, not129 additional shipments. Historical operation does not prove current rates. |
| Historical WooCommerce methods | Four PDC-labelled methods contain customer prices79/99 and disabled option flags. | They are customer selling prices, not PDC invoices or a Cairo merchant quotation. |
| Supplied six-zone tariff | Zone1 base60, VAT14%, up to2kg; conditional arithmetic68.40. | Product40 applicability, effective date, surcharges, fractional rounding and fee bases remain unverified. |

The archived envelopes were authenticated before in-memory inspection. WordPress,
PHP, SQL dumps and old automation were never executed. No archived credential,
raw response, customer address or full phone entered Git.

The reviewed courier PDF and current captured lookup schemas contain no documented
quote or street-coverage endpoint. Existing products/cities evidence was reused;
neither lookup was repeated. PDC's [published FAQ](https://www.pdc-eg.com/faq/)
describes quotes based on size, weight, urgency and distance. It does not establish
this merchant's Product40 charge or this street's service area. No authenticated
PDC Dashboard session is available to Codex here; no portal finding is fabricated.
An existing account tariff/invoice/coverage view can supply the missing evidence.
Only if those records do not answer it is carrier confirmation necessary.

## Saved pickup and actual parcel

Pickup contact is Elcomputer, city Ramses10, phone ending1542. The phone passes
validation and matches the archive. The saved business address is present and
matches the historical pickup after HTML/Unicode/Arabic spelling normalization,
including unchanged numeric components. It differs from the general WooCommerce
store address; no address was substituted. The owner needs to confirm that this
is still the actual pickup location, without re-entering it.

The current builder would send one piece, default weight1kg, declaredValueEGP1,
COD0, Product40, normal shipment type1, no package opening, allMustValid=true and
label template1. Weight and value remain unconfirmed physical facts. The order's
EGP1 selling price is not proof of truthful carrier-declared value.

Complete privately: packed weight inkg, length/width/height incm, truthful declared
goods value, real allocated item confirmation and saved pickup confirmation.
The normal form exposes default weight, not parcel dimensions or a per-order
declared-value override. If weight differs, prepare only the confirmed setting
correction before activation. If truthful value differs from1, stop and prepare
the smallest correction; do not rewrite paid financial totals or invent value.

Private packing-video and shipping-document roots exist, are service-owned0700
directories and are not symlinks. The storage check created no files or directories.
The exact default booking body was built offline using source identical to the
deployed release source, then encrypted locally. It is unapproved and unsent.

## Normal Dashboard path and next authorization

The owner can now open **Dashboard → Orders → Confirm Orders**, find this exact
order, start the work session/camera, scan the actual allocated unit, finish the
private packing video and complete as **Ready to Deliver**. Do not click Book yet.
Processing is intentionally ineligible for booking; no Dashboard defect is proved.

Before booking, finish packing and confirm the parcel/pickup facts, authoritative
Ramses10 coverage and Product40 merchant charges including VAT/surcharges and
insurance treatment. Customer delivery1 and stored unverified carrier cost5 do
not establish merchant cost.68.40 remains a conditional estimate. Cancellation
charges are unknown. The documented API has no enforceable price-cap parameter.

The private `../first-real-pdc-shipment-20261023/OWNER-BOOKING-REVIEW.md` contains
the exact missing fields and coordinated approval template. Its readiness plan is
not sealed or approved while these facts remain unknown. No new activation
approval is requested for an incomplete transaction.

The final approval must bind this one paid/packed order, saved recipient/pickup,
confirmed route, measured weight/value, approved carrier terms, and the qualified
exact-order access/closure configuration. The owner then uses normal Dashboard
**Book** personally. Existing RBAC/RLS stays intact. Restrict Caddy to this order's
booking/status/private-label routes and deny other provider actions/workers.
Enable the required shipping runtime gate only for a maximum one-hour window;
keep public checkout, COD, auto-booking and reverse shipments closed.

Authorize exactly one SaveShipmentEx and one shipment. SQL must persist
`ORD-<existing order UUID>` and its dispatch barrier before that provider request.
Verify the returned REF/AWB exactly, save it against this paid order, retrieve
one matching-AWB ExportPDF privately, then perform one status lookup after provider
indexing and the Dashboard throttle. The owner verifies visibility in PDC Dashboard.
On uncertainty, allow only the separately included original-reference lookup,
without another booking; stop if the result is absent or ambiguous. Failed PDF
retrieval permits only separately approved label recovery. Close provider access
after the approved sequence, stop or expiry. No automatic cancellation/refund/reverse.

Broader gateway/carrier/pricing/loyalty/refund/tracking/migration releases remain
held. Both historical handoffs and all consumed seals/artifacts remain preserved.
Read-only/offline inspection and documentation required no repeated tests/build.
No Git push occurred.
