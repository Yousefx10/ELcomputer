# PDC live GetProducts acceptance — 2026-10-22

**LIVE GETPRODUCTS ACCEPTANCE PASS.** Release `881aadcfd4942ef8`, schema90.
One authenticated GET returned HTTP200. No retry was needed or performed.

## Verified result

The exact production V6 GetProducts URL returned complete `application/json`:
a top-level array containing two objects. Each has numeric `productID` and
string `productName`, with no additional fields. The 91-byte response passed
the deployed application's JSON reader and endpoint-specific normalizer.

| Provider fields | Normalized result |
| --- | --- |
| productID36, productName General | id36, name General |
| productID40, productName High Value(elc) | id40, name High Value(elc) |

The saved Product ID remained40 before and after. Both caches remain empty.
No CompanyID was echoed. This result does not independently prove account ownership.
The earlier historical HTTP500 remains unexplained.

## Integration and Dashboard boundary

The existing isolated diagnostic pattern ran on the production VPS. It used
unmodified compiled lookup, decryption, JSON-reading and normalization declarations
read from the current deployed Nuxt chunk. Its full hash matches the accepted
archive. Twenty pinned declarations and their dependencies were loaded in memory;
the application was not rebuilt, edited, restarted or redeployed.

The existing saved token was decrypted only in VPS process memory. The request
used AccessToken and CompanyID headers, without cookies or a body. The bounded
native HTTPS adapter refused redirects and had no retry behavior. The separate
conditional retry permission remained unused. No raw response, arbitrary headers,
credentials, exception text or cookies were retained.

The Nuxt HTTP Dashboard route was **NOT_EXERCISED**. It requires the disabled
runtime gate and writes lookup throttling and an admin audit record. Sync also
calls GetCities and writes caches. Invoking either would violate this acceptance's
constraints. No connected authenticated browser was available.

Dashboard source behavior was inspected: empty caches retain the numeric40 input;
Test and Sync remain disabled. This is source inspection, not hosted UI acceptance.
No privileged identity, login, permission override or mocked production API was used.

## Preservation and custody

Read-only before/after transactions match across14 protected tables: PDC/site
settings, city/status mappings, normal/claim jobs, webhook history, durable
dispatches, admin activity, products, Auth users/identities and Storage metadata.
Schema history remains90. Product selection, lookup throttling, credentials and
all saved settings remain unchanged. Premium remains selected.

Runtime/Caddy/unit hashes, current release and both service process identities
match before/after. All persistent commerce/provider gates remain held.
No shipment, label, order, payment, SQL write, cache write, webhook activation,
provider contact, deployment or Git push ran. PDP files and media were untouched;
deployment/browser validation was not repeated.

Private evidence: parent `pdc-live-getproducts-acceptance-20261022/`.
Local directory0700/files0600 contain the authorization, pinned diagnostic,
seven offline boundary cases, before/after fingerprints and sanitized receipts.
Independent pinned-SSH readback confirms exactly one consumed attempt and result,
with no retry or BLOCKED marker. The production directory contains only diagnostic
markers and sanitized evidence; no executable helper was installed.
All historical diagnostic helpers, consumed markers and evidence remain preserved.

`FINAL-ACCEPTANCE-RECEIPT.json` SHA256:
`bb808cc512e347a9bc29dd00f4e8b36e225dd4054a18b2babda769acf92b2b4d`.
The successful attempt consumes this request authorization. Do not rerun it.

## Remaining webhook and controlled shipment acceptance

These requirements come from the [compatibility audit](pdc-v6-compatibility.md)
and [existing webhook cutover plan](pdc-webhook-cutover-plan.md).
No execution or new release preparation is included here.

1. **Provider contract confirmation:** resolve optional booking field names
   (`fromContactName`/`fromContactPerson`, `allowToOpenPackage`/`allowToOpenShipment`,
   `specialInstuctions`/`specialInstructions`). Confirm production status mappings,
   Status97, timezone/DST, repeated-status identity, status response envelopes and
   pagination, plus webhook retry timing and retention. Do not guess these values.
2. **Webhook readiness:** privately verify the independent secret. Separately
   approve exact-path HTTPS POST ingress and inbound provider enablement.
   Keep checkout/signup, Paymob, outbound workers, auto-labels, reverse and COD held.
   Prove secret/method denials, exact REF/AWB matching, durable acknowledgement,
   duplicate idempotency and ordering with a coordinated known shipment. Confirm
   no payment, accounting or inventory effects before destination registration.
3. **Shipment prerequisites:** separately authorize GetCities acceptance and any
   cache/mapping writes. Verify complete pickup/destination IDs, actual coverage,
   fees, pickup contact/address, parcel weight/pieces, service40 and shipment type.
   Use one owner-approved legitimate order with verified stock, packing and delivery
   details. Review token rotation already described in the cutover plan separately.
4. **Controlled booking:** separately scope manual provider/runtime enablement,
   named staff permissions, one durable REF and one SaveShipmentEx call. The
   existing flow then requests ExportPDF; both calls need explicit acceptance scope.
   Verify exact returned REF/AWB, private PDF custody and physical printing.
   Keep automatic booking and unrelated commerce gates disabled. For prepaid
   cards, collect zero COD; a COD test requires its own financial scope.
   An uncertain booking stops for original-REF reconciliation, never rebooking.

Next owner action: resolve the provider contract questions before scoping webhook
and single-shipment acceptance. No additional GetProducts call is required here.
