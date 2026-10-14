# Catalog export and import preview

Task 6A provides export/templates and a read-only preview endpoint. Authorized
Task 6B adds a separate approved reupload/apply flow in a dedicated working view.
See [Approved catalog import](catalog-import.md) for its transaction/recovery
contract. Export selection and the main listing remain compact.

## Access and scope

Products.view permits CSV/XLSX export and templates. Preview additionally requires
Products.add or Products.edit. Each proposed row also checks the corresponding
create/edit permission. Active owner access follows the existing model. HTTP
Auth/profile guards and the database both verify named permissions. Staff JWTs,
anonymous users and customer JWTs cannot execute the service-only snapshot RPC.

Selected export uses explicit UUIDs from the current page, at most 25. Selection
clears on list refresh, filtering, sorting, pagination and navigation. Viewers
can select for export without gaining bulk mutation controls. Filtered export
uses the existing listing filters, with at most 250 matching products. It fails
when the scope is larger; it never truncates a larger catalog silently. Preparation
locks listing controls. Commands capture scope/IDs before awaiting Auth; cancellation,
unmounting and actor changes discard late results. Browser storage holds no source.

## Version 1 data contract

`elcomputer_catalog_1` uses stable ASCII machine headers. XLSX contains eight
sheets: Products, Variants, Specifications, Images, Categories, Brands, Definitions,
and Guide. CSV represents the same tables as UTF-8 BOM rows with a `record_type`
column and a fixed union of their headers. The canonical headers and bilingual
required/optional guidance live in `server/utils/catalogTransferContract.js`.
Templates contain empty product/related tables, current reference lookups and EN/AR
instructions. There are no dummy products, copied merchant fixtures or invented copy.

Products export IDs, expected revisions, read-only tracking mode, title, slug/SKU,
authored descriptions, category/brand UUIDs, prices, selling/publication fields,
warranty, colors, SEO and supported image references. Variants export identity,
expected hashes, option definitions and **read-only** existing price overrides.
Specifications export definition UUIDs, authored labels/values/order/highlight.
Gallery images export URLs, alt text/order and variant relationships. Costs,
quantities, suppliers, warehouse IDs, ERP ownership, customer records and credentials
are excluded. Only internal availability booleans are used to flag operational
readiness; these do not enter exports or returned preview fields.

Existing products match **only by product_id**, with an exact expected_revision.
Blank product_id describes creation, with a unique file-local product_key.
SKU/slug collisions cause errors; they never select another product. No fuzzy
matching, slug generation, trimming, rounding or automatic category/brand selection
occurs. UUID case and money decimal display are canonical representations of the
same values, rather than repairs of invalid input.

Existing related rows require their exact ID, parent and expected_hash. New related
rows use file-local entity_key; image variant_key references an active option's
entity_key under the same parent. Omitted related rows never delete anything.
Hash projections include merchandising state, including read-only option prices;
stock/cost changes do not become editable file fields. Legacy stock-tracked option
changes and clearing assigned image variants are rejected. Historical unassigned
image rows can round-trip unchanged.

Blank cells omit a field. `#CLEAR` explicitly clears nullable fields; `#EMPTY`
means empty text. A literal leading `#` is doubled. CSV protection prefixes an
apostrophe to dangerous or numeric text; a literal leading apostrophe is doubled.
The parser removes exactly one transport escape. Quoting alone does not protect
formulas. XLSX exports every value as an explicit text cell, including identifiers
and decimal prices. Keep identifier/SKU cells as text while editing. Numeric SKU
cells fail validation because lost zeros cannot be reconstructed safely. Prices
allow only the existing nonnegative, bounded decimal contract, at most two places.
Variant-price edits fail as read-only.

## Private bounded parsing

Source uploads are raw request bytes, not public media. Auth runs before reading.
The request is capped at 4 MiB even without Content-Length, with a 15-second read
timeout. No source is written to filesystem, Supabase Storage, database or browser
persistent storage. The source buffer is cleared in finally; preview result state
is in memory and cleared on closing/actor change. The raw Task 6A preview creates no staged handle. Task 6B stores only expiring
review metadata and durable minimal receipts; it retains no source. JavaScript strings are
managed by GC; this is not a claim of guaranteed secure memory erasure.

Limits are enforced cumulatively; the first limit reached wins:

| Resource | Limit |
| --- | --- |
| Selected export / filtered export / preview products | 25 / 250 / 250 |
| Related rows combined | 2,500 |
| Category, brand or definition references, each | 1,000 |
| Rows / columns / cells | 6,000 / 64 / 100,000 |
| CSV cell / XLSX cell characters | 100,000 / 32,767 |
| Upload / output | 4 MiB / 8 MiB |
| ZIP part / total inflated XML | 6 MiB / 16 MiB |
| ZIP entries / managed media field references | 32 / 1,000 |

CSV counts all union-header cells, including blanks. Use XLSX or reduce scope
when the preview cell cap is reached.

CSV uses a strict UTF-8/RFC-style parser with exact headers, widths, types and
version. Unknown populated columns, malformed quoting and unescaped formula-like
cells fail. XLSX uses Node's bounded zlib and the existing sax dependency; no new
application dependency is added. ZIP central/local metadata, CRCs, paths, offsets,
descriptors, actual inflated length and consumed compressed bytes are checked.
Encryption, ZIP64, symlinks, hidden/unindexed bytes and unsupported parts fail.

Only the eight catalog sheets and safe XML packaging/style parts are supported.
Macros/binaries, formulas (including cached formulas), defined names, external
relationships, embedded objects, DTD/entities, unsupported extensions and unsafe
workbook structures are rejected. Nothing executes or fetches workbook links.
A workbook with unsupported Excel features needs a clean template; arbitrary
workbooks are intentionally not accepted. Packaging references: [Microsoft SpreadsheetML](https://learn.microsoft.com/en-us/office/open-xml/spreadsheet/structure-of-a-spreadsheetml-document) and [PKWARE ZIP](https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT). The independent openpyxl round-trip
checks standards compatibility; it is not native Microsoft Excel acceptance.

## Preview behavior and integrity

A single stable database statement returns products, related hashes, reference
lookups, collisions and revisions from one snapshot. The UI shows would-create,
would-update, unchanged, invalid and conflicted counts, field errors, and actual
before/after changes. Valid lookup rows contribute a reference count without
filling the result table. Invalid lookup rows remain visible. Rows are paged at 50.
Read-only reference sheets cannot create/rename taxonomy or definitions.

Preview validates product requirements, exact money/IDs/booleans/date windows,
warranty/preorder dependencies, duplicates, active option limits, parent links,
reference existence, revisions and related hashes. Publishing proposals check
operational availability and prospective active definitions; optional content and
zero available stock retain existing publication rules. New products require an
active warehouse to exist, but no warehouse is silently assigned.

Explicit and embedded managed image references use existing media path decoding,
canonicalization, tombstone states and no-follow filesystem safeguards. Missing,
private Storage, traversal and unsafe explicit URLs fail. Existing public raster/
legacy SVG references remain supported under the existing media rules. Preview
uploads no images, rewrites no files and fetches no external images. External HTTP(S)
references are checked structurally, not for remote availability. The raw preview checks are advisory snapshots. Task 6B rechecks authorized media,
filesystem and tombstones under the existing commit-held media guards.

Migration **77**, `20261014120000_catalog_transfer.sql`, is justified by bounded,
explicit confidential projections and one-snapshot related/revision matching.
It adds two read-only functions, with private helpers revoked and only service_role
able to execute the public RPC. It adds no tables or business-row writes, changes
no existing function, business grant/RLS policy or default, and reloads PostgREST.
Migrations **1–76 are preserved byte-for-byte**. Execution is verified in native
read-only transactions and under non-superuser ownership in disposable databases.
No SQL is applied to linked/hosted databases.

## Approved application

Task 6B now supplies the separately authorized approval, reupload, sparse
transactions, warehouse choice, commit validation, audits and partial-result
receipts described in [Approved catalog import](catalog-import.md). The raw preview
endpoint remains read-only and never authorizes a write. Its source never persists.

The fresh installer is certified through **71**. Development migrations **72–78**
require separately authorized installation/release certification. Frozen installer
artifacts, Quick Setup, providers and production remain unchanged.

Validation: [Task 6A](catalog-transfer-validation.md), [Task 6B](catalog-import-validation.md).
