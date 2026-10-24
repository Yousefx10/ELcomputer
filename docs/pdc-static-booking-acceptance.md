# PDC static production booking acceptance — 24 October 2026

The owner executed the sealed one-time corrected Node operator on the VPS.
The retained protected receipt independently confirms:

| Evidence | Result |
| --- | --- |
| Request | Production V6 `POST SaveShipmentEx` |
| User-Agent | `Storefront-PDC/1.0`; no cookies |
| Request time | `2026-10-24T09:14:33.372Z` /12:14:33.372 Riyadh |
| Completion | `2026-10-24T09:14:34.481Z` |
| HTTP / result |200 / `STATIC_BOOKING_CONFIRMED` |
| AWB | `EDC17983113EG` |
| Booking ID |1071825 |
| Reference | `ORD-24046ef1-b9a6-46bf-93ec-58df0c85503e` |
| Response |365 JSON bytes; protected SHA256 `2e80fa110ad9795080bc3e06e5c8b0f25320f9276bde14b9ee482892d6a74077` |
| Trace ID | Not supplied in the successful response receipt |
| Requests / retries |1 /0 |
| Database writes / customer attachment |0 /none |

The exact approved static names, addresses and phones were used. Product40,
City10 at both ends,1kg, one piece, type1, COD0, declaredValue1 and opening=false
were preserved. No dimensions, explicit pickup operation or scheduling flag.
No new SaveShipmentEx request is authorized by this receipt. The consumed `book`
operator must never be repeated.

This confirms static production creation through the corrected VPS client.
It does not establish dynamic customer-field or normal Dashboard acceptance.
PDC Dashboard visibility and manual cancellation of this new AWB remain owner
checks. The earlier engineer AWB `EDC19781157EG` was cancelled manually according
to the owner. Historic failed requests, original references and customer dispatch
barriers stay unchanged; this diagnostic is never a customer fulfillment.

## Prepared existing-AWB operations

These separate one-use commands are prepared for the owner's private VPS terminal.
Neither was executed during release preparation. Both require the existing
confirmed receipt and cannot create a shipment or attach it to an order.

```sh
sudo /usr/bin/python3 -I -B /root/pdc-corrected-static-booking-20261024/run.py pdf
```

This makes one `ExportPDF` request using the existing template1. A confirmed PDF
is saved privately under
`/srv/storefront/shared/private/pdc-corrected-static-24046ef1b9a646bf93ec58df0c85503e/diagnostic-label.pdf`.
No public URL or customer document record is created.

```sh
sudo /usr/bin/python3 -I -B /root/pdc-corrected-static-booking-20261024/run.py status
```

This makes one `GetShipmentsStatus` request for this AWB and reference, after the
120-second minimum. Dates are `2026-10-23T00:00:00+03:00` through
`2026-10-25T00:00:00+03:00`. The operator stops if these dates no longer cover
execution. Empty, mismatched or uncertain results require inspection, never a
booking retry. A consumed PDF/status command must not be repeated.

The no-provider-call report command is:

```sh
sudo /usr/bin/python3 -I -B /root/pdc-corrected-static-booking-20261024/run.py report
```

Protected evidence: `../pdc-corrected-static-booking-20261024/` and
`../pdc-client-fix-release-20261024/acceptance.json`. Credentials and customer
details are excluded from this receipt.
