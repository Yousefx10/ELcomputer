# PDC status and label references — offline, no activation

2026-10-26. Original workbooks are unchanged; file hashes are in
[pdc-location-reference-review.md](pdc-location-reference-review.md).
No provider call, webhook, label generation, shipment or incident action occurred.

Status.xlsx has33 records and32 distinct IDs. ID97 appears twice with materially
different descriptions. These are provider reference labels, not proof of our
normalized order state, payment authority, webhook payload contract or event order.
Clear transit/delivery labels can inform a future reviewed adapter; exception,
partial delivery, return and repeated IDs require explicit rules and acceptance.
Never automatically mark an order delivered/refunded/cancelled from this file.
Keep source wording/typos and both97 descriptions; do not overwrite deployed maps.

| Provider ID | Online notes | Description | Disposition |
|---|---|---|---|
| 2 | Transfer To Branch | In Transit-Departed | Reference only; no runtime mapping applied |
| 3 | Received At Branch | In Transit-Arrived | Reference only; no runtime mapping applied |
| 4 | Out For Delivery | Out For Delivery | Reference only; no runtime mapping applied |
| 5 | shipment Delivered | Shipment Delivered | Reference only; no runtime mapping applied |
| 15 | Not Delivered | Not Delivered | Reference only; no runtime mapping applied |
| 7 | To Be Returned | To Be Returned | Reference only; no runtime mapping applied |
| 8 | Returned | Returned To Shipper | Reference only; no runtime mapping applied |
| 9 | Lost | Shipment Lost | Reference only; no runtime mapping applied |
| 10 | Damaged | Package issue | Reference only; no runtime mapping applied |
| 11 | Reoperate | Re-Operate | Reference only; no runtime mapping applied |
| 12 | Collected | Picked Up | Reference only; no runtime mapping applied |
| 13 | New Pickup | New Pickup | Reference only; no runtime mapping applied |
| 14 | Postponed | Postponed | Reference only; no runtime mapping applied |
| 19 | Reschedule | Reschedule | Reference only; no runtime mapping applied |
| 24 | Partial Delivery | Partial Delivery | Reference only; no runtime mapping applied |
| 97 | Received At Hub | Received From Courier after attempt | AMBIGUOUS duplicate97; no automatic transition |
| 82 | In Transit | In Transit | Reference only; no runtime mapping applied |
| 83 | Recieved | on the way to Destination Hub | Reference only; no runtime mapping applied |
| 84 | Received | Recived At Hub | Reference only; no runtime mapping applied |
| 85 | In Transit | Received At Destination Hub | Reference only; no runtime mapping applied |
| 77 | Under Return Process | In Transit - Undelivered | Reference only; no runtime mapping applied |
| 87 | In Transit - Undelivered | In Transit - Undelivered | Reference only; no runtime mapping applied |
| 88 | In Transit | In Transit to Destination Hub | Reference only; no runtime mapping applied |
| 89 | In Transit - Undelivered | In Transit - Undelivered | Reference only; no runtime mapping applied |
| 90 | In Transit - Undelivered | In Transit - Undelivered | Reference only; no runtime mapping applied |
| 91 | Wrong Sort | Wrong Sort | Reference only; no runtime mapping applied |
| 92 | Unclear Address | Unclear Address | Reference only; no runtime mapping applied |
| 93 | 3PL International Shipment | 3PL International Shipment | Reference only; no runtime mapping applied |
| 94 | Hold At Warehouse | Hold At Warehouse | Reference only; no runtime mapping applied |
| 95 | On Hold | Packaging and extra weights | Reference only; no runtime mapping applied |
| 96 | Hold for Update | Hold for Update | Reference only; no runtime mapping applied |
| 97 | Received At Hub | Recived At Hub | AMBIGUOUS duplicate97; no automatic transition |
| 98 | Recived At Hub | Recived At Hub | Reference only; no runtime mapping applied |

Templates IDS V3.xlsx describes four print-template IDs:

| ID | Purpose stated in file | Boundary |
|---|---|---|
|1|10×15 label|Units are not stated; sample/account/template binding unaccepted|
|5|One AWB on each A4 page|Documented print layout only|
|6|Two AWBs on each A4 page|Documented print layout only|
|3|Reverse label|Requires a reverse shipment type; returns remain paused|

Template names contain a provider account prefix; keep that deployment binding
out of reusable application logic. A future configuration may expose reviewed
formats and store the actual ID privately per carrier account. Do not change the
current template, download/generate a PDF or use the uncertain shipment as a test.

Both integrations are DEFERRED under SHIP-06/07/10/11. Complete later with a
legitimate authorized paid/packed customer order, provider-confirmed97 semantics,
matching account/template capabilities, private-download authorization and exact
separate provider/payment/shipment approval. They do not gate owner-managed Beta.
