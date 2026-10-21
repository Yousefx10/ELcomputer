# PDC GetProducts HTTP500 — local evidence review, 2026-10-21

**Offline review complete. PDC CONNECTION BLOCKED; cause remains unknown.**
A [sealed bounded capture](pdc-getproducts-capture-preparation.md) is now prepared;
its final seal is now owner-approved and [helper staging passed](pdc-getproducts-capture-staging-receipt.md).
The subsequent owner attempt returned HTTP200 / RESPONSE_SCHEMA_REJECTED.
[Its archive analysis](pdc-getproducts-capture-analysis.md) is complete; the exact
schema failure and this original500 cause remain UNKNOWN. Both approvals are consumed.
No new provider request, production connection for this review, credential
decryption, setting change, retry, shipment or deployment occurred. The separately
completed [Paymob restart](paymob-controlled-restart-receipt.md) does not authorize
another PDC request. The original one-run diagnostic approval remains consumed.

## Established facts

The [retained diagnostic receipt](pdc-readonly-diagnostic-receipt.md) records one
authenticated `GET https://clientsapi.pdc-eg.com/api/ClientUsers/V6/GetProducts`
returning HTTP500 at 09:55:55 UTC. GetCities was not attempted. The fixed wrapper
checked the exact endpoint/method, no request body, redirects refused, matching
CompanyID header and nonempty decrypted AccessToken before dispatch.

All nine application utility source hashes in the diagnostic input manifest
still match the current repository. This includes lookup transport, secret
handling and base-URL validation. No later local code drift explains the failure.

| Question | Evidence and conclusion |
| --- | --- |
| Local failure before any HTTP response? | The wrapper recorded response status500 after its fetch returned. A local precondition, credential-decryption or transport exception alone does not explain that recorded response. |
| Parser/normalizer caused the captured500? | No. Lookup transport checks `response.ok` before reading or parsing the body. The captured500 was rejected before ID/list normalization. |
| Wrong request caused by pickup spelling, city, parcel or selected product? | Those fields are not transmitted in this GET. Its explicit account inputs are AccessToken and CompanyID headers. No address/ID/parcel edit is justified by this evidence. |
| Are credentials/account permissions valid? | Unknown. Receiving500 does not establish account authorization, token validity or ownership. Historical agreement is not current provider acceptance. |
| Is PDC down, or is the endpoint contract wrong? | Neither is established. The implemented request shape and historical local protocol notes do not independently prove today's account/endpoint behavior. |
| Can the error explanation be recovered from retained output? | No. Only operation, method and status were captured. Response body, content type and correlation headers were not retained. |

The local `requestPdcLookup` catch intentionally returns a generic application502
without forwarding upstream text. That application status is distinct from the
captured upstream500. Public errors must remain sanitized; exposing provider
messages through Dashboard is not an approved correction.

## Local replay

Three synthetic cases passed using the preserved diagnostic bundle, with real
network fetch disabled:

1. A fake500 produces exactly one failed product lookup, no city call, no retry,
   and no error-body/header read.
2. A malformed fake200 is a separate parsing failure, not the captured500 path.
3. Valid synthetic product/city arrays pass existing normalization and selection.

These establish local control flow only. They do not establish live API compatibility
or merchant acceptance. No application fix or credential/configuration change is
supported by the present evidence. The bounded local PDF text-marker inspection
did not independently establish the live lookup contract; no absence of vendor
support is inferred from text extraction.

Protected local directory0700/files0600, outside Git:
`/Users/imac/Documents/ELcomputer/pdc-http500-offline-review-20261021/`.
`REVIEW-RECEIPT.json` SHA256:
`255d1a65c04d6b34048fac58654e20c6431a37619a036864ce9be54d5070ca95`.
Original diagnostic and encrypted recovery artifacts remain untouched.

## Next bounded step

Prepare a separately reviewed, one-request GetProducts error-capture diagnostic.
Its scope should retain the original exact HTTPS URL, existing protected credentials,
GET-only method, redirect refusal, timeout/size bounds, no retry, no GetCities and
all persistent gates off. Any raw response that might contain private data must
remain protected/encrypted outside Git and all output must be sanitized. Current
provider/account evidence is the alternative way to establish the missing cause.
The subsequent preparation seals that narrow diagnostic; this review itself grants
no execution approval. Use only its final plan after separate owner authorization.
Do not rerun the consumed wrapper or use Dashboard Test/Sync under this record.

Controlled payment/shipping acceptance and required WordPress customer identities,
old-login/private-profile/address/historical-order migration remain on the launch
roadmap. Prevent duplicate Auth identities and historical financial/commerce effects;
keep unrestricted signup and public checkout disabled.
