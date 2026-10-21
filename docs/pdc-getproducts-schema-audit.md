# PDC GetProducts offline schema audit — 2026-10-21

**PDC schema STILL UNKNOWN. Exact rejection cause UNKNOWN.**

The subsequent [deep investigation](pdc-getproducts-deep-investigation.md) expands
the historical search and reproduces diagnostic/application differences. Its
[schema-only diagnostic proposal](pdc-getproducts-schema-diagnostic-proposal.md)
is now the recommended next step; the support question below remains a fallback.

The inspected evidence cannot establish the live row field names, their types,
or any company echo. No application correction is justified. Clarification must
precede development. The support question below is prepared, not sent.

## Evidence and its limits

| Source | Finding | What it establishes |
| --- | --- | --- |
| Supplied Courier Integration Test V4 and V4-1 PDFs, page8 | Both files have the same SHA256. The GetProducts example is an array with `id: number` and `name: string`; headers are AccessToken and CompanyID. No company echo appears in that example. | One documented example, already supported. Duplicate copies are not independent evidence of the current merchant response. |
| Supplied Webhook Integration and Webhook Integration-1 PDFs | Both copies have the same SHA256; neither defines GetProducts. | A separate callback protocol, not lookup evidence. |
| Three authenticated, previously retained WordPress evidence envelopes | Each contains the same PDC snippet hash. No GetProducts or GetCities reference occurs in any retained string. No option name identifies a PDC product/lookup cache. The snippet references shipment creation and status lookup. | Historical configuration and shipment integration; no authentic GetProducts response identified in these selected sources. |
| Current code, Git history and fixtures | The normalizer is unchanged from its introduction in `96f8bc3`; the later lookup change concerns disabled-provider access. Repository lookup fixtures and the eight previous replay cases are synthetic. | Existing behavior and possible failures, not live field aliases or production response types. |
| Already authorized capture analysis | The retained sanitized analysis records HTTP200, valid JSON and two top-level objects. No original row keys or values survived. Encrypted capture/final-receipt hashes still match the recorded pins. | Authentic outer shape and schema rejection, without enough row detail to identify the failing validation. |

The historical audit authenticated the three selected envelopes against their
ciphertext and plaintext receipt pins. Inspection stayed in memory. Output contains
counts and hashes only; no private code, settings, credentials or response values
were displayed or saved. This was not another archive-wide scan. It does not prove
that no other owner-held evidence exists.

The courier PDF SHA256 remains
`8f2f5ae3047fb72ef8aebe495a2f48e1501b27b4c2df951c40cf6638e05fb186`.
The webhook PDF SHA256 remains
`9386ff876642717be5514856c8b46056afdd444a0a0ac4995b539e76cd9d5c0d`.

## Why a correction cannot yet be chosen

[pdcResponseRows](../server/utils/pdcLookups.js#L40) already accepts the observed
outer array. [normalizePdcLookup](../server/utils/pdcLookups.js#L47) reads `id`/`ID`
and `name`/`Name`, requires unique positive 32-bit integer IDs, and applies the
[required-name guard](../server/utils/pdcTracking.js#L5). These accepted names
describe the implementation; they are not proof of the current live schema.

All 22 sealed bundle inputs still match their preparation hashes. The standalone
capture's broad catch covers normalization and subsequent company-echo conversion.
Its checked echo names are diagnostic assumptions, not evidence that PDC returned
those fields. A malformed echo can also produce `RESPONSE_SCHEMA_REJECTED`.
The absent echo flag cannot establish echo absence or locate the failure.

The [earlier analysis](pdc-getproducts-capture-analysis.md) already demonstrated
that several distinct synthetic failures produce the same retained projection.
Those cases were inspected, not rerun. The initialized `saved_product_matches:false`
still does not prove an incorrect saved Product ID. The original HTTP500 remains
separate and unexplained.

No alias, wrapper, row-filtering, account or credential change is proposed. Preserve
required ID/name checks, uniqueness, size limits, partial-pagination rejection,
selection checks and confidential errors. A later verified alias correction, if
needed, must map only the confirmed fields and retain these guards.

## Exact PDC support question — separate owner approval required

> Please confirm the current production response contract for
> `GET /api/ClientUsers/V6/GetProducts`. Your supplied Courier Integration Test V4,
> page8, shows an array with numeric `id` and string `name`. Our approved request
> returned HTTP200 and a valid two-object JSON array, but the retained diagnostic
> removed row keys and values, so we cannot identify the validation failure.
>
> Please provide JSON Schema or a values-free field/type table covering:
>
> 1. Exact field names and casing, JSON types, required fields and nullability.
> 2. Whether product IDs must be unique positive 32-bit integers, and whether zero,
>    duplicates or numeric strings are valid.
> 3. Product-name type, whether blank names are valid, and any length restrictions.
> 4. Any optional company echo: exact key, location, type and meaning. Does its
>    absence have any account-ownership significance?
> 5. Pagination, completeness limits and any partial-result metadata.
>
> Please confirm whether the current merchant integration differs from that example.
> Do not include credentials, account IDs, actual product IDs/names, contact details
> or raw account responses. No new API request or account change is requested.

**Minimal next action:** review this question for separate approval to contact PDC.
An existing authoritative, values-free account schema can satisfy the same gap.
No support message was sent, and no new diagnostic helper was prepared or staged.
Development is conditional on the clarified contract establishing a local mismatch.

## Verification and preserved boundaries

Started with a clean checkout at `af06c9a`. HEAD and the locally cached origin/main
ref matched; there were no unpushed commits against that ref. No fetch or remote
Git-state verification occurred. The pasted handoff's unpushed-state report was
therefore stale relative to the local refs, not proof of a new push this task.

Protected audit directory, outside Git, directory0700/files0600:

`/Users/imac/Documents/ELcomputer/pdc-getproducts-schema-audit-20261021/`

`AUDIT-RECEIPT.json` SHA256:
`9141002440ed92b4cc70885bee890cf8c4c76483aa53ab4679fe74cce14173a2`.
It binds the historical-audit script and sanitized results, PDF reference hashes,
22 unchanged sealed inputs and the prior capture/receipt pins. The audit used the
existing pinned Node22.23.1 for offline envelope authentication and local PDFKit for
PDF inspection. The live encrypted capture was not decrypted again.

Production connections, provider requests, diagnostic helper executions and production
changes were zero. Both consumed approvals remain consumed. No Test/Sync, shipment,
label, callback registration, activation, restart, deployment, migration, settings
edit or Git push occurred. Existing production release/schema and disabled gates
remain the accepted handoff baseline; they were not rechecked live.

Both handoffs are updated. Documentation links, scope and `git diff --check` passed
before commit. No application source changed; no application tests were
rerun for this documentation-only task.

## Roadmap retained

1. Resolve PDC connectivity; verify webhook registration, coverage and actual rates.
2. Perform controlled Paymob payment/callback acceptance.
3. Perform controlled PDC shipment, label and tracking acceptance.
4. Migrate WordPress identities, compatible login/reset, private profiles, phones,
   addresses and historical orders before unrestricted signup. Preserve Auth UUIDs,
   prevent duplicates and avoid new inventory, payment or financial effects.
5. Verify physical stock, shipping eligibility, email confirmation and first purchase.
6. Activate public checkout only after explicit owner acceptance.
7. Later: Brevo, Vodafone SMS, private VPS Support/Claims attachments, mobile/search/
   category UI, dark-theme images and banners.
