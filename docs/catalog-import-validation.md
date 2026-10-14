# Task 6B local validation — 2026-10-14

Baseline: `d112639662366e89f405b03f4ad993419dc1426c`.
Contract: [Approved catalog import](catalog-import.md).
Evidence: `/Users/imac/Documents/ELcomputer/product-manager-task6b-review-20261014`.
Only newly owned synthetic actors, files, tokens, databases and loopback services
are used. No production/hosted/VPS access or provider request occurs.

## Focused coverage

`tests/catalog-import.test.mjs` exercises actual import HTTP guards/handlers and
SQL, the existing product save service, filesystem and procurement fixtures:

- Empty catalog creation, explicit active warehouse selection and Draft defaults;
  separate publication approval and existing publication validation.
- CSV/XLSX identity, Arabic, leading-zero SKUs, omitted fields, null/empty text,
  exact UUID/revision matching, variants/specifications/gallery and file-local
  option relationships. Related-only updates preserve existing product fields.
- Rejected price, unknown inventory headers, missing references, arbitrary remote
  media, protected public upload sections and altered/reused review IDs.
- Simultaneous administrators and genuinely independent SQL processor connections;
  revision/complete-related-graph conflicts, ordinary-writer SKU claim races,
  current permission revocation, session/actor isolation and ERP mode changes.
- Atomic rollback after related-row/audit failure; a dropped HTTP response after
  actual commit; persistent receipts, duplicate files and concurrent processors.
  Explicit retry reviews exclude every committed parent product.
- Bounded partial processing, cancellation, expiry and exact five-way counts.
  Genuine procurement fixtures prove physical units, stock, costs, warehouse
  balances and operational fields remain unchanged during merchandising updates.
  Options with physical history cannot be deactivated. Deletion reservations
  made after review cause failure instead of broken image references.
- An actual non-superuser applies migration 78 without changing existing function
  bodies/configuration/ACLs, table grants/RLS or Storage ownership. Private ledgers
  deny direct table access, including service_role. PostgREST is primed before 78;
  78 alone reloads service RPCs. All browser/customer/anonymous roles are denied
  direct RPC/ledger access. Incompatible transaction isolation is rejected.
- A 10,000-product fixture applies 250 new products in 50 requests of five,
  preserving the entire previous catalog and creating no physical stock.

Final focused import run: **30/30**, zero failures/skips/cancellations,
`import-final.log`, including the reactivated-option price projection. All **8**
localization checks also pass. The earlier 49-result import/bulk run passes; final
full regression follows the last SQL correction and navigation changes.

## Final build and regression

Final Node **22.23.1** secret-free typecheck and production build pass with an empty
dotenv file. Existing missing Supabase-key, duplicate ERP import, source-map and
BigInt target warnings remain documented; no runtime dependency or lockfile change.
All **589 compiled input hashes** match the sealed checkout/build. Only the historical
publisher fixture copy omits its three legacy branding assets; original public
assets and frozen installer artifacts remain unchanged.

**1,084/1,084 full regression passes**, zero failures, skips or cancellations
(`regression-final.log`, 830,883.713176 ms, approximately 13.8 minutes). All native
PostgreSQL/PostgREST/Supautils tools are enabled. `validation-summary.json` retains
accepted results. The 10,000-product fixture applies 250 products in 50 requests
in **7,663 ms**, preserves every original catalog row and creates no physical units;
this is a local fixture measurement, not a hosted throughput guarantee.

A separate empty-store acceptance (`empty-store.json`) removes all categories,
brands, specification definitions and suppliers, then imports one Draft using an
explicit active warehouse. All optional assignments remain null; taxonomy and
physical-unit tables remain empty. No demo data or inferred assignment is needed.

Migration 78 SHA256:
`ae5e86e81ef76722ce9e6c9b8e4bff69f00289b99bf8257f94b681281658caf4`.
All **77 original migrations** match baseline SHA256 hashes. Migration 78 is used
only in disposable local databases. The certified installer remains **1–71**, while
development **72–78** still needs separately authorized certification.

The independent **openpyxl 3.1.5** reader/writer also passes Arabic, exact price,
leading-zero SKU and formula-like text round trips. Synthetic XLSX review artifacts
are retained in this task's evidence directory; application source uploads are not.
This does not certify native Microsoft Excel or arbitrary workbook features.

## Browser acceptance

The actual Import/Export working page and reusable transfer component run in Chrome
with real Vue Router/history, actual HTTP/native PostgreSQL and PostgREST, filesystem
media and built application CSS. Hosted Auth verification/JWTs and the surrounding
Nuxt/ERP/secondary-navigation shell are synthetic. This is local acceptance.

All seven suites pass **1,691 assertions / 294 screenshots**, with zero unexpected
errors or external requests. Five acknowledgements are deliberately dropped and
recovered; those transport errors are counted separately.

| Suite | Assertions | Screenshots |
| --- | ---: | ---: |
| Import/export | 140 | 33 |
| Listing | 168 | 27 |
| Bulk | 202 | 30 |
| Editor | 177 | 36 |
| Product saves | 185 | 36 |
| Media | 204 | 36 |
| Warranty/UI | 615 | 96 |
| Total | 1,691 | 294 |


The import matrix covers EN/AR, RTL, widths 390/768/1440 and Light/Dark/System;
compact Products controls, explicit selected-page exports/templates, unchanged
preview without business writes, explicit confirmation, publication intent,
invalid rows, concurrent changes, revoked staff, same-route export-count refresh,
a dropped five-product acknowledgement, reload/reupload and resuming only the two
remaining products. Completed duplicate files return the original receipts.
Browser storage contains receipt metadata only. External requests are blocked.

Representative screenshots in `browser-final/`:

- `en-1440-products-compact.png`
- `en-1440-light-viewport.png`
- `ar-390-light-viewport.png`
- `en-1440-create-confirmation.png`
- `en-1440-partial-results.png`
- `en-1440-complete.png`
- `en-1440-publish-confirmation.png`
- `en-1440-invalid-row.png`
- `en-1440-conflict.png`

Earlier diagnostic logs are excluded from final acceptance: an initial fixture
setup duplication, a recovered-review SQL alias, raw-versus-semantic test data,
text selector timing, and a launcher shell stripping native library variables.
Two superseded full runs were stopped for same-route count refresh and the
reactivated-option price projection. The final build was resealed, all import
checks rerun and the complete suite restarted. The six unchanged browser
suites retain identical component inputs and byte-identical CSS across that fix;
the import browser is rerun against the corrected working page.

## Remaining BETA boundary

- Hosted Auth/Storage, workload/locking, actual merchant spreadsheets and native
  Excel acceptance remain separate. No provider, production or deployment claim.
- Static `/images/` references require the corresponding real `public/` file at
  runtime. Hosted/output-only acceptance of those paths remains unverified.
- Files are bounded and must follow the versioned contract. New-product payloads
  retain the existing save service's 200,000-byte JSON limit. Commit validation
  may reject data even after a previously valid review, with per-product results.
- Processing is browser-driven, five products per request. Resume requires the
  same file and current access before 45-minute expiry. Failed/expired products
  require a fresh review; original keys/IDs must remain for retry scope.
- Recovery handles are actor-scoped and tab-local. There is no cross-device job
  search or background worker. Minimal ID/hash receipts persist for idempotency;
  no source file or authored accepted field values are retained in the ledgers.
- Direct OS/restores and separately guarded System Reset remain outside the media
  deletion protocol. Existing merchant media is neither deleted nor rewritten.
- Installer certification through 71 does not cover development 72–78. Frozen
  artifacts, Quick Setup and Phase 4 are unchanged.

Stop after Task 6B commit/push for review. Do not begin another feature automatically.
