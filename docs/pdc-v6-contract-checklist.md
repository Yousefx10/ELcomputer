# PDC V6 contract checklist — 24 October 2026

Source: original Customer Courier Integration Test V4.pdf (internally version2.0,
Test, July2026), SHA256
`8f2f5ae3047fb72ef8aebe495a2f48e1501b27b4c2df951c40cf6638e05fb186`.
This checks the documented field shape, not current provider acceptance.
See the [technical report](pdc-v6-integration-review.md) for the uncertain incident.

## Transport and envelope

| Contract | Source | Actual incident / implementation | Result |
| --- | --- | --- | --- |
| POST SaveShipmentEx | pp2,4 | Exact V6 endpoint; POST | Matches method/path |
| AccessToken header | p2 §§3,4.1 | Existing decrypted token checked by dispatch guard | Present; live entitlement unknown |
| CompanyID header | p2 §§3,4.1 | Existing company checked by dispatch guard | Present; live entitlement unknown |
| JSON encoding | p4 §4.5 | JSON.stringify; Content-Type application/json; Accept application/json | Matches representation |
| Base URL | p9 §10.1 | Production clientsapi.pdc-eg.com; document uses clientsapi-test.pdc-eg.com | Production confirmation remains separate |
| allMustValid boolean, required | p2 §4.2 | true | Matches |
| shipments array, required | p2 §4.2 | One object | Matches |
| hasAWBs boolean, optional | p2 §4.2 | false; no preassigned AWB | Matches |
| extraParams object, optional | p2 §4.2 | Empty object; no blanket overrides | Matches type |

No Bearer token, cookie, URL credential, sessionID or browser session is specified
as authentication. Redirect refusal and time/body limits are local protections.

## Every shipment field in the required/optional table

Private field values are deliberately omitted.

| Field | Type / required? | Source | Submitted value or treatment |
| --- | --- | --- | --- |
| subAccountID | integer / no | p3 §4.3 | Omitted; no requirement for this merchant established |
| awb | string / no | p3 §4.3 | Omitted; provider generates it |
| fromCityID | integer / yes | p3 §4.3 | 10; Ramses in both supplied workbook sheets and retained API list |
| fromAddress | string / yes | p3 §4.3 | Saved pickup; nonempty |
| fromPhone | string / yes; exactly11 digits | p3 §4.3; pp9–10 | Saved pickup; passes format |
| fromContactPerson | string / no | p3 §4.3 | Saved pickup contact; correct casing |
| toCityID | integer / yes | p3 §4.3 | 10; lookup membership does not prove street coverage |
| toConsigneeName | string / yes | p3 §4.3 | Saved order name; nonempty |
| toAddress | string / yes | p3 §4.3 | Saved order delivery address; nonempty |
| toPhone | string / yes | p3 §4.3 | Saved order phone; passes local11-digit mobile validation |
| toMobile | string / no | p3 §4.3 | Omitted; separate mobile not required by table |
| toRef | string / yes; globally unique | p3 §4.3; pp9–10 | Exact persisted ORD-UUID reference;40 characters; no documented maximum |
| toContactPerson | string / no | p3 §4.3 | Omitted |
| productID | integer / yes | p3 §4.3 | 40 from configured account; product-specific limits undocumented |
| cod | number / no | p3 §4.3 | 0 from paid-order ledger, distinct from goods value |
| weight | number / yes; kilograms | p3 §4.3 | 1; explicitly simulated test value, not measured acceptance evidence |
| pieces | integer / yes | p3 §4.3 | 1; current quantity sum; multiple-item physical packaging is separate |
| contents | string / no | p3 §4.3 | Saved item title/quantity; no invented specifications |
| specialInstructions | string / no | p3 §4.3 | Omitted; p4 example misspells specialInstuctions; no guess sent |
| fromCity | string / no | p3 §4.3 | Omitted; numeric ID supplied |
| fromLat / fromLng | number / no | p3 §4.3 | Omitted |
| toLat / toLng | number / no | p3 §4.3 | Omitted |
| shipmentTypeID | integer / yes | p3 §4.3; p4 §4.4 | 1 General; distinct from productID40;3 Reverse/5 Exchange excluded |
| declaredValue | number / no | p3 §4.3 | EGP1 net saved merchandise value; Product40 range unknown |
| allowToOpenShipment | boolean / no | p3 §4.3 | false; correct casing |
| refuseCOD | integer / no | p4 continuation of §4.3 | Omitted for normal prepaid outbound shipment |

The p4 example also includes serial, sessionID, userID, clientID, toAddress2,
awBxAWB, transDate, distance, duration, route, pickupID and runnerID. The required
field table does not mark these as required. Example zeroes and placeholder
strings do not establish valid real booking values. No dimensions requirement
or separate pickup/cancellation endpoint appears in the supplied guide.

## Responses, labels and recovery

| Contract / question | Source | Adapter behavior / limit |
| --- | --- | --- |
| generalResponse.success, id and summary | API p5 §4.6 | Reads explicit batch success; unused batch ID is not a booking identity |
| successResponses[].awb/ref/success/errors | API p5 §4.6 | Requires exactly one success, exact original ref and valid AWB; ignores display-only name |
| badResponses rejection | API p5 §4.6; p9 §9 | Recognizes explicit one-item validation rejection; outbound still retains safe uncertainty instead of rebooking |
| Generic top-level HTTP500 envelope | Retained incident receipts | Rejected; no field diagnosis, AWB or non-creation inferred |
| POST ExportPDF | API pp5–6 §5 | Existing AWB only, templateID1, awBs array |
| Binary application/pdf | API p6 §5.3 | Bounded content type, %PDF- signature and size; private file/hash metadata; authorized download |
| POST GetShipmentsStatus | API pp6–7 §6 | Exact endpoint/method, same auth headers |
| fromDate/toDate datetime filters | API pp6–7 §§6.1–6.2 | Prior original-reference request omitted both; guide does not specify requiredness or defaults |
| awBs/reFs strings | API p7 §§6.1–6.2 | Recovery used awBs='' and one exact original reFs; no generated replacement reference |
| AWB/Ref/Status/Reason | API p7 §6.3 | Known rows matched uniquely; optional extra StatusID/StatusDate never invented |
| Index delay | API p9 §9 | Original lookup waited136seconds; guidance says1–2 minutes |
| Paginated results | API p6 §6 | Known partial-result indicators rejected; controls/envelopes/defaults are not specified by guide |
| Reference-only recovery | API p7 filters | Supported request shape; mandatory-date semantics and current provider outcome still need confirmation |

## Lookup workbooks and future tracking

| Source | Verified result | Remaining requirement |
| --- | --- | --- |
| API pp7–8, Address Mapping Sheet1 | All382 seeded IDs/labels match after whitespace normalization | Workbook is not a current street-coverage or price guarantee |
| Address Mapping Sheet2 | Same382 IDs with alternative groupings/labels; Ramses10 agrees | Review conflicts before alias/governorate changes |
| Retained23October GetCities | 411 IDs;381 shared names agree;366 absent;383–412 added | Review new aliases/current membership without inventing IDs |
| Final Status6 Status | 33 rows/32 unique IDs; all represented;97 duplicate | Confirm actual account mapping;97 remains neutral |
| Reason Sheet1 | 25 names, no numeric reason IDs | Preserve bounded text; do not use spreadsheet row numbers as codes |
| Webhook p2 | HTTPS POST, JSON, X-Webhook-Secret,200/201 within10s | Ingress/registration remain disabled/unaccepted |
| Webhook pp3–4 | AWB, REF, CustomerStatusName, StatusID, StatusDate, ReasonName | REF+savedAWB match; safe configured timezone; actual provider timezone still needs confirmation |
| Webhook p5 | CustomerStatusName may be empty if unmapped | Existing parser allows empty; unknown IDs remain neutral |
| Webhook pp2,5–6 | AWB+StatusID idempotency, secure registration and mapping confirmation | Existing deduplication tested; provider registration/mapping/live callbacks not exercised |

The supplied documents provide no pickup-booking API, cancellation procedure,
Product40 testing range, reference length limit, pagination protocol or exact
status-date timezone guarantee. These are provider questions, not fields to
invent or live experiments to execute.
