# PDC schema-only diagnostic proposal — 2026-10-21

**Design and local analyzer tests only. No outbound request is authorized.**

The [deep investigation](pdc-getproducts-deep-investigation.md) found that the
retained evidence cannot distinguish row validation from diagnostic echo conversion.
This proposal collects the missing schema and failing predicates independently.
It does not retry a consumed helper, enable PDC or claim merchant acceptance.

## Proposed request boundary

| Input/boundary | Required behavior |
| --- | --- |
| Provider operation | At most one authenticated GET to the existing configured production V6 GetProducts endpoint; no body. No alternative URL, GetCities, Test/Sync, status, shipment, label or webhook call. |
| Authorization | A new final plan must bind reviewed helper/analyzer/bundle hashes, the accepted deployment and separately reviewed target configuration. Owner approval identifies that final scope; old seals and a CLI flag do not authorize it. |
| Credentials | Existing saved AccessToken and CompanyID in memory only. No credential entry/replacement, webhook-secret access or Paymob secret/restart work. |
| Transport | Normal TLS validation, no proxy environment, fresh connection, redirect refusal, no retry, eight-second total request/body deadline,16KiB headers,64KiB body. |
| Preconditions | Read-only verification of accepted release, original service/runtime custody, expected protected account-ID bindings and all saved/running provider/payment/checkout/signup holds. Shipping edits paused; no settings save. No mutation or service operation to make a precondition pass. |
| Attempt control | Fresh bounded checkpoint and exclusive/no-follow consumed marker before dispatch. Crash/uncertainty consumes the attempt; no reset, replay, overwrite or automatic recovery. Use a new reviewed directory and preserve both older consumed captures. |
| Persistence | Only fixed receipts/markers and an encrypted **schema/validation report** in root-owned0700/0600 custody. No raw response, decrypted credential, raw header, product-name file or application/cache/DB write. No Nuxt instrumentation. |

This is a proposed scope, not a sealed final runner. Preparation of any operational
helper must preserve these limits and receive its own review/approval before
staging/execution. No executable provider command is supplied here.

## What the report may contain

- Fixed HTTP/content-type categories and complete/truncated/encoded flags. No header
  values, correlation IDs, cookies, redirects or free-form provider errors.
- JSON container/array structure, row counts, field names and JSON types only.
  No scalar values, example product names, IDs, contacts or source snippets.
- Separate row-extraction and actual unchanged application-normalization results.
- Counts of failed ID conversion, invalid integer/range, duplicate IDs, invalid
  required names and nonprimitive ID types; first failing zero-based row index.
  No actual IDs, name lengths/content, duplicate values or their hashes.
- Recognized company-echo result: absent, scalar match, scalar mismatch or unsupported
  type. Missing echo leaves account ownership unproven. Never stringify arbitrary
  echo objects to decide account validity.
- Saved-product membership only after successful normalization and valid saved-ID
  syntax. Otherwise `NOT_EVALUATED`, never a misleading default false.
- `schema_complete:false` for withheld/over-limit structure. Never choose an alias
  or declare compatibility from a partial projection.

The report must distinguish **schema analysis completed** from lookup acceptance.
It cannot authorize shipping, cache replacement, account ownership or provider
activation. Scalar company mismatch and unsupported echo types remain blocked.
Required names/IDs, uniqueness, size and pagination guards remain unchanged.

## Privacy and bounded structure

The tested [analysis component](../scripts/lib/pdcLookupSchema.mjs) accepts a bounded
in-memory byte buffer. It parses the exact application JSON encoding and calls the
unchanged row extractor/normalizer. It has no network, environment/settings reads,
credential decryption, console output or file-writing capability.

Structure is bounded to512 nodes, depth4,64 fields per object,64-character field
identifiers and an8KiB serialized report. All rows within the existing row/body
limits are still validated even if the schema projection reaches its limit.
Output-limit or unsupported-key cases remain explicitly incomplete; no automatic
larger request is proposed.

Only identifier-like field names can enter the encrypted report. Names matching
protected input values or response scalar strings are withheld. Email-like keys,
numeric keys, oversized keys and arbitrary free-text keys are withheld too.

**Syntax alone cannot prove an unknown key is non-sensitive.** An upstream server
could put personal/account data in an identifier-shaped key. Therefore even this
schema report stays encrypted and owner-only until literal names are reviewed as
schema labels. Console/chat/Git receive fixed stage codes and owner-reviewed field
names/types only. Do not log or export arbitrary unknown keys automatically.
The proposal never retains raw scalar values as an alternative.

The eventual operational wrapper must encrypt the bounded report before any output
or disk write. Evidence keys remain local/owner-controlled; only the recipient
public key may be staged. The current pure analyzer performs no encryption or
transport and is not safe to wire directly to console logging of unreviewed input.

## Local acceptance and interpretation

Fourteen analyzer tests cover scalar-value exclusion, private/unsafe keys, explicit
unevaluated stages, coercive IDs, mismatched/malformed echoes, invalid/duplicate IDs,
required names, recognized partial results, deep/wide/output limits and validation
beyond the projection limit. The separate156-case replay compares the unchanged
helpers/diagnostics without real networking.

Before a future operational approval, locally validate the new wrapper's exact
transport, output/encryption, gate, custody, marker, timeout, body-limit, interruption
and archive behavior with synthetic fixtures. Pin every final input. The earlier
consumed wrapper is not patched, retired or reauthorized by this proposal.

After separately approved capture, independently authenticate/archive the encrypted
schema report. Use complete reviewed field/type evidence and failing predicates to
choose a correction. Map an alias only if observed and justified; preserve required
fields, uniqueness, pagination and ownership checks. Provider-invalid rows need
clarification rather than silent filtering. If independent schema capture remains
insufficient, the [prepared PDC question](pdc-getproducts-schema-audit.md#exact-pdc-support-question--separate-owner-approval-required)
is the fallback.

**ONE next owner action:** review this proposal for a new, separately approved
schema-only diagnostic. No request, staging or production change occurred here.
