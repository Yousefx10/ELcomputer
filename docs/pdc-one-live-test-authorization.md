# One live PDC API test — exact approval pending

The owner changed this acceptance to a nonphysical API test. No parcel will be
handed over; the owner will cancel the shipment and linked pickup in PDC Dashboard.
They attest their account permits test creation/cancellation and accept applicable
unquoted fees. Actual delivery coverage and a quoted freight charge are no longer
prerequisites for this API-only test, and are not claimed as verified.

Order `ORD-20261023-8C0C964CBD` remains paid EGP2. Dashboard packing completed
at22:51:31.314 Riyadh, with a validated private VPS video. Status is Ready to
Deliver. Fresh read-only checks found no job, dispatch or AWB. Do not repeat the
Paymob investigation, customer checkout, city/product lookups or deployments.

## Exact request and limits

| Field | Prepared test value |
| --- | --- |
| Account/product | Existing production PDC account;40 High Value(elc) |
| Pickup/destination | Existing saved data; Ramses10 for both city IDs |
| Parcel | One piece, normal shipment type1 |
| Weight/declared value |1kg / EGP1, explicitly nonphysical test data |
| Dimensions |1×1×1cm in the test record; unsupported by the current payload, not sent |
| COD/opening |0 / false |
| Reference | `ORD-8b59b9e0-df2a-4269-a61d-4b3fe244e871` |
| Label | Template1, uniquely matched persisted AWB only |

No known documented required field is missing. No authoritative Product40-specific
testing amount/range is available; numeric acceptance remains subject to the one
provider request. On rejection or uncertainty, stop without changing values or
rebooking. There is no claim that these values represent a real packed parcel.
The live request is not a sandbox request. Merchant costs remain unquoted;
neither68.40 nor stored5 is a confirmed carrier price. Tariffs remain inactive.

## Execution boundary

Private packet: `../first-live-pdc-test-20261023/AUTHORIZATION-PACKET.md`.
Plan and protected operator inputs are sealed:

```text
5a03be551efea46477528467db6bd954b3e353617f28d93c641819427e43e4fb
```

The prepared one-run operator reuses the exact deployed booking-service source
and its staff permission, paid-order, packing, allocation and SQL eligibility
contracts. It invokes the existing workflow against this paid order, using the
active staff identity that packed it. No unrelated order or synthetic paid state.
This tests the existing backend booking workflow, not a new Dashboard browser click.

Only that private process receives shipping access. Caddy, runtime environment
files, provider credentials, public purchasing, global shipping switches, Paymob
and application artifacts remain unchanged. There is no public activation window.
The process exits after its operation. Tracking/recovery is limited to15minutes
after the booking attempt begins, with no automatic request retries.

The approved provider budget must be exactly:

1. One SaveShipmentEx with one shipment. Persist the original reference and SQL
   dispatch barrier first. Consume an exclusive fsynced intent before network I/O.
2. One ExportPDF for the uniquely matched, durably saved AWB. Validate/store the
   actual PDF privately on VPS with its hash/size and existing authenticated access.
3. One GetShipmentsStatus after at least120seconds. If the booking is uncertain,
   use this same budget by the original reference instead of a normal AWB poll.
   A unique match may complete the existing record and its first PDF retrieval.
   Missing/ambiguous results stop; they never authorize another booking.

No GetCities/GetProducts, extra pickup, cancellation, reverse, refund or repeated
label request. Booking itself may create a pickup queue entry. The owner cancels
the actual shipment and any linked pickup manually; Codex never cancels it.
Encrypted raw provider evidence is retained privately for offline inspection.
Local and remote attempt intents prevent blindly rerunning a lost SSH/HTTP request.

After provider success, report exact AWB/reference, durable existing-order record,
private PDF evidence and tracking result. The owner searches that AWB/reference in
their authenticated PDC Dashboard, confirms visibility, and cancels there. Codex
has no authenticated PDC portal session and cannot claim that visual check itself.

## Qualification and next action

Seven focused operator guard tests passed. Production read-only inspection also
passed with zero provider requests and zero writes: packing complete, no booking,
independent credentials decrypt, private document root valid, all runtime files and
Caddy unchanged, global provider gates closed. Existing application tests/build
were reused. No application development, deployment or Git push occurred.

Request this exact approval, then run the sealed operator's `book` mode ONCE:

> Approve ONE live PDC API test booking, private label and one status/reconciliation lookup only.
> Seal: 5a03be551efea46477528467db6bd954b3e353617f28d93c641819427e43e4fb

Approval is still pending. Never execute from this document alone. Broader work
remains held, and both historical handoffs and all consumed approvals are preserved.
