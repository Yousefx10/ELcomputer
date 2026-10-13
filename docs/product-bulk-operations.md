# Product bulk operations

Task 5 extends the Task 4 listing. Only Products editors (active Owner, or both
`products.view` and `products.edit`) can publish, move to Draft, assign an existing
category or assign an existing brand. Assignment requires an explicit existing
choice. There is no clearing operation. Delete, price, discount, cost, stock,
warehouse, variant, supplier, ERP ownership and import/export are excluded.

## Selection and confirmation

Selection contains only the current page, at most **25 products**. Each selection
captures the row's editorial revision from the same listing SQL snapshot. Missing
revision metadata disables selection; it is never replaced with zero. Search,
filters, sorting, pagination, refresh, browser navigation and actor changes clear
selection. There is no selection of all matching database products.

The existing table and compact mobile rows retain their typography, colors and
spacing. Checkboxes share the Product cell. A flat toolbar provides the count,
action, existing category/brand picker and Review changes. Assignment placeholders
say Choose rather than All. Confirmation states the count/action/reference;
Cancel performs no write. Filters and selection lock during confirmation. Once
submitted, an immutable batch cannot be cancelled as its commit may have occurred.
Progress describes the whole request; it never invents per-product progress.

Results give exact updated, unchanged, conflicted and failed counts plus each
product's outcome. Publishing may remove rows from a Draft filter; results remain
visible. The existing refresh/page clamp loads current data after acknowledgement.
Conflicts require reload and fresh selection, never automatic revision replacement.
EN/AR, RTL, responsive behavior and Light/Dark/System use existing components and
styling. Future UI tasks must preserve the standards in AGENTS.md.

## Sparse transaction and publication rules

POST `/api/admin-products/bulk` validates UUIDs, unique IDs, safe integer revisions,
a supported action, reference semantics, unknown fields and the 25-product bound.
GET accepts only `request_id`. Both verify the named Products permission and return
private/no-store responses. No full-form PATCH normalizer is used.

The service-only `catalog_bulk_products` RPC rechecks active staff permissions
under a share lock held until commit. It requires READ COMMITTED, serializes the
request UUID, locks existing reference rows against deletion and visits product
IDs in a stable order. Each product is locked and its revision checked before any
validation/no-op decision. Only `is_published`, `category_id` or `brand_id` is updated. Confirmed changed
batches invalidate the same Dashboard products/home caches as ordinary saves.
Products use the existing revision/audit records; no timestamp column is added.
No-ops leave revisions and audit counts intact.
Missing/deleted assignment references return terminal failed results for all
selected products and are receipted before acknowledgement. Restoring that
reference cannot turn a retry into a later write. Existing editorial revision,
validation, foreign-key and media triggers remain.
Inventory/ERP projection fields, options, images, galleries and specifications
are not rewritten. No changes to existing RLS or business-table grants are made.

Publishing validates the saved required title/slug/explicit monetary values,
SKU limits, selling/preorder constraints, active supplier/warehouse where needed
and saved active option definitions. Existing optional copy/images/category/brand
remain optional. Zero-stock normal products and scheduled/inactive preorders can
be visible under existing selling/availability rules; bulk publication does not
change these rules or activate selling modes. No content is invented or corrected.
An incomplete product fails even if already published; moving it to Draft remains
available. Legacy aggregate products retain their existing tracking behavior.

Each product update and existing `products.update` audit are in a nested SQL
transaction. Audit/constraint failures roll back that product and its revision;
other successful products remain in the batch. Audit metadata contains the batch,
field, previous/new value and revision; no cost or inventory values are exposed.
The receipt and all successful items commit in one outer transaction. An outer
failure (including receipt insertion) rolls back the entire batch. No committed
partial outcome is claimed before acknowledgement. SQL error details are hidden.

## Idempotency and recovery

The private `catalog_private.product_bulk_receipts` table records actor, canonical
payload hash and exact terminal results. Identical actor/command retries return
these historical results without repeating updates or audits, including failed
items. Product/order/reference/staff deletion cannot erase a receipt through a
foreign key. Request reuse with different inputs/actor is rejected. Current staff
permission is required for replay and status. Status can read only its actor's
receipt and waits on the same request lock. Direct receipt access is revoked from
PUBLIC, anon, authenticated and service_role; RLS is enabled with no policies.

Before submitting, the browser saves only request UUID, action, reference UUID
and product IDs/revisions in actor-scoped **sessionStorage**. No authored product
fields, SKU, price, cost, stock or confidential identifiers are retained. A storage
failure prevents submission. Unknown acknowledgements retain the exact command;
Check result or Retry this batch reconcile it. A missing receipt does not authorize
forgetting a request that may still arrive. Pending navigation is blocked and
reload restores recovery metadata. Actor changes ignore late responses and retain
the previous actor's recovery entry for reauthentication. Confirmation clears the
entry. Missing-reference receipts permit fresh review; any dispatched request
without a verified terminal receipt stays pending, including HTTP rejections. Revocation
keeps recovery pending until permission is restored; it cannot retrieve receipts.
Session storage is tab-local, with no cross-device recovery interface. Operators
must preserve an unresolved tab/session; deliberate storage clearing loses its
client recovery handle. Database receipts still prevent reuse of known requests.

## Migration and release boundary

Additive migration **76**, `20261013200000_product_bulk_operations.sql`, creates the
private receipt table, private authorization/publication helpers and two
service-only RPCs. It replaces only the Task 4 list RPC to add the opaque revision
from a LEFT JOIN in its existing row projection; signature, paging/search/stock,
fixed confidential projection and grants are preserved. Missing metadata remains
null. PostgREST receives its normal schema-reload notification after commit.
No business-data rewrite, provider activation or new dependency is required.
Migrations **1–75 remain byte-identical**.

The frozen installer is certified through **1–71**; development **72–76** needs
separate release/installation certification. Frozen engines, bundles and manifests
are untouched. Only disposable local databases are used here. Production, hosted
Supabase, VPS, providers and Quick Setup are untouched. Local synthetic Auth and
native/browser fixtures do not certify hosted authentication or real deployment.

Stop after Task 5 commit/push for review. Do not begin Task 6.
