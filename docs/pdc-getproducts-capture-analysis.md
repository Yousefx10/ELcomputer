# PDC capture analysis and Codex 1 handoff — 2026-10-21

**ANALYSIS COMPLETE. Archive verification PASS. PDC connection remains BLOCKED.**

The later [deep investigation](pdc-getproducts-deep-investigation.md) reproduces
diagnostic-only echo rejection and narrows the remaining causes. The exact live
failure remains unknown. Review its separately scoped schema-only proposal next.

The subsequent [offline schema audit](pdc-getproducts-schema-audit.md) is complete.
It found no authentic row schema in the inspected historical evidence. The live
schema and exact rejection remain UNKNOWN. A values-free support question is
prepared for separate owner approval; no implementation correction is justified.

The owner consumed the [sealed capture approval](pdc-getproducts-capture-preparation.md)
with one GetProducts GET at 13:46:52 UTC. Its status was200, classification
`RESPONSE_SCHEMA_REJECTED`. Evidence encryption and state-preservation checks passed.
No GetCities call or retry occurred. The agent made no provider request during
this analysis. The original09:55 HTTP500 remains a separate, unexplained result.

## Independent archive verification

Two separate pinned-SSH sessions copied the fixed evidence files and independently
read back their full bytes. Both copies matched, including the encrypted-file hash
in the capture/final receipts. Root ownership, directory0700 and file0600 passed.
`ATTEMPT.json` remains consumed with retry forbidden. The final receipt agrees with
the capture receipt and records `state_preserved:true`.

The unchanged approved `owner-report.mjs --verify` authenticated the local copy using
RSA-OAEP-SHA256 and AES256-GCM. Its owner-view mode was not used. A separate local
analyzer retained the reader's validation checks and emitted only fixed structural
metadata, types and boolean hints. No correlation values, original row values,
credentials, full decrypted report or raw response were printed or saved as plaintext.
No correlation ID was supplied. The evidence private key stayed on the iMac.

Protected local directory, outside Git, directory0700/files0600:

`/Users/imac/Documents/ELcomputer/pdc-getproducts-capture-analysis-20261021/`

| Retained artifact | SHA256 |
| --- | --- |
| `RESULT.enc` | `18d9220ba80327387ccd5ae7360c86adee627bb3dc9b207e6188bdc3a84e0acb` |
| `ARCHIVE-READBACK.json` | `23fd2799b968164f3cabda0f9db4b6e33e3f132b76edf283028c4d59b9d790d4` |
| `ARCHIVE-AUTHENTICATION.json` | `45c6c42471512c51536e102a99f9ba4192cf08b35981f424a2b86ec86878c359` |
| `FINAL-ANALYSIS-RECEIPT.json` | `ad6cfea0d21f730a4f46572fd05cde9654d8c3595b79d54f6d8bec189cefda6f` |

Only encrypted evidence and sanitized operational metadata/scripts are local files.
The protected preparation and staging directories remain untouched. No production
file was created or removed during analysis. In particular, no `ARCHIVED.json`
acknowledgment was written remotely and `run.py` was **not retired**. Preserve the
helper, encrypted result and consumed marker until the required review completes.

## Confirmed findings and remaining uncertainty

| Question | Evidence-bound finding |
| --- | --- |
| Transport, HTTP or JSON syntax failure? | Direct upstream HTTP200; application/json; complete, untruncated, unencoded body; valid JSON. No Nuxt/Caddy proxy was exercised. |
| Outer response shape? | A top-level array with two objects. Redaction retains up to three array elements, so this two-element sample is not an unknown larger row count. |
| Which original keys/values survived? | None of the row keys or values. Each object projects only the fixed `redacted_fields` marker. That marker means unretained fields existed; it does not identify them or prove id/name were absent. |
| Are wrapper changes justified? | No. The existing outer-row extractor already accepts this array shape. Adding generic wrappers would not address the established structure. |
| What did schema rejection establish? | A local failure after valid JSON was received, within the diagnostic's broad lookup-validation try/catch. Normalization or subsequent company-echo conversion are candidates. The capture did not retain the thrown validation reason. |
| Is the saved Product ID wrong? | Not established. Selection was never reached. `saved_product_matches:false` is its initialized value, not evidence of a missing product. City selection was not examined. |
| Is authentication/account configuration wrong? | UNKNOWN. No authentication/error hints were recognized, but HTTP200 and absence of hints do not establish credentials, account ownership or product eligibility. |
| Why did the original request return500? | UNKNOWN. This later200 does not explain the earlier500 or establish a provider outage. |

**Precise rejection cause: UNKNOWN. No application defect or account correction is
confirmed.** The redaction deliberately removed the information needed to distinguish
alternate field aliases, invalid/zero/duplicate IDs, invalid required names, or another
validation failure. Do not claim a particular live field name from synthetic fixtures.

## Code and supplied documentation comparison

The current parser/dependency hashes still match the exact captured bundle.

- [pdcResponseRows](../server/utils/pdcLookups.js#L40) accepts an array directly,
  or reviewed `data`/`items`/`shipments` arrays. It rejects oversized/partial results.
  The observed two-object top-level array does not require an envelope correction.
- [normalizePdcLookup](../server/utils/pdcLookups.js#L47) accepts `id`/`ID` and
  `name`/`Name`. It requires unique positive32-bit integer IDs and a nonempty,
  bounded name. The name guard is [boundedPdcText](../server/utils/pdcTracking.js#L5).
  These are candidate validation locations, **not confirmed locations to modify**.
- The private capture-entry.mjs also stringifies any company-scope echo after
  normalization and before setting `company_scope_echoed`. Its broad catch labels
  other exceptions with valid JSON as schema rejection too. Absence of that flag
  cannot uniquely locate the exception inside the normalizer.
- Supplied `Customer Courier Integration Test V4-1.pdf`, page8, documents
  GetProducts GET, AccessToken/CompanyID headers and an array of `id`/`name` rows.
  This matches the parser's documented input. The separate webhook PDF does not
  define the GetProducts response. Neither document grants execution permission.

Eight synthetic offline replay cases passed using the unchanged sealed bundle,
local Node24.16.0 and a fixture transport. All real network entry points refused
calls; provider requests were zero. Documented id/name rows passed. Alternate
aliases, zero IDs, duplicate IDs, empty names and a malformed company-echo object
produced the same schema classification and redacted array projection. A missing
saved selection and invalid JSON produced their separate classifications. This
demonstrates the evidence is insufficient to choose a unique fix. It is not native
production compatibility or merchant acceptance. No application code changed.

## Minimal correction and validation recommendation

Do not broaden normalization or change account settings from this evidence alone.
First establish a **values-free** row schema from existing owner-held evidence or
authoritative account documentation: field names, value types, ID validity/uniqueness
rules, required-name validity and company-echo type. Do not request tokens, real IDs,
product names or private response contents in chat. Nothing authorizes another GET.

If verified alternate aliases are the cause, map only those exact aliases in
`normalizePdcLookup`, retaining existing bounds, uniqueness, pagination, selection
and confidentiality guards. If rows violate the verified provider contract, obtain
provider/account clarification instead of silently discarding rows or weakening ID
or name validation. No specific patch is justified until that distinction is known.

Validate any eventual patch offline with a sanitized shape fixture, documented
id/name regression, malformed/error rows, invalid/duplicate IDs, name bounds,
oversize/partial results and wrong selection. Verify no cache, booking, enablement
or provider call occurs. Run focused checks with the repository's pinned Node22.23.1
before a separate release review. Live validation needs new, explicit approval;
both existing diagnostic approvals remain consumed.

**PDC support is not established as necessary.** There is no confirmed outage or
credential fault requiring escalation. Support is the fallback for values-free
schema/ID-rule clarification if existing owner-held/account documentation cannot
establish it. No provider was contacted during this closure.

## Complete handoff for Codex 1

- Analysis/archive verification is complete; PDC connection and selection remain
  BLOCKED. Precise schema rejection and the original500 cause remain UNKNOWN.
- Owner approval seal
  `a453c1c120966eba492ebd0e394cae56f4562d744ca0d0271644e446a79f899a`
  is consumed. Never rerun pre/once, the old wrapper or Dashboard Test/Sync.
- `/root/pdc-capture/run.py` remains root0600 inside root0700. Exact helper SHA256:
  `f3b098765c075a279ed39001293ee518587cefecea37b83623fc9518dcfacb8b`.
  Its consumed marker, receipts and encrypted evidence remain protected. Do not
  retire it before review; no retirement or production change is authorized here.
- Archive/key locations are in this document and the preparation record. Preserve
  the local-only owner-evidence-private.pem and all encrypted recovery artifacts.
  Do not copy keys into Git or print private evidence.
- Release remains `d2d7a8029b473e4a`; schema87 remains the accepted baseline without
  a new SQL observation. Fresh read-only custody/runtime and service checks matched:
  app/Caddy active, unchanged from the owner's preflight, zero automatic restarts.
  The reviewed final receipt verifies state preservation; no new database query
  or independent merchant acceptance is claimed by this analysis.
- Paymob LIVE configuration, its completed controlled restart and owner acceptance
  are closed. Preserve all payment/shipping/signup/checkout disables. No PDC request,
  shipment, label, webhook activation, payment, deployment, migration, service restart,
  Auth/product/media/inventory/settings modification or Git push occurred here.
- **ONE next action:** review this closure and obtain a verified values-free row
  schema before choosing any normalization or account correction. Additional
  provider calls or transactions need separate approval.
- Preserve the prioritized roadmap: resolve PDC, controlled payment/shipping
  acceptance, and required WordPress customer identities, old-login compatibility,
  private profiles/details, billing/shipping addresses and historical orders before
  unrestricted signup. Preserve existing Auth UUIDs, prevent duplicate identities
  and prevent imported orders from creating financial/commerce transactions.
