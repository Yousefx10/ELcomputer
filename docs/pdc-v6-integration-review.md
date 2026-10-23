# PDC V6 original-document review — 24 October 2026

The normal outbound request matches the supplied required-field contract.
Complete production acceptance remains unproven. No application defect explains
either captured HTTP500, and no runtime correction or deployment was made.

**Owner clarification:** previous WordPress shipments were managed manually.
Historical AWBs, imported tracking records and code snippets do not establish
successful automated API creation. This supersedes earlier contrary inferences,
including the previous HTTP500 investigation's historical-success paragraph.

## Sources and review boundary

All ten matching files were found in the Mac Downloads folder. Each duplicate
pair is byte-identical. The entire two PDFs and every workbook sheet were read
offline; no PHP, spreadsheet formulas, provider call or production access ran.

| Primary source | Contents | SHA256 prefix |
| --- | --- | --- |
| Customer Courier Integration Test V4.pdf / V4-1.pdf | 10 pages; internally titled Test, version2.0, July2026; V6 API | 8f2f5ae3047fb72e |
| Customer Webhook Integration.pdf / Integration-1.pdf | 6 pages; version1.0, March2026 | 9386ff876642717b |
| Address Mapping.xlsx / Mapping(1).xlsx | Sheet1 and Sheet2; each382 location rows | 5d2e313c356857ec |
| Reason.xlsx / Reason(1).xlsx | Sheet1;25 reason labels, no numeric codes | edfae444a71ce182 |
| Final Status 6.xlsx / 6(1).xlsx | Status;33 rows,32 distinct IDs | 2de68b6802d9130e |

Full hashes, data-only extractions, comparisons, test receipts and the protected
support draft are outside Git in `../pdc-v6-full-contract-review-20261024/`.
Original incident and previous-investigation files remain unchanged.

## A. Compliance assessment

The actual normal booking has the documented V6 path, POST method, header names,
JSON envelope, required shipment fields, numeric types and response-matching
fields. The retained incident request matches its sealed digest. Its required
private text is present, phones are eleven digits, and text has no control bytes.
The detailed [contract checklist](pdc-v6-contract-checklist.md) lists every field.

The incident used:

```text
POST https://clientsapi.pdc-eg.com/api/ClientUsers/V6/SaveShipmentEx
AccessToken: [protected]
CompanyID: [protected]
Content-Type: application/json
Accept: application/json
```

The dispatch guard checked the existing credentials, exact target, POST and
redirect refusal before native fetch. Header values were not independently
retained as a wire transcript. The supplied guide documents the **test** host
`clientsapi-test.pdc-eg.com`, including its base URL on p9. It does not itself
certify the production hostname or this account's current booking entitlement.
Retained production lookup success establishes lookup acceptance, not booking
permission, insurance limits or a successful automated shipment.

The response parser accepts the p5 success schema only with one exact reference,
one valid AWB and explicit batch/row success. Booking uncertainty retains the
durable dispatch barrier; it does not resubmit. Label export matches pp5–6:
POST ExportPDF, integer templateID1, an awBs array and binary application/pdf.
The active path bounds and validates PDF bytes, stores them privately, records
size/SHA256, and enforces staff authorization on downloads.

Webhook parsing matches the supplied fields, permits an empty CustomerStatusName,
checks the independent shared secret and JSON before processing, uses REF plus
saved AWB, and deduplicates AWB+StatusID. Its bounded handler returns after
transactional persistence. Public ingress remains held; registration and live
webhook acceptance are separate, uncompleted work.

## B. Proven mismatches and exact sources

**No proven contract violation was found in the submitted normal booking.**
These differences and source inconsistencies are established, but are not a
proven cause or sufficient basis for an application patch:

| Finding | Exact source | Disposition |
| --- | --- | --- |
| Production request versus a test-host guide | API pp4,6–9, especially p9 §10.1 | Confirm production URL/account/environment with PDC; do not switch hosts or credentials experimentally. |
| Recovery omits fromDate/toDate present in the example | API pp6–7 §§6.1–6.2; request has awBs='' and the exact reFs string | Guide has no requiredness column for these filters. Confirm requirement and date semantics; do not label omission a proven defect. |
| Webhook illustration uses1 New,2 Pickup Requested,3 Picked Up; its sample uses5 Shipped | Webhook pp4–5 §§3.2,5; Final Status6 Status!A2:C3 and A5:C5 | Spreadsheet says2 Transfer To Branch,3 Received At Branch,5 Shipment Delivered. Confirm current account mapping before webhook activation. |
| Status97 appears twice with different descriptions | Final Status6 Status!A17:C17 and A33:C33 | Existing normalization remains unknown; do not invent precedence. |
| Address sheets differ in labels/groupings | Address Mapping Sheet2!A27:D27 and Sheet1!A22:D22 are one example: ID21's English label differs | Source mappings match Sheet1 after whitespace normalization. Do not blindly merge both sheets. |
| Historical automated-success interpretation was unsupported | Owner clarification in this review request | Corrected by this notice and both current handoffs; original historical material is retained. |

The provider error body differs from the p5 success/validation envelope. It is a
generic HTTP500 error, not a documented badResponses field-level rejection.
The application correctly refuses to infer an AWB or non-creation from it.

## C. Unsupported assumptions and missing business confirmation

- **Product40:** the guide gives no service40 range, minimum declared value,
  accepted parcel weight, insurance threshold or merchant entitlement rule.
  Numeric declaredValue1 and weight1 match types; they do not prove acceptance.
- **Nonphysical data:** the consumed test explicitly used simulated values.
  The guide has no documented production test-creation exemption. PDC must
  confirm whether those values were acceptable for this account/product.
- **Shipment type:**1 General,3 Reverse and5 Exchange are documented on p4.
  Product40 is a service ID, not shipmentTypeID40.
- **Reference:** the original40-character ORD-UUID is unique locally and matches
  its durable record. The guide requires global uniqueness, but states no maximum
  length or special prefix. Actual provider storage constraints remain unknown.
- **Pickup:** SaveShipmentEx documents shipment creation. Its p4 example contains
  pickupID, but no text says whether a missing/zero ID schedules a pickup.
  None of the five documented endpoints creates/cancels pickups or cancels
  shipments. Neither automatic pickup creation nor its absence is established.
- **Coverage/fees:** valid city IDs do not establish street coverage, carrier
  charges, cancellation costs or insurance terms. Dashboard customer pricing
  and inactive tariffs do not supply these facts.
- **Parcel count:** current pieces derives from item quantities. That equals one
  for this order; multi-unit orders need an explicit physical-package rule later.
- **Configured data:** no additional required booking field was found missing
  from the reviewed order/settings. Optional subAccountID, branchID, toMobile,
  coordinates, pickupID and dimensions are not established missing requirements.
  The app's independent webhook secret/private storage requirements are local
  safety preconditions, not extra fields transmitted to SaveShipmentEx.

Pickup phone/contact/city and account/product values matched three authenticated
historical configuration sources in the prior read-only inspection. Address
strings differed only under literal comparison and normalized consistently.
This proves configuration agreement only, not automated API success, current
physical pickup authorization or ownership of any historical pickup record.

Address review found all382 seeded IDs match Sheet1, including Ramses10 at
Sheet1!A11:D11 and Sheet2!A49:D49. Eight literal differences are nonbreaking
space normalization. Sheet2 has148 literal row differences,121 after text
normalization, largely governorate grouping/name changes. Neither sheet names
Al Azbakeya or establishes its street coverage under Ramses.

The retained23October API city list has411 rows:381 shared IDs with identical
normalized English names, document ID366 Others absent, and30 additional IDs
383–412. Future work should review those aliases, canonical governorates and
cache freshness explicitly. No mapping/cache/profile/checkout change was made.

Reason.xlsx contains25 English reasons, including spelling variants, with no
numeric IDs. Keep provider reason text bounded; row numbers are not reason codes.
All32 distinct spreadsheet status IDs exist in the schema/review mapping.
The supplied mapping is a draft, not proof that PDC loaded the account's labels.

## D. HTTP500 origin and possible causes

The retained native-fetch receipts show upstream HTTP500 at23:27:50.247 Riyadh
for SaveShipmentEx and23:30:06.166 for original-reference GetShipmentsStatus.
Each response was95-byte JSON with success=false, a generic unspecified-error
message and one protected traceId. Neither identifies an invalid field, account
failure, exception class, AWB or pickup outcome.

The isolated worker called PDC directly. Nuxt HTTP handlers and our Caddy ingress
were not in that path. The recorded status preceded response-row parsing. PDC's
gateway versus endpoint handler cannot be distinguished from retained headers.

| Possible explanation | Evidence strength |
| --- | --- |
| PDC gateway/handler returned the failure | Supported by upstream receipts and guarded direct transport. Underlying cause remains unknown. |
| Shared account/authentication/merchant configuration triggered both errors | Plausible because both endpoints use the same account; no trace diagnosis proves it. HTTP500 does not validate credentials. |
| Missing status date filters triggered lookup failure | Plausible compatibility question; mandatory dates are not established. It cannot explain the earlier booking500. |
| Product40 test value, same-city route or reference constraint triggered booking failure | Possible, with no documented constraint or field-specific error. These shipment fields are not sent in recovery. |
| Nuxt response parser generated the captured500 | Ruled out for these receipts: the upstream status was captured before parsing. |

The136-second wait exceeded the guide's1–2 minute indexing guidance on p9.
The result was not an empty/not-indexed shipment list; it was an upstream error.
The documented allMustValid rejection guarantee does not settle this unknown
write because a structured validation rejection was never established.

## E. Smallest justified correction and offline verification

**No runtime correction is justified by this evidence.** Do not add guessed
required fields, relax matching, copy every p4 zero-valued example property,
change Product40/value/weight, remove the dispatch barrier or change credentials.
The correction made here is documentary: manual historical shipments no longer
serve as evidence of automated booking success.

The new `tests/pdc-v6-documented-contract.test.mjs` tests documented field types,
authentication/environment separation, exact-reference AWB extraction, generic
500 rejection without retry, PDF validation, explicit date-filter serialization,
minimal status responses, partial-pagination refusal and empty webhook labels.
Fixtures establish local behavior only; they do not establish provider acceptance.

Seven focused test files passed88 checks,0 failures,0 skips under Node22.23.1.
This includes disposable PostgreSQL17 booking/recovery/private-label tests,
tracking/RLS/idempotency tests and existing lookup/schema tests. Non-loopback
network was refused and all provider responses were explicit fixtures.
No application build was needed because runtime code is unchanged.

## F. Original shipment recovery

Original reference: `ORD-8b59b9e0-df2a-4269-a61d-4b3fe244e871`.
The latest reviewed read-only snapshot is00:22 Riyadh24October: one uncertain
job/dispatch, attempt_count1, no AWB/PDF, and the paidEGP2 order ready_to_deliver.
This review did not reconnect to production or reverify later live state.

PDC must reconcile that exact reference using both protected trace IDs.
The owner's completed Dashboard absence check does not prove non-creation.
The revised private support request is prepared, not sent; it also asks about
production eligibility, date filters, Product40 limits and linked pickup behavior.

Existing application recovery can match one exact Ref/AWB, persist it against
the original job and export its private label without SaveShipmentEx. It cannot
run now: the one-run operator is consumed and its follow-up window expired.
A provider-confirmed existing AWB permits preparation of a new, separately
authorized recovery-only operation; it does not authorize executing one.

## G. Before another authorized live operation

1. Obtain PDC's authoritative created/not-created answer and both trace causes.
   If created, recover that shipment; do not create another.
2. Confirm current production endpoint/account, Product40 parcel/value rules,
   original-reference/date lookup behavior and pickup/fee consequences.
3. For a physical shipment, confirm truthful packed weight/value/package count,
   physical pickup, street coverage and costs. For an API-only test, obtain
   explicit provider acceptance of its simulated inputs and consequences.
4. Prepare exact, separately approved order-scoped recovery or booking access
   and private-label verification. If non-creation is confirmed, any proposed
   booking must have a reviewed procedure preserving the original-reference
   audit trail and dispatch protection. Never clear it merely to retry.
5. Verify the genuine AWB, private PDF and matching authenticated PDC Dashboard
   record. Tracking observation needs its own bounded scope. Webhook activation
   still requires account mapping, registration and authenticated live acceptance.

**One next action:** the owner sends the revised private reconciliation request
to PDC support through the established private channel. No further provider call,
booking/reference, cancellation, refund, gate change or deployment is authorized.
Paymob and the broader development roadmap remain outside this review.
