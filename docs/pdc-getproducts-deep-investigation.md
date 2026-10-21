# PDC GetProducts deep offline investigation — 2026-10-21

**The exact live rejection remains unknown. Dashboard misconfiguration is not proven.**

The deeper investigation establishes a narrower failure set and a real diagnostic
ambiguity. It does not establish a provider field alias or justify changing account
settings. The recommended next action is review of the
[schema-only diagnostic proposal](pdc-getproducts-schema-diagnostic-proposal.md).
PDC support remains a fallback, not the next required step.

## Confirmed findings

- The earlier HTTP500 was recorded from the upstream response before parsing.
  It cannot have been caused by local product-list normalization.
- The later result proves valid JSON and two top-level objects. It does **not**
  prove that `normalizePdcLookup` rejected them: the diagnostic's broad catch also
  includes company-echo conversion after normalization.
- A malformed JSON company-echo object can pass application normalization and
  still throw in the diagnostic. This reproduces the exact retained two-object
  redacted projection and `RESPONSE_SCHEMA_REJECTED` classification.
- A wrong saved product or an ordinary scalar company mismatch produces
  `RESPONSE_SELECTION_MISMATCH`, not the observed schema classification, when
  preceding validation succeeds. Neither alone explains the captured rejection.
- No real response field names/types survived redaction. Additional offline scans
  found no independent authentic GetProducts response schema.
- The application lookup source matches the accepted release preparation. All
  22 source/dependency inputs of the captured bundle still match their pins.

## Complete application flow

| Stage | Actual behavior and relevant source |
| --- | --- |
| Dashboard | `ShippingTab.vue` disables Test/Sync while runtime calls or provider enablement are off. `runPdcLookup` POSTs only `{ action }` using the staff bearer token. It reads saved settings, not unsaved form fields. All action failures render the same translated failure message. |
| Authorization | `requireAdminRequest` authenticates the bearer, reads an active staff record and checks `settings.edit`. No owner/account bypass exists. |
| Settings | `getPdcSettings` reads the saved `pdc` row. Retrieval errors can produce a **local**500; missing settings produce503. These are distinct from the recorded upstream500. |
| Read gate | `requirePdcReadAccess(..., { allowDisabled:true })` still requires the runtime outbound gate, exact mode/base URL, token envelope and digit-only Company ID. The UI is stricter about provider enablement. Neither gate was changed here. |
| Throttle | `shipping_claim_pdc_lookup` requires service role and updates the local lookup-attempt timestamp. Failures return503/429. The diagnostic bypassed this API and performed no throttle/cache/audit write. |
| Credentials | `decryptShippingSecret` opens the versioned AES-GCM envelope using the runtime shipping key. Envelope/key failures occur before dispatch. Inside `requestPdcLookup`, they are masked to502. The webhook secret is not used for GetProducts. |
| Request | `requestPdcLookup` sends a GET to the exact configured GetProducts URL. AccessToken and CompanyID are headers; Accept/Content-Type request JSON. There is no body for this caller, redirects are refused and the timeout is eight seconds. Product, pickup, city, phone, weight, label and COD fields are not sent. |
| HTTP and bytes | Non-success HTTP, excessive Content-Length, absent body, stream failure, more than1MiB, decoding/JSON errors are masked to a generic local502. Non-success bodies are not parsed by this helper. |
| Row extraction | `pdcResponseRows` accepts a direct array or the existing `data`, `items`, `shipments` arrays. It rejects more than5,000 rows and recognized partial-pagination metadata. No new wrapper is inferred. |
| Normalization | `normalizePdcLookup` reads `id ?? ID` and `name ?? Name`. `Number(id)` must yield a unique integer in1…2147483647. `boundedPdcText` accepts a string/number name, trims it, and requires1…200 characters without remaining control characters. A non-null invalid lowercase value prevents fallback to its uppercase alias. |
| Dashboard Test | A normalized list returns `connected:true` and a count, including an empty list. This action does not check the saved Product ID or company echoes. Success writes a sanitized admin audit; a normalization failure occurs before that audit. |
| Dashboard Sync | After product normalization it requests GetCities. Both normalized lists must be nonempty. Cache replacement is conditional on the same settings revision; it preserves configured IDs and address aliases. |
| Later eligibility | Checkout/booking separately require saved product and city membership in the caches, explicit courier selection, stock/packing readiness, authorization and current configuration. Test success does not establish booking eligibility or merchant ownership. |

The GetProducts application caller is
[lookups.post.js](../server/api/admin-shipping/lookups.post.js). Other users of
`requestPdcLookup`/`pdcResponseRows` reconcile shipment status; they do not fetch a
product list. They retain their exact REF/AWB, authorization and runtime guards.
No checkout, booking, webhook or reconciliation behavior was changed.

## What each diagnostic actually tested

The first `runDiagnostic` used the existing fetch transport. It recorded status
immediately after fetch, then extracted rows, checked company echoes, normalized,
checked the saved product, and only on success would have requested cities.
HTTP500 stopped it before body parsing or any company/product validation.

The later `runCapture` used one native HTTPS GET, normal TLS, no proxy environment,
no redirect/retry, an8-second deadline,16KiB headers and64KiB body limit. It reused
the application parser/normalizer through a synthetic Response of those bytes.
It normalized **before** stringifying company echoes and checking saved membership.

The catch did not preserve the failed stage. If HTTP/encoding/body guards did not
explain the failure and the captured bytes could be parsed as JSON, it assigned
`RESPONSE_SCHEMA_REJECTED`. This includes exceptions outside normalization.
The raw bytes were discarded; encryption protected an already-redacted report.
Decrypting it again cannot restore erased keys or values.

The two request clients differ. Their success/failure does not isolate provider
state, account processing or client/wire defaults as the cause of500 versus200.
No retained request/response trace proves a specific transport defect or outage.

## Exact failure conditions

| Location | Condition | Result |
| --- | --- | --- |
| Before outbound request | Bad mode/URL, disabled required gate, missing credentials, invalid Company ID, invalid envelope/key or diagnostic precondition | Local refusal; cannot independently explain a recorded upstream500. |
| Original fetch result | A returned HTTP500 | Recorded upstream500; lookup helper throws local502 before reading its body. Provider-internal cause was not retained. |
| Application response reader | Non-2xx, missing/oversized body, stream/release failure, invalid JSON | Generic local502. Broad capture classification depends on the separately retained HTTP/body/JSON evidence. |
| `pdcResponseRows` | Non-array selected envelope, over5,000 rows, `hasMore === true`, truthy `nextPage`, or numeric total greater than row count | Local502; capture schema rejection if no earlier classification applies and JSON parses. |
| ID conversion | Missing/null/invalid ID; `Number` throws, yields NaN/noninteger/nonpositive/overflow | Local rejection. Conversion exceptions can be ordinary JavaScript errors; other invalid IDs generally produce502. |
| Required name | Missing/null, disallowed type, empty after trimming, over200 characters, remaining control character | `boundedPdcText` throws local400; the diagnostic maps it to schema rejection. The UI still shows a generic failure. |
| Uniqueness | Two IDs become equal after numeric conversion, including numeric-string equivalents | Local502; capture schema rejection. |
| Diagnostic echo conversion | `String(echo)` throws, for example for a JSON object with a non-callable own `toString`, an array containing such an object, or excessive nested-array coercion | Can fail after successful normalization; capture schema rejection. |
| Ordinary echo mismatch | A scalar echo converts successfully but differs from the configured Company ID | Later diagnostic selection mismatch; not the observed schema rejection by itself. |
| Missing product/empty array | Normalization succeeds but the saved selection is absent or rows are empty | Later diagnostic selection mismatch. Dashboard Test can still report connected. |
| Capture-specific HTTP/body guards | 401/403, redirects, other4xx/5xx, partial/truncated/encoded response | Dedicated classifications take precedence; the captured200 evidence excludes these as its recorded failure category. |
| Capture instrumentation exception | A failure while validating/building captured metadata/Response, with captured valid JSON and no preceding classification | Also potentially schema rejection. The recorded content-type/body flags and standard native Response narrow this possibility, but the broad catch did not retain a proof of stage. |

For the observed complete, unencoded two-object array, unsupported envelopes,
pagination wrappers and row-count overflow are not good explanations. The normal
remaining candidates are ID/name validation or uniqueness, and diagnostic-only
echo conversion. A two-row error payload lacking the required product fields also
falls into the first category. No particular alias, zero ID, blank name or echo
shape is established as the live cause.

Name validation runs before the normalizer's final ID-range/uniqueness check.
An invalid name and ID in the same row therefore do not identify which field
would have failed next. Safe stage metadata must report these predicates separately.

## Expanded offline evidence search

| Source | Fresh inspection and result |
| --- | --- |
| Both preserved current WordPress SQL exports | Authenticated full envelopes and plaintext pins;936,715,338 plaintext bytes scanned as data. No case-insensitive GetProducts reference in either export. No SQL or PHP executed. |
| Original22-part backup | All22 outer size/SHA256 pins matched. Scanned44,941 text files/streams totaling2,202,709,480 bytes across database, themes, plugins, content, core and text upload exports.157 generic GetProducts occurrences occurred, but none in a file containing a PDC marker; no PDC GetProducts implementation/response identified. |
| Existing extracted WordPress runtime | Supplementary search of7,387 text files,131,609,276 bytes;42 generic occurrences, none coexisting with a PDC marker. This mirror was not newly authenticated; original pinned archives are the stronger source. |
| Recovered PDC integration | The earlier three authenticated selected envelopes retain identical PDC snippets using shipment creation/status operations, with no product lookup implementation. The full-source scan now extends beyond that earlier selection. |
| PDFs | Both courier files remain byte-identical and document numeric `id`/string `name` on page8. Webhook copies are a separate protocol. A separately named local API-interface PDF contains neither PDC nor GetProducts markers. No document proves the live merchant schema. |
| Git, archived release and local artifacts | GetProducts integration history leads to the current normalizer and later read-access correction. The accepted release source and current source match. Sealed fixtures, native test logs and compiled release contain synthetic tests/application code, not an additional authentic provider response. |

The text scan covered PHP, JS, JSON, TXT, INI, ENV, SQL, LOG, HAR, CSV, HTML, MJS,
Markdown and XML. It did not interpret images, PDFs embedded in uploads, arbitrary
binary formats or every possible source extension.157 generic references without
PDC markers are not proof of an integration. This bounded search found no independent
schema; it cannot prove that no unexamined owner-held artifact exists.

No credential, customer row, private snippet or raw response was printed or saved.
Original archive/encrypted evidence bytes were preserved. Only counts, hashes,
booleans and fixed classifications were emitted to new protected local artifacts.

## Configuration verdict

**No Dashboard configuration correction is established.** Earlier masked saved-state
checks reported company/product/city IDs matching recovery. The later capture's
guarded hashes also match those recovered IDs. The owner-confirmed pickup/address
resolution remains closed; pickup details are not transmitted in this GET.

The earlier whole-row PostgreSQL fingerprint and later canonical JSON projection
fingerprint use different inputs/serialization. Their difference is not evidence
that settings changed. No current production query or token comparison was made.
Saved values matching recovery do not establish current authorization or ownership.
HTTP200 also does not establish those facts. Do not replace credentials or IDs
to make normalization pass.

## Verified defects and prepared corrections

1. **Diagnostic ambiguity:** the old broad catch conflates normalization and echo
   conversion; an unevaluated saved selection is represented as false. The future
   analyzer reports extraction, normalization, echo and selection independently,
   with `NOT_EVALUATED` where appropriate. The consumed wrappers/bundles remain
   untouched. No diagnostic transport or production helper was prepared or staged.
2. **Permissive ID coercion:** current `normalizePdcLookup` accepts `true`, `[1]`
   and nested singleton arrays as integer1. The settings validator already restricts
   identifier input to strings/numbers. The
   [minimal hardening patch](patches/pdc-lookup-id-types.patch) adds that same type
   restriction while retaining existing integer, uniqueness, name and pagination
   checks. It is **prepared and tested in memory, not applied**. It cannot explain
   the observed rejection and is not presented as its fix.
3. **Pagination limits:** existing guards recognize specific top-level metadata.
   String-valued `hasMore`, invalid totals and nested pagination are not a general
   pagination parser. Tests document these limits; no unsupported schema is adopted
   and no guards are relaxed. The observed top-level array provides no evidence that
   extending pagination recognition would resolve this incident.

There is still **no confirmed application correction for the live failure** at
`pdcLookups.js:47` or any other application function.

## Local validation

The committed [offline matrix runner](../scripts/pdc-getproducts-offline.mjs) requires
explicit hash-pinned capture and original-diagnostic bundles. It refuses fetch,
HTTP/HTTPS, HTTP2, socket, TLS and DNS entry points before importing those bundles.
All credential/account inputs are synthetic. It makes no production connection.

- 156 matrix cases PASS on pinned Node22.23.1. They compare real current helpers,
  both unchanged diagnostic bundles, an isolated actual Dashboard handler and the
  proposed ID guard applied to actual source **in memory**. Covered: aliases/types,
  null/fallback precedence, names/control/length bounds, duplicate/coercive IDs,
  account errors, envelopes, recognized/unrecognized pagination, all echo spellings,
  HTTP/body/encoding errors, configuration gates, secret-envelope errors and no-retry
  behavior. Real network attempts/provider requests: zero.
- 43 focused tests PASS:14 new analyzer/privacy tests and29 existing PDC tracking/
  settings/lookup tests. Existing HTTP-handler tests use local fixtures, not PDC.
- `git apply --check` passes for the unapplied ID-type patch. Application source,
  SQL, runtime settings, consumed helpers and original evidence are unchanged.
- Source pins, documentation links, handoff parity and `git diff --check` are checked
  before commit. No build/deployment is implied by these local checks.

The [pure schema analyzer](../scripts/lib/pdcLookupSchema.mjs) has no transport,
secret/settings reader or write operation. It is a tested component of the proposal,
not an operational capture runner or permission to make a request.

Reproduction uses Node22.23.1 and owner-held artifact paths supplied explicitly:

```sh
node scripts/pdc-getproducts-offline.mjs \
  --capture-bundle /protected/path/capture-bundle.mjs \
  --capture-sha256 87ea30450c88b17f58795790faee62772776977dbf5f34b279aad3051dde5517 \
  --lookup-bundle /protected/path/lookup-bundle.mjs \
  --lookup-sha256 d172a478790b23d039d50f1afa8ed508185e7fcea2a6bf6ab75c4a5687d565f4 \
  --output /protected/path/new-offline-matrix.json
node --test tests/pdc-lookup-schema.test.mjs tests/pdc-tracking.test.mjs
git apply --check docs/patches/pdc-lookup-id-types.patch
```

The output path must be new. These commands are offline validation, not a provider
diagnostic. Do not execute the original wrappers to reproduce the investigation.

## Decision and preserved work

The best-supported failure category is required row/ID/name/uniqueness validation.
Diagnostic-only malformed echo conversion is a proven alternative that the retained
evidence cannot distinguish. There is no evidence-based ranking of specific aliases
or malformed field values. The earlier upstream500 has no independently established
cause or useful ranking among provider/account/request-processing explanations.

**ONE recommended next action:** review and approve the separately scoped
[one-request schema-only diagnostic proposal](pdc-getproducts-schema-diagnostic-proposal.md).
It can establish schema and failing predicates without PDC support. If that bounded
approach cannot yield complete, releasable schema evidence, use the exact technical
question retained in the [earlier audit](pdc-getproducts-schema-audit.md#exact-pdc-support-question--separate-owner-approval-required).
No support message was sent.

Protected evidence: parent `pdc-deep-investigation-20261021/`, outside Git,
directory0700/files0600. Full scan, archive-detail scan, configuration evidence,
matrix results and focused-test log are bound by its `INVESTIGATION-RECEIPT.json`.
Receipt SHA256:
`188e3b9f2064b9fa768f16e866efe75d3260648d85e1e47fa059cd91abd6c9d6`.

Production remains the owner's accepted release `d2d7a8029b473e4a`/schema87 baseline,
without a fresh live check. No production connection/change, provider call, restart,
deployment, shipment, label, payment, webhook activation or Git push occurred.
All gates remain required off. Both earlier diagnostic approvals remain consumed.
Paymob configuration/restart acceptance stays closed.

Preserve the roadmap: PDC connectivity/webhooks/coverage/rates; controlled Paymob
payment/callback acceptance; controlled shipment/label/tracking acceptance; mandatory
WordPress identities, compatible login/reset, private profiles/phones, addresses and
historical orders before unrestricted signup; physical stock, shipping eligibility,
email confirmation and first purchase; explicit public-checkout acceptance; then
Brevo, Vodafone SMS, private VPS Support/Claims attachments and remaining UI/media.
Preserve Auth UUIDs, prevent duplicates and imported inventory/payment/financial effects.
