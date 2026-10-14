# Approved catalog import

Task 6B extends [catalog transfer](catalog-transfer.md). It reuses the version 1
CSV/XLSX parsers, projections, preview validation and Dashboard components. No new
runtime dependency, provider, installer artifact or inventory writer is introduced.

## Review and approval

Products keeps compact export/template controls and a link to
`/dashboard/products/transfer`. The existing Dashboard secondary navigation also
links to this working view. Explicit selected UUIDs (maximum 25) and validated
listing filters travel in the URL; navigation never expands selection to all matches.
Exports retain the existing 250-product bound. Import review is independent of the
export scope: its exact scope is the Products rows in the uploaded file.

An import has at most 250 products, 2,500 related rows, 6,000 total rows and a 4 MiB
source. All earlier parser/cell/ZIP/output limits remain. The source stays in
request/browser memory, never filesystem, Storage, database or browser storage.
Only actor-scoped receipt metadata is stored in sessionStorage. Reloading requires
reuploading the reviewed file. JavaScript strings remain subject to ordinary GC.

Review reuses the read-only preview and reports creates, updates, unchanged rows,
errors/conflicts and field differences. Invalid/conflicted files cannot be staged
for approval. Blank new-product visibility defaults to Draft. Other omission,
`#CLEAR`, `#EMPTY`, literal escaping, exact IDs/revisions and related-hash semantics
are unchanged. New products require explicitly selected active warehouse UUIDs;
that selection applies only to new products. No supplier or other reference is inferred.

A private review lasts **45 minutes**. It binds the semantic file digest, actor,
warehouse, ERP mode, exact product/related scope, command hashes, revisions and
related graph hashes. Equivalent text CSV/XLSX files and reordered rows share a
source identity; spreadsheet cell types remain significant. The server issues the
review hash. Neither the client preview nor a supplied hash independently grants
write access. Recovered unapproved reviews must be previewed again; a changed
command/related graph is rejected. Approval requires a separate request and an
explicit confirmation. New publication additionally requires its own checkbox.

## Transactions and permissions

HTTP and service-only RPCs check active named Products.view plus Products.add for
creates and Products.edit for updates. Mixed reviews require both. Owner access
uses the existing model. Warehouse lookup returns only active UUID/name choices to
product creators, without requiring unrelated Settings/Inventory permission.
Receipts belong to one actor; other administrators cannot inspect or resume them.
Private ledgers have RLS enabled and no table privileges, including service_role.
Browser/customer/anonymous JWTs cannot invoke the service RPCs.

Each HTTP apply request processes **at most five products**, in **separate database
transactions**. A transaction locks the job, actor, ERP mode, product/revision,
existing related rows, relevant references and media paths. Permissions/revocation,
revisions, the complete related graph, approved command hash, active references and
publication rules are checked again at commit. READ COMMITTED is required. No
whole-catalog transaction or background worker is introduced.

Creation calls the existing atomic `catalog_save_product` and variant definition
service, initially Draft. Sparse existing-product updates deliberately bypass the
full-form normalizer and its legacy inventory reconciliation. Only approved
merchandising columns are assigned. Omitted variants/specifications/gallery rows
stay intact. New file-local variant keys resolve to IDs inside the same product
transaction. Options with physical-unit history cannot be deactivated. Related
constraints, active-option limits and gallery-parent guards remain authoritative.
A product-price change projects onto active serialized option prices, following
the existing save rule; option prices remain read-only file fields. Legacy option
prices are preserved. No stock/cost adjustments or balance/unit/history/supplier/ERP mapping writes
occur. New product/option rows use the existing zero-stock/cost defaults.

Product, variant, specification, image, audit and successful receipt changes commit
or roll back together. A failed product rolls back before its sanitized failure
receipt commits; siblings retain honest results. Related-only changes also advance
the product revision. Unchanged products create no product audit or catalog rewrite.
Existing publication validation applies, including selling/preorder modes and
operational references; imports never automatically publish incomplete products.

Migration 78 also serializes new/changed case-insensitive product SKU claims across
all writers. A lookup index keeps the check bounded in large catalogs. Existing
legacy duplicates are grandfathered for unchanged SKU writes; no identifier or
merchant row is rewritten. Existing slug and active-option SKU/code indexes remain.

## Media and confidentiality

No remote image fetch occurs. New explicit image references must be existing safe
public assets or uploaded images the current actor may browse. A structurally valid
arbitrary remote URL is insufficient. Existing unchanged external references can
round-trip. Protected public upload sections require their own permissions;
private Storage resources are excluded. Embedded managed references receive the
same filesystem, authorization and tombstone checks. New SVG uploads remain rejected
by the existing uploader; imports do not upload or sanitize images.

Immediately before each commit, the server rechecks no-follow file existence.
Commit-held media-path locks and the existing deletion/reference guards prevent a
concurrent deletion from creating broken references. A deletion reservation that
wins first causes that product to fail. No existing media file is changed or removed.
Direct OS/restore/reset operations remain outside the media endpoint protocol.

## Recovery and exact outcomes

Persistent private receipts contain IDs, hashes, timestamps and per-product
outcomes, never a source file, accepted field values, descriptions or prices.
Minimal receipt tombstones are retained for idempotency, as in Tasks 1/5; there is
no retained source requiring a cleanup worker. Expiry closes remaining pending
items and removes write authority. It never changes committed results.

Every status response has exact **succeeded, unchanged, conflicted, failed and
pending** counts plus individual outcomes. Duplicate processors serialize on the
job and replay terminal items. Duplicate file submissions recover the original job,
even after committed creates would now collide with their own identifiers. Reusing
a request UUID for another source, actor or warehouse is rejected.

A lost HTTP response leaves results unconfirmed. Check results waits for the
current product transaction; reupload/resume processes only pending items. Pausing
stops the browser loop and checks receipts; an in-flight server transaction may
finish. Cancelling remaining work locks the job and closes only pending items,
without undoing committed products. This also prevents a late worker from writing
another item. Permission/session failures preserve recoverable pending work until
expiry, provided access is restored.

Failed/conflicted products need a **new review and approval**, using “Review failed
products” and a reupload (corrected when needed). The parent must have no pending
items. Committed/unchanged parents are excluded; keys and target IDs must match a
failed/conflicted parent item. Revisions/hashes are never automatically rebased.
This supports transient-failure recovery without repeating committed new products.

## Delivery boundary

Migration **78**, `20261014180000_catalog_import.sql`, adds two private metadata
ledgers, private validation/locking helpers, service-only import RPCs and the SKU
claim trigger/index. Migrations **1–77 are preserved byte-for-byte**. Existing
function bodies, table grants/RLS and business rows are not rewritten. SQL is used
only in newly owned disposable local databases.

The installer remains certified through **71**; development **72–78** needs separate
installation/release certification. Hosted Auth/Storage/platform concurrency and
real merchant spreadsheet acceptance remain BETA gates. Local native SQL/browser
fixtures do not certify production or a hosted installation. No production/VPS,
provider, Quick Setup, Phase 4 or customer-facing work is part of this task.

Validation and screenshots: [Task 6B validation](catalog-import-validation.md).
Stop after Task 6B commit/push for review. Do not begin another feature automatically.
