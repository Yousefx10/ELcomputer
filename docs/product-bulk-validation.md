# Product bulk validation — 2026-10-13

Authorized baseline: `07f4aaa8c54e907b2bc4252d15bf311f864dbcef`.
Scope and recovery contract: [Product bulk operations](product-bulk-operations.md).

Evidence is stored outside the repository in
`/Users/imac/Documents/ELcomputer/product-manager-task5-review-20261013`.
Only accepted final logs/reports count. Earlier diagnostics, including the stopped
pre-correction regression, are excluded. No production/hosted/VPS access or
provider activation occurred. No existing merchant rows or media were modified.

## Focused security and database acceptance

`tests/product-bulk.test.mjs`: **22 checks pass**, zero skipped/cancelled/failed.
Actual H3 handlers, existing request guards and executable SQL verify:

- Publish/Draft/category/brand, exact no-op and changed results, single-field
  writes, same-snapshot listing revisions and private/no-store responses.
- Optional fields remain optional; normal/coming-soon/preorder rules and zero
  stock remain intact. Daftra mode leaves ownership/projection fields untouched.
- Incomplete saved records, NaN price, invalid slug and SKU control characters
  fail publication; hiding stays available. Legacy aggregate stock/options are
  preserved and an assigned inactive warehouse prevents publication.
- Unsupported/ambiguous fields/actions, duplicate/invalid IDs, non-integer or
  unsafe revisions, empty/oversize batches and absent references are rejected.
- Mixed succeeded/unchanged/conflicted/failed results, per-product audit failure
  rolling back update/revision, and outer receipt failure rolling back all writes.
- Lost HTTP response after actual commit, immutable replay after later edits,
  same UUID reuse rejection, actor-only receipts, viewers/customers/disabled/
  unauthenticated users and revoked permissions.
- Native independent-session lock barriers prove competing administrators,
  simultaneous retry serialization, revisions rechecked after an editor commit,
  staff revocation and category deletion ahead of the operation. Restoring a rejected reference
  cannot turn an original failed batch into a write on replay.
- Actual PostgREST is primed before 76; applying 76 alone reloads the new RPCs.
  Anonymous and authenticated staff JWTs cannot invoke service-only RPCs or read
  the receipt table. Native non-superuser execution preserves all business rows,
  public table grants/RLS and keeps receipt access revoked, including service_role.
- A native 10,000-product fixture changes exactly the selected 25, preserves
  variant rows and returns a bounded response. Final timings are recorded in
  `bulk-performance-final/performance.json`; they are local fixture measurements.

Legacy fixture seeding uses the existing inventory-write GUC only to represent a
historical aggregate product, restores it before testing and never modifies runtime
guards. Native fixtures own fresh loopback PostgreSQL clusters. Authentication
verification/claims are synthetic; no hosted credentials or databases are used.

## Final verification

Chrome acceptance passes **1,551 assertions / 261 screenshots**, with zero
unexpected errors or external requests: bulk **202/30**, listing **168/27**, editor
**177/36**, product saves **185/36**, media **204/36**, warranty **615/96**. Bulk/editor/
product-save deliberately drop four acknowledgements in total; each recovery is
checked separately. The bulk browser verifies the ordinary Dashboard products/home
cache invalidation after acknowledgement. **Full regression: 1,018/1,018 pass**, zero failures, skips or cancellations
(1,374,802.925441 ms). Typecheck and build pass with **572 sealed input hashes** matching final source.
Migration 76 SHA-256: `9ffa8745cc09cf1fb09a4453611c006756ab62fe53431b795bebddaa1868f145`.
The final native 10,000-product bulk fixture updates exactly 25 in **36 ms**,
returns **2,507 bytes** and preserves all variant rows; this is local performance,
not a hosted service guarantee. Typecheck and the build use Node 22 with an empty dotenv file. Build
inputs are sealed and checked against current tracked source. Migration hashes
verify that **1–75 remain byte-identical**, with only additive 76 present.

`scripts/product-bulk-browser.mjs` compiles the actual listing/filter/bulk
composables, uses actual Vue Router/Chrome session storage, H3 product/list/media
handlers, native PostgreSQL and PostgREST. It covers EN/AR, RTL, 390/768/1440 widths
and Light/Dark/System, current-page selection, count, deselection, filter/sort/
refresh/page/history clearing, confirmation/cancellation, duplicate confirmation,
all four actions, conflicts, incomplete products and a mixed batch with all four
outcomes. A deliberately dropped acknowledgement after a real SQL commit proves
reload/status recovery. Missing receipts, including an HTTP rejection without a terminal result, retain
the immutable command and block
navigation until retry. Deleted-reference failures show a clear message and remain failed after restoring
the reference and retrying the exact request. Viewer/revoked staff are denied. External requests are
blocked and unexpected browser errors must be zero.

The surrounding Nuxt shell, hosted Auth verification/JWTs, secondary navigation
and ERP shell are fixtures. Product forms, editor sections, media controls and
listing are actual components. Existing product-save/editor/media/list/warranty
browser scripts provide regression evidence; fixtures are not hosted acceptance.
The editor browser script now retires an unused one-shot dialog listener before
registering the next response, preventing two fixture handlers from acting on one
dialog. Its existing 177 assertions and application editor logic are unchanged.

## Remaining boundary

The batch limit is 25 and selection is current-page only. Failed/conflicted
products need reload, review and a new batch; retries retain the original terminal
partial results. Recovery is actor-scoped and tab-local; no cross-device receipt
search/retention policy or background job is introduced. Unknown requests cannot
be cancelled after submission. Hosted workload/locking/real Auth acceptance remains
separate. There is no claim of providers, production, hosted installation or deploy.

The frozen installer certifies **1–71**; development **72–76** requires a separate
release-certification task. Installer artifacts are unchanged. Stop after Task 5
commit/push for review; do not begin Task 6.
