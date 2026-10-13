# Product Manager Task 4: listing and navigation

Authorized baseline: `338f41752d8638b5ba61de8326778b78540f34be`.
Only the existing Dashboard product listing, search, filters and return navigation
are changed. Task 1 transaction/revision/retry guarantees and Task 2/3 media,
draft-first, section-save and unsaved-input protections remain in place.

## Existing behavior and changes

The previous listing fetched nine large cards from `storefront_products`, searched
only titles, requested two separate publication counts, cached data for 60 seconds,
and retained only publication state in the URL. Search, sort and page were lost
when the operator returned from an editor. A failed request could coexist with an
empty-state message. Cards omitted SKU, brand, visibility, option count and stock.

The same route now uses a compact desktop table and readable mobile rows with
small thumbnails, authored titles/SKUs, stored category/brand names, selling price,
visibility, selling mode, available stock, active option count and existing actions.
Arabic categories use stored `name_ar` with canonical-name fallback. No catalog
content, descriptions, images or specifications are invented. Native selects,
existing PageIntro, secondary navigation, colors, typography, controls and surfaces
remain; no new charts, statistics cards, bulk controls or deletion feature.
EN/AR, RTL, themes and responsive behavior use the existing application adapters.
Future listing changes must keep these standards and respect `AGENTS.md`.

## API and security

GET `/api/admin-products/list` validates the authenticated active staff member and
named `products.view` permission using `requireAdminRequest`. Its service-only
`catalog_product_list` RPC independently checks the current active actor and
Products access. Owners, editors and product viewers can list; edit/create actions
still require their existing named permissions. Customers, inactive staff and
unrelated staff cannot list. Direct RPC execution by anon/authenticated is denied.

Responses have a fixed allowlist: ID, title, SKU, image, price, publication,
selling/tracking mode, category/brand names and IDs, aggregate available quantity
and active option count. Costs, suppliers, warehouse IDs, unit/serial details,
provider data and internal inventory records never enter the listing response.
Existing storefront views, grants, RLS and draft visibility are unchanged.
API errors omit SQL internals; responses are `private, no-store` with `nosniff`.

GET `/api/admin-products/filter-options` uses the same Products access boundary.
It returns at most 100 category or brand names and the currently selected name.
When there are more choices, a short search field finds later names, including
stored Arabic category names. A selected option survives beyond the first page.
No independent Categories/Brands management permission is granted by this read.

## Query, counts and navigation

- Literal, case-insensitive substring search covers title, product SKU and option
  code/SKU, including inactive historical definitions. `%`, `_` and backslash are
  escaped as text; no PostgREST filter-expression concatenation or dynamic ordering.
  Search does not stem Arabic, transliterate, remove diacritics or change authorship.
- Filters: publication, category, brand, normal/coming-soon/preorder selling mode,
  and positive/zero available stock. Optional missing relationships render a dash.
- Sort: newest/oldest, title ascending/descending, price ascending/descending.
  All six use a UUID tie-breaker; title ordering follows database collation.
- The fixed page size is 25. Filtered count, page rows, clamped page and unfiltered
  catalog count come from one SQL statement/snapshot. A removed last page replaces
  the current URL with the remaining last page. Changes to filters/sort/search
  reset to page one. Separate requests do not freeze a changing catalog snapshot.
- `q`, `status`, `category`, `brand`, `mode`, `stock`, `sort` and `page` live in the URL.
  Browser Back/Forward restores controls and requests the corresponding page.
  Editor/add links carry a validated local `returnTo`; Back, create-to-edit, save
  recovery and confirmed legacy-delete departure preserve it. Arbitrary external
  destinations and unrelated routes are rejected. Existing dirty guards still apply.
- Search debounces for 300 ms. AbortController cancels prior client reads and a
  generation check rejects older results even if a transport ignores cancellation.
  Leaving the listing clears its pending timer. Filter-option reads use the same
  cancellation/generation pattern. Browser read timeout is 15 seconds; server RPC
  transport timeout is 10 seconds. These are transport deadlines, not new DB
  configuration or an assurance about hosted query cancellation.
- The old list/stat cache is intentionally retired for this route: each entry,
  changed filter and Refresh rechecks current permissions and stock. No catalog
  snapshots persist in browser storage. Existing cache infrastructure/invalidation
  for product saves and other pages remains unchanged.
- Empty states distinguish zero catalog, unmatched search, unmatched filters and
  failed requests. Product creation links respect permission. No demo insertion.

## Availability and ownership

Available stock is a read-only projection of existing checkout rules. It is shown
separately from visibility and selling mode; it is not a promise a draft/preorder
is immediately purchasable. Checkout continues to validate and reserve stock.

Built-in tracked products count only `in_stock` units in the primary warehouse
whose option belongs to that product and remains active. Units elsewhere,
damaged/lost/sold units and inactive options do not inflate availability. Legacy
aggregate products use their existing stock projection. Daftra tracked products
sum the existing `erp_storefront_stock` results per active option, preserving
cached quantities minus reservations and the physical primary-warehouse cap.
Daftra legacy products use the existing product cache projection. Missing Daftra
cache stays zero. No ERP/inventory/procurement writer or provider behavior changes.

## Migration 75 and compatibility

`20261013180000_product_listing.sql` is additive: read-only service RPCs, a private
stock projection and eight indexes (title/SKU, option code/SKU, created ordering,
category/brand and available-unit lookup). Original migrations **1–74 remain
byte-identical**. No business-row rewrite, new business table, RLS/table-grant,
existing-function, provider setting or merchant-media change is made.

The trusted PostgreSQL `pg_trgm` extension provides substring GIN indexes. If already
installed, its namespace/version is preserved and operator classes are qualified
from its actual catalog namespace; otherwise it is installed in `extensions`.
This requires the normal migration owner's database CREATE privilege. See the
[PostgreSQL 17 extension/index documentation](https://www.postgresql.org/docs/17/pgtrgm.html).
No JavaScript dependency is added. The local PGlite test engine registers its already
installed pg_trgm module; native tests use PostgreSQL's matching contrib build.
Short/common search terms can be less selective. Exact counts, availability
filters and deep OFFSET pages still cost more as a catalog grows; hosted workload
and index installation time require later release acceptance. Index creation is
transactional with a five-second lock timeout; a failed migration rolls back.

The migration notifies PostgREST to reload its schema after commit, matching Tasks
1/2. An actual PostgREST test primes the pre-75 cache, applies 75 alone and confirms
the new service RPC becomes available.

The frozen installer remains certified through **1–71**. Development **72–75**
requires separate installation/release certification. Installer engines, bundles,
certificates and frozen deployment artifacts are unchanged. This task applies SQL
only to disposable local databases and performs no production/hosted/VPS access.

Stop after Task 4 commit/push for review; do not begin Task 5.

Task 5 adds current-page bulk controls and same-snapshot revision metadata. See
[Product bulk operations](product-bulk-operations.md); the Task 4 paging, stock,
confidentiality, localization and editor-return contracts remain in force.
