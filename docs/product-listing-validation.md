# Task 4 local validation

Baseline: `338f41752d8638b5ba61de8326778b78540f34be`.
Evidence: `/Users/imac/Documents/ELcomputer/product-manager-task4-review-20261013`.

Only newly owned synthetic actors, tokens, files and disposable loopback databases
are used. No production/hosted/VPS access, provider request or merchant-media
change occurs. Synthetic cash/ERP settings permit existing reservation test data;
application settings, payment/ERP behavior and real providers are unchanged.

## Focused coverage

`tests/product-list.test.mjs` checks actual listing HTTP handlers, SQL and guards:

- English/Arabic title search, leading-zero/case-preserved product SKU, option SKU
  and code, inactive historical definitions and literal wildcard characters.
- All **324** publication/category/brand/mode/stock filter combinations, six
  deterministic sorts, UUID ties, disjoint pages, exact totals and page clamping.
- Genuinely empty products, filtered/search misses, strict/duplicate/unknown query
  inputs, bounded filter choices, Arabic category lookup and later selected names.
- Owner/editor/viewer reads; customer, revoked, unrelated and unauthenticated
  denial. Costs, supplier/warehouse/unit identifiers and SQL errors stay private.
- Built-in primary-warehouse and active-option stock; exclusion of damaged and
  other-warehouse units; Daftra missing cache, reservations and physical cap;
  historical legacy aggregate/cache stock. No inventory writer is changed.
- Migration execution by an actual non-superuser. Every public row, table/view
  ACL/RLS/policy and existing public/private business function stays unchanged.
  An already installed public-schema pg_trgm retains its namespace/version/OID.
- Actual PostgREST direct-RPC denial and storefront draft/confidential-column
  restrictions. A pre-75 cache is primed, then **75 alone** reloads new RPCs.
- A 10,000-product native catalog returns at most 25 rows and bounded JSON.
  Actual query plans demonstrate title/option-SKU GIN index use after normal
  VACUUM/ANALYZE of bulk synthetic data. `performance.json` records measurements.

Accepted focused run: **83/83 passes**, zero failures/skips/cancellations,
`security-focused-final.log`. It includes the 12 listing results, existing
product-save/editor/media protection and eight localization checks. After adding
only the schema notification, all **12/12** listing/migration results pass again
in `list-migration-final.log`. The final full suite includes these contracts.

The unchanged application compiled inputs pass Node22.23.1 secret-free typecheck
and build (`typecheck-final.log`, `build-final.log`). Existing missing-key warnings
are intentional for secret-free builds; duplicate ERP import and BigInt target
warnings are historical. No JavaScript dependency or lockfile change is made.
All **567** sealed compiled input hashes match. The immutable final build is
`compiled-final/build-source/.output`; only the historical publisher fixture copy
omits three old branding assets, leaving original public assets untouched.

## Final regression

**996/996 passes**, zero failures/skips/cancellations, `regression-final.log`
(728,166.747 ms). All optional native PostgreSQL/PostgREST/Supautils tools were
enabled. This accepted complete run follows the migration notification fix;
the earlier stopped run is diagnostic. `validation-summary.json`,
`browser-summary.json`, `compiled-inputs.json` and `migration-preservation.json`
retain final results. Migration75 SHA256:
`a05357c015651005746cad6fb496a9ec7c0308acefb5ed45ee635d4b3d084ca8`.

## Browser evidence

`scripts/product-list-browser.mjs` compiles actual listing/filter, editor, variant,
warranty, specification, SEO and media components with built CSS. Actual Vue
Router/reactive routes and Chrome history handle query changes and editor returns.
Listing/core saves use actual HTTP/native PostgreSQL; sections use PostgREST/RLS;
media uses actual HTTP/filesystem/SQL. Auth verification/claims, surrounding Nuxt
and ERP state and the secondary-navigation shell are fixtures.

Accepted listing browser: **168 assertions /27 screenshots**, no errors/external
requests (`list-browser-final.log`, `list-browser-final/report.json`). EN/AR,
RTL, widths390/768/1440 and Light/Dark/System cover compact rows and translated
controls. Four viewport captures supplement the full-page matrix. Actual core
editing/Draft creation retain all filters/sort/page; browser Back/Forward is real.
Debounced requests and deliberately delayed real HTTP data verify generation
protection; one controlled transport ignores abort for this test. Empty catalog,
failed request, search/filter misses, oversized unexpected response, Arabic title/
option search, viewer controls and customer/revoked denial are checked.

Existing browser regressions also pass:

| Runner | Assertions | Screenshots | Evidence |
| --- | ---: | ---: | --- |
| Product editor | 177 | 36 | `editor-browser-final.log` |
| Atomic product saves | 185 | 36 | `product-browser-final.log` |
| Media safety | 204 | 36 | `media-browser-final.log` |
| Warranty/catalog/UI | 615 | 96 | `warranty-browser-final.log` |
| Task 4 listing | 168 | 27 | `list-browser-final.log` |
| Total | **1,349** | **231** | zero unexpected errors/external requests |

Three expected acknowledgements are deliberately dropped by the existing editor/
product-save runners. Their reports count those expected aborts separately.
Warranty browser Auth/API/Supabase are isolated fixtures; product/media/editor
reports identify their actual local HTTP/SQL and synthetic Auth/shell boundaries.

## Acceptance boundary

Local native SQL and Chrome evidence do not certify hosted Supabase Auth/Storage,
production accounts, real provider/ERP transactions or a deployed migration.
Available stock is a point-in-time checkout projection; separate pages can change
when catalog/stock changes. Title order uses database collation. Short/common
substring searches, stock-filtered exact counts and deep OFFSET pages need later
hosted workload acceptance. Transactional index creation may block catalog writes
while building; later migration/release scheduling needs its own review.

Migrations1–74 are byte-identical. Migration75 is development-only, applied solely
to disposable local databases. The frozen installer remains certified through
1–71; 72–75 installation/release certification remains separate authorized work.
Quick Setup/Phase4 and original installer engines/bundles/certificates are unchanged.

Diagnostic logs are retained separately and are not final acceptance: synthetic
fixtures violating existing active-option/unit/payment contracts; bulk GIN pending
lists before VACUUM; a browser fixture missing scoped-style IDs/reactive route
injection; a wrong test-only warehouse selector/unmatched-filter assumption; an
incorrect media script filename; and the stopped pre-notification full run.
Those checks caused fixture corrections or the necessary schema notification,
not weakened constraints, provider changes or modifications to merchant data.

Stop after Task 4 commit/push for review; do not begin Task 5.
