# Catalog transfer validation — 2026-10-14

Authorized baseline: `4297aef6869ca05953214aa8bbc7a0b9e0fc3f74`.
Historical Task 6A evidence. Authorized Task 6B application and current acceptance
are documented in [Approved catalog import](catalog-import.md) and
[Task 6B validation](catalog-import-validation.md).
Contract: [Catalog transfer](catalog-transfer.md).
Evidence: `/Users/imac/Documents/ELcomputer/product-manager-task6a-review-20261014`.
Only accepted final logs/reports count. Earlier diagnostics and stopped regression
runs before the database/parser review are excluded.

## Focused acceptance

`tests/catalog-transfer.test.mjs`: **36 checks pass**, no failures, skips or
cancellations. Real local HTTP guards, filesystem checks and executable SQL cover:

- CSV/XLSX exports and empty-product templates with current reference lookups;
  Arabic, exact IDs, leading-zero SKUs, decimal precision, protected text,
  literal apostrophes/markers, omitted fields and explicit clearing.
- Actual unchanged/create/update/conflict/invalid classification, exact product
  IDs, per-product revisions and related-record hashes. Parent and active-option
  validation, missing taxonomy references, duplicate SKUs/slugs and read-only
  option-price overrides. Alias-only relationship changes remain unchanged.
- Legacy aggregate option limits and historical unassigned gallery references;
  the latter fixture recreates a pre-guard NOT VALID constraint state only in
  its owned database. No application guard or historical migration is changed.
- Unsafe prices/integers, malformed UTF-8/CSV/headers/version, numeric SKU cells,
  oversized uploads and bounded product/row/cell structures. Oversized saved
  product/reference fields fail before large JSON allocations.
- Workbook formulas, external relationships, DTD/entity content, macro parts,
  hidden/unsupported sheets, duplicate cell values, bad nesting, oversized
  dimensions, unsafe phonetic/shared-string structures, corrupt CRCs, symlinks,
  hidden ZIP bytes and declared inflation overflow. Shared rich text preserves
  its exact value rather than concatenating phonetic annotations.
- Explicit and embedded missing/unsafe media, private Storage URLs, traversal,
  deleting image states and preserved existing gallery relationships.
- Owner/editor/viewer, unauthenticated/customer/disabled staff and revoked named
  permissions. Viewers can export without preview or mutation permission.
- Full business-row, revision, media-state, audit and receipt snapshots remain
  unchanged across exports/previews. Actual native READ ONLY transaction execution
  proves the snapshot does not write. Native non-superuser migration execution
  preserves all existing function bodies/configuration/grants and adds only two
  functions. Actual PostgREST is primed before 77; 77 alone reloads the new RPC,
  which is denied to anonymous and authenticated staff JWTs and allowed only to
  service_role after active named staff authorization.
- A native 10,000-product fixture exports an exact one-product match and a
  250-product filtered boundary, rejects unbounded export, and preserves all rows.
  `performance.json` records final timings; these are local fixture measurements.

An independent **openpyxl 3.1.5** reader/writer verifies exported XLSX text cells,
Arabic, leading-zero SKU, exact money and formula-like text through a resave and
our parser. It is temporary validation tooling, not an application dependency.
No native Microsoft Excel or hosted acceptance is claimed.

## Final regression and build

The final full suite passes **1,054/1,054**, with **zero failures, skips or
cancellations** (`845,758.997701 ms`, approximately 14.1 minutes). The accepted
`regression-final.log` runs the actual current tests against the sealed build.
Earlier stopped runs and diagnostics are excluded.

Node **22.23.1** typecheck and production build pass using an empty dotenv and a
minimal environment, with no real provider/database credentials. Existing Nuxt/
Supabase missing-configuration, duplicate ERP auto-import and source-map/target
warnings remain non-fatal. **582 compiled input hashes** match the checkout;
the final migration manifest verifies all **76** historical migration hashes and
the additive 77. `git diff --check` passes. Final JSON summaries and the native
10,000-product measurements are stored with the accepted evidence.

## Browser acceptance

Chrome uses actual Vue components, Vue Router, existing built CSS, real local H3
handlers, owned files/native PostgreSQL and PostgREST. Auth verification/claims
and surrounding Nuxt/ERP state are synthetic; warranty UI data is mocked and its
SQL/HTTP rules are checked separately. These are local fixtures, not hosted proof.

| Suite | Assertions | Screenshots |
| --- | ---: | ---: |
| Catalog transfer | 117 | 27 |
| Product listing | 168 | 27 |
| Safe bulk operations | 202 | 30 |
| Draft-first editor | 177 | 36 |
| Atomic save/conflict/retry | 185 | 36 |
| Media safety | 204 | 36 |
| Warranty/UI | 615 | 96 |
| Total | 1,668 | 288 |

Reports show no unexpected browser errors and no external requests. Existing
save/editor/bulk suites deliberately lose four responses to verify recovery;
those expected transport errors are identified in their reports.

Transfer acceptance covers actual selected/current-page/filtered downloads in both
formats, templates without dummy products, no Apply control, unchanged/update/
invalid/conflict feedback, source input cleanup, specific XLSX long-field errors and lossless CSV fallback,
cancellation/late responses,
locked selection during preparation, viewer-only export and server denial after
staff revocation. The full EN/AR, RTL, 390/768/1440 and Light/Dark/System matrix has
no page overflow. Valid reference rows are counted without filling the preview.

Review screenshots in `browser/` include `en-1440-light-preview.png`,
`ar-390-dark-preview.png`, `en-390-field-errors.png`, `en-390-conflict.png`,
`en-390-viewer-export.png` and `en-390-revoked.png`.

## Restrictions and limitations

No production, hosted database, VPS or provider access/activation occurred.
Migration 77 was used only in disposable databases; migrations 1–76 retain their
baseline SHA-256 values. Frozen installer/Quick Setup artifacts remain unchanged.
The installer is certified through 71, while development has 72–77; installation
and release certification require separate authorization.

Source files/results are temporary in-process state, with no resumable staging or
apply token. Export output can reach 8 MiB while preview upload is limited to
4 MiB; reduce export scope when needed. Reference lists over 1,000 and unsupported
workbook features fail explicitly. CSV counts every union-header cell, including
blanks, so its preview cell cap can be reached sooner; use XLSX or reduce scope. Remote image availability is not fetched.
Preview/permission/media/revision observations can become stale; future apply must
revalidate under transaction locks with named access, audits and retry receipts.
Task 6B is not implemented or authorized by a successful preview. Exact remaining
work is enumerated in the contract. Stop after Task 6A commit/push for review.
