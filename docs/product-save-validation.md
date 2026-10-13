# Product Manager Task 1 validation — 2026-10-13

Authorized development baseline: `ecc31985836a1e5dc81d3213d43d55da1fb69f64`.
Implementation contract and operating limits: [Product save safety](product-save-safety.md).
Only existing product creation/editing reliability is implemented. No production,
hosted project, provider, import/export, bulk action or Quick Setup development
is included. Stop for review after commit/push.

## Accepted checks

| Check | Result | Evidence boundary |
| --- | --- | --- |
| Complete regression | 960 passes; 0 failures, skips or cancellations | Node 22.23.1; concurrency 3; all native fixture tooling enabled |
| Focused product suites | 39 passes included in the complete suite | Validation 5; database 18; HTTP 7; native concurrency/ownership 8; PostgREST 1 |
| Typecheck | Pass | Empty dotenv and minimal environment; no hosted configuration |
| Nuxt production build | Pass | Node 22.23.1, empty dotenv, no provider credentials |
| Output inventory | 1,042 entries | Immutable software fixture output, complete hash/mode/link and secret checks |
| Product save browser | 185 assertions, 36 screenshots | Actual forms/composable, built CSS, actual H3 routes and disposable native SQL |
| Existing warranty/UI browser | 615 assertions, 96 screenshots | Existing broader product, checkout, procurement/inventory and warranty fixtures |
| Original migration preservation | All 71 SHA-256 values unchanged | Exactly one new SQL file: migration 72 |
| Scope preservation | Original functions/policies/grants and frozen engines/bundles unchanged | Populated upgrade snapshots and Git comparisons |

The product browser covers EN/AR, RTL, widths 390/768/1440 and
Light/Dark/System. It tests actual create/edit, double submission, translated
validation, native commits with deliberately discarded responses, receipt recovery,
cache refresh, an expired session during retry, conflicts, discard cancellation,
confirmed reload and viewer controls. Only the two deliberately dropped responses
produce expected network errors; expected validation/auth/conflict HTTP errors are
handled. There are zero unexpected page/console errors or external browser requests.

Native SQL tests use PostgreSQL 17.11 independent service-role connections and
real lock barriers. A separate non-superuser `postgres` fixture with actual
Supautils proves migration 72 can install and execute under the managed-style
ownership boundary. Actual PostgREST 16.4 tests grant exposure, service-only RPCs,
effective actor permissions, repeat receipts, storefront visibility and existing
confidential column grants.

Database acceptance includes failure after inserting/updating the product,
definition failure, failed audit insertion, deferred gallery constraints, existing
SKU/URL uniqueness, inventory Procurement receipts, legacy primary-warehouse
quantity deltas, Daftra ownership, authorization revocation, direct catalog edits,
stale administrators and concurrent same-request creation. Guarded catalog/full
reset regressions pass; retries cannot recreate products removed by those resets.

## Reproduction and retained evidence

Local evidence is outside Git at
`/Users/imac/Documents/ELcomputer/product-manager-task1-review-20261013`.
It contains build/typecheck/test logs, original migration hashes, browser reports
and screenshots, and immutable secret-free software fixture copies.

Native tools are the existing SSL-capable PostgreSQL 17.11 binaries, PG driver,
Supautils library, PostgREST, Auth/Storage and PM2 fixture tools documented in
[publication validation](application-publication-validation.md). The Email and
Paymob PG variables point to executable tools, never an existing database URL.
Supply `PUBLICATION_REVIEW_OUTPUT` as an independently prepared immutable build
copy; do not rebuild that output while a regression fixture reads it.

```sh
NODE_OPTIONS=--import=./tests/helpers/keepTestProcessAlive.mjs \
  node --test --test-concurrency=3 tests/*.test.mjs
node scripts/product-save-browser.mjs
node scripts/warranty-browser.mjs
npm run typecheck -- --dotenv /absolute/path/to/empty.env
npm run build -- --dotenv /absolute/path/to/empty.env
```

Run with Node 22.23.1 and the explicit native/browser tool environment described
above. Every database/server is created and disposed by its fixture on loopback.
No production dotenv, linked Supabase project or hosted credential is read.

Initial development runs caught SQL variable ambiguity, a new FK blocking reset
preflight, an incorrect fixture quantity seed, a non-SSL tool selection and a
build/output read race. These were corrected before acceptance. Failed runs are
retained as diagnostics and are not included in the accepted totals. Existing
empty-Supabase notices, duplicate `getErpSettings` import and preorder BigInt
target warnings remain unchanged.

## Acceptance limits

Product browser hosted Auth verification, Nuxt shell and unrelated media/SEO
controls are fixtures. Native browser/SQL/HTTP checks do not certify real hosted
Auth sessions, a deployed migration or real provider transactions. No production
or hosted acceptance is claimed.

The frozen installer remains certified for migrations 1–71 and deliberately
rejects a source containing 72. Its historical regression fixtures preserve that
boundary; no installer source, certified bundle or production helper is changed.
Migration 72 needs reviewed application to an approved target before releasing
these product APIs. A later fresh-install certification is separately authorized
work, not part of Task 1.

Gallery, specification and file-upload saves retain their existing separate
transactions. Only core product fields and variant definitions share the new
transaction. Session storage retains only the request UUID, so a page reload
can lose unsaved typed values; completed saves remain recoverable without a
duplicate product.
