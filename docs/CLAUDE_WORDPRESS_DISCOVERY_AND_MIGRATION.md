# WordPress discovery, access and migration guide for Claude

Prepared 7 November 2026, Asia/Riyadh. Task `CONT-WP-01`.

This explains the actual sources and methods used for the old WordPress store.
This task prepares documentation, not a new import or archive activation. File
locations, primary/comparison ciphertext hashes, tool hashes and Node version
were checked locally. No archive was decrypted, website requested, database
queried, migration run or provider contacted for this handoff.

## The useful starting point

The old content is available locally. You do not need a working WordPress admin
login to investigate it. We usually authenticated an encrypted SQL snapshot,
parsed its records as data, and compared a narrowly selected projection with
existing Nuxt/Supabase records. For images or plugin source, we used preserved
file archives and inventories. WordPress, PHP, plugins and old jobs stayed unrun.

Start with the question or missing field, not with another full import. The main
catalog, core customer/order history and a selected product-family mapping have
already been imported. Their old operators and approvals are consumed. Missing
metadata can require a small new supplement, without replacing completed data.

Read the newest entries in [the master roadmap](ELCOMPUTER_MASTER_ROADMAP.md),
[PROJECT_STATE.md](../PROJECT_STATE.md), [CODEX_HANDOFF.md](../CODEX_HANDOFF.md)
and [AGENTS.md](../AGENTS.md). Use
[the deployment handoff](CLAUDE_PROJECT_HANDOFF.md) for SSH and release mechanics,
subject to its dated status notices. Latest reviewed E334 records app
`5ff85e59751474cf`, source `93bc457`, schema123, with Classic checkout selected
and hosted Apple Pay restricted to the owner. That is recorded evidence, not a
fresh server check. Do not use an old WordPress script's schema82/94/107 target
assumptions for the current application.

## Where the source lives

The main checkout is `/Users/imac/Documents/ELcomputer/ELcomputer`.
In the paths below, `BASE` means `/Users/imac/Documents/ELcomputer`.
Most source archives and operational workspaces are siblings of the checkout;
they are not included in a normal Git clone.

| Source | Local location under BASE | Use |
|---|---|---|
| Approved primary SQL | `actual-vps-reinstall-preparation-20261020/elcomputer-wordpress-current.sql.enc` | The source used by the completed customer-history import and later family investigation |
| Comparison SQL | `actual-vps-reinstall-preparation-20261020/elcomputerold-wordpress-current.sql.enc` | Comparison evidence; not a second dataset to union |
| Earlier primary SQL family | `clean-reinstall-backup-readiness-20261020/elcomputer-wordpress-current-v3.sql.enc` | Used by the SEO/public-content assessment; has its own receipt and digest |
| Earlier comparison SQL family | `clean-reinstall-backup-readiness-20261020/elcomputerold-wordpress-current-v3.sql.enc` | Comparison for that earlier family |
| Primary file backup | `clean-reinstall-backup-readiness-20261020/elcomputer-home.tar.gz.enc` | Archived site files, uploads, themes and plugins |
| Comparison file backup | `clean-reinstall-backup-readiness-20261020/elcomputerold-home.tar.gz.enc` | Archived comparison site files |
| Original WPvivid package | `clean-reinstall-backup-readiness-20261020/historical-wordpress-22-parts.tar.enc` | Preserved original multipart backup set |

SQL archives have adjacent `<filename>.receipt.json` files. Home archives also
have receipts, encrypted inventories, manifests and verification reports in
the same directory. Later home-delta and current-home-hash evidence is under
`actual-vps-reinstall-preparation-20261020/`; consult custody manifests before
claiming a file backup represents the final state of every path.

The approved primary ciphertext SHA256, rechecked for this handoff, is:

```text
4c62f42b156e40cc45ccdf7ba43ef682ea7ab234362ecb53963f7e9a8ec7aefd
```

The comparison ciphertext SHA256, also rechecked, is:

```text
2d415414ec29907d5f88d86205bd7370b33eed148cffc611687eedf75e7abcdb
```

**The `current-v3` files are different snapshots/exports.** Their recorded
plaintext digests differ from the primary/comparison pair above, even though
the corresponding byte sizes match. Do not substitute a similarly named file,
assume equal counts mean identical contents, or reuse another archive's receipt.
Bind every analysis to its actual ciphertext and plaintext hashes.

The primary's reviewed order-creation dates run 13 January–16 October 2026 GMT.
Its filename is not proof of a final transaction cutoff or absence of later
WordPress activity. A later delta needs a newer immutable source and a reviewed
cutoff; the current Supabase database is not a replacement WordPress snapshot.

## Keys and tools

The existing private AES key is:

```text
/Users/imac/Documents/ELcomputer/production-backup-credentials/clean-reinstall-20261020.key
```

It is present and mode0600. This document contains the path, not the key.
Do not print, copy into chat/Git, rotate or replace it. The authenticated envelope
reader expects a regular, nonsymlink, owner-owned 32-byte key file with mode0600.

The historical workspace configuration records the key and envelope locations:

```text
/Users/imac/Documents/ELcomputer/customer-history-final-import-20261025/backup-effective-config.json
```

Inspect only needed path fields. Do not print the entire configuration or nearby
private specifications; they may reference credentials and protected records.

Verified Node executable, reporting `v22.23.1` during this handoff:

```text
/Users/imac/.npm/_npx/ed214ae0ceb6e0e4/node_modules/node/bin/node
```

That cache location is machine-specific. If absent elsewhere, select the same
pinned toolchain deliberately. Do not assume the Mac's default `node` is Node22.

The reviewed helpers are:

```text
BASE/customer-history-final-import-20261025/source/docs/operations/backup-envelope.mjs
BASE/customer-history-final-import-20261025/source/scripts/customer-migration/wordpress_dump.py
```

Their locally checked SHA256 values are:

| Helper | SHA256 |
|---|---|
| `backup-envelope.mjs` | `72145d75fdf1bc75e959761e98db2fdf2e8ceb7c9ecb6ba8a7a94dd8b9e71543` |
| `wordpress_dump.py` | `cd02914c0d9c41ce78528bb8ed69137c1af981f14c0507b2108bd52fff29a2b2` |

The envelope is the project's `ELCBK01` AES-256-GCM format, not an OpenSSL password
file. `verify` authenticates and prints only verification metadata. `decrypt`
authenticates the whole envelope before releasing plaintext to stdout. Do not
run bare `decrypt` in a visible terminal: SQL contains identities, hashes,
addresses and provider settings. Keep selected personal records encrypted too.

## A bounded offline extraction recipe

This example authenticates the primary and creates a new encrypted, selected
customer/history projection in a new temporary directory. It does not execute
SQL, contact Supabase, create users or change the source. The shell example was
syntax-checked; extraction/decryption was not run for this documentation task.

Run it after reading the two helpers and checking their identities above:

```bash
(
  set -euo pipefail
  umask 077
  WP_BASE=/Users/imac/Documents/ELcomputer
  WP_NODE=/Users/imac/.npm/_npx/ed214ae0ceb6e0e4/node_modules/node/bin/node
  WP_SOURCE_ROOT="$WP_BASE/customer-history-final-import-20261025/source"
  WP_ENVELOPE="$WP_SOURCE_ROOT/docs/operations/backup-envelope.mjs"
  WP_PARSER="$WP_SOURCE_ROOT/scripts/customer-migration/wordpress_dump.py"
  WP_KEY="$WP_BASE/production-backup-credentials/clean-reinstall-20261020.key"
  WP_ARCHIVE="$WP_BASE/actual-vps-reinstall-preparation-20261020/elcomputer-wordpress-current.sql.enc"
  WP_WORK=$(mktemp -d /private/tmp/elcomputer-wp-review.XXXXXX)
  test "$("$WP_NODE" --version)" = v22.23.1

  "$WP_NODE" "$WP_ENVELOPE" verify "$WP_KEY" "$WP_ARCHIVE"

  python3 "$WP_PARSER" \
    --archive "$WP_ARCHIVE" \
    --receipt "$WP_ARCHIVE.receipt.json" \
    --key-file "$WP_KEY" \
    --node "$WP_NODE" \
    --envelope "$WP_ENVELOPE" \
    --output "$WP_WORK/selected-source.json.enc" \
    --table-prefix wp_

  printf 'Encrypted review output: %s\n' "$WP_WORK/selected-source.json.enc"
)
```

The parser compares the ciphertext hash/size and authenticated plaintext digest
with the receipt. It strips password hashes from selected users, retaining only
algorithm-family counts. It encrypts its JSON output and writes a new receipt;
existing output files are not overwritten. Its default allowlist serves history,
not a complete catalog, CMS, plugin or comment export. Absence from this selected
projection does not establish absence from the full SQL archive.

The SEO reader also keeps selected identity/URL fields rather than full page
bodies. To recover descriptions or CMS text, select `post_content`/`post_excerpt`
deliberately from the authenticated source. Preserve raw HTML privately and
convert it through the existing target content rules; do not execute shortcodes
or paste unsanitized archived HTML into the new storefront.

For another question, copy/adapt the relevant inspected reader into a new review
workspace. Do not modify a sealed historical script, its source archive or its
receipts. Preserve parser bounds, exact table selection and authentication checks.
Reject unsupported SQL or serialized values; do not improvise execution fallbacks.

## How discovery worked

We used a progression from source inventory to narrow, source-bound extraction:

1. Establish the archive's identity, provenance, receipt, hash, size and cutoff.
   Keep the original immutable and verify its metadata after reading.
2. Inventory exact table names, columns, post types, metadata-key counts, plugin
   names and relevant options. Find where the requested feature was actually stored.
3. Select only the necessary rows and fields. Keep sensitive values encrypted;
   reports contain aggregate counts, hashes and unresolved classifications.
4. Read stored integration code and file sources statically when needed. Derive
   relationships from explicit IDs/metadata, not names, screenshots or guesses.
5. Resolve the authoritative storage layout, source IDs, duplicate metadata and
   snapshot differences before proposing target mappings.
6. Compare with existing target data and durable receipts through an approved,
   database-enforced read-only connection. Count existing/missing/conflicting
   records separately. A missing UI field is not proof its source data is missing.
7. Prepare a private dry-run and hold every unproven mapping. Local qualification
   comes before a concrete migration review and any production approval.

Useful existing investigation workspaces under BASE:

| Workspace / reader | What it demonstrates |
|---|---|
| `woocommerce-history-assessment-20261101/inventory-source.py` | Authenticated primary/comparison inventory, classic/HPOS checks, identities, addresses, financial fields and source counts |
| `woocommerce-history-assessment-20261101/audit-mapping.mjs` | Raw source normalized against the completed history import |
| `woocommerce-history-assessment-20261101/assess-destination.mjs` | Repeatable-read, database-enforced read-only target inspection |
| `seo-migration-audit-20261031/extract-public.py` | Narrow product/page/taxonomy/URL projection from the separate `current-v3` source family |
| `product-families-20261104/inspect-source.py`, `classify-source.py`, `map-source.py` | Plugin/snippet discovery and exact source-to-existing-product relationship mapping |
| `published-wordpress-conversion-20261017/` | Frozen catalog conversion, source-to-target identities and destination rehearsal |
| `published-wordpress-import-preparation-20261017/published-source.private.json` | Existing private published-catalog source projection; inspect privately, not in chat |
| `catalog-seo-readonly-20261017/FIELD-MAPPING.md` | Earlier catalog field-mapping notes; check their dated scope against later conversion evidence |
| `customer-history-final-import-20261025/` | Completed history source binding, deterministic batches and authoritative receipts |
| `woocommerce-history-metadata-20261101/` | A narrowly scoped, locally qualified metadata supplement |

Read these as examples before running them. Some import modules load old target
plans immediately; some scripts contact production; others write fixed filenames
with exclusive creation. “Read-only” can mean no production writes while still
creating local encrypted evidence. Never run all scripts in a directory or assume
an old plan still matches the current server/schema.

## What to inspect in WordPress

| Tables / fields | Content and interpretation |
|---|---|
| Exact-prefix `users`, `usermeta` | Registered identity, roles, profile and billing/shipping snapshots. Order email is not identity proof. Password hashes remain private and are not imported. |
| `posts` with `product` / `product_variation` | Original IDs, parent links, titles, slugs, status, HTML/content and variation identity. Distinguish all source rows from published/importable rows. |
| `postmeta` | Prices, SKUs, images, attributes, source stock, order fields and custom plugin data. Inventory duplicate key values; do not silently take one conflicting value. |
| `terms`, `term_taxonomy`, `term_relationships`, `termmeta` | Categories, brands, product types, attributes and explicit membership. Inspect real taxonomy names and hierarchy. |
| Attachment posts and attachment metadata | Upload paths and image relationships. Verify actual archived bytes and hashes; a URL or attachment row alone is not a recovered file. |
| `posts` with `page`, `post`, `nav_menu_item` | CMS content and menu relationships. Preserve authored copy, language and publication state; review HTML/shortcodes as untrusted content. |
| `posts` with `shop_order` / `shop_order_refund`, plus `postmeta` | Classic order/refund records. This was the approved primary's authoritative order layout. |
| `woocommerce_order_items`, `woocommerce_order_itemmeta` | Product lines, shipping, fees, coupons and tax metadata. Keep item types separate and preserve source amounts. |
| `wc_orders`, `wc_order_addresses`, other HPOS tables | Mirrored storage in the reviewed primary; corroboration, not additional orders/addresses to import. |
| Selected `options` | Home/site URL, permalink structure, active plugins, storage flags and pricing precision. Options may contain credentials; never dump them wholesale. |
| `comments`, `commentmeta` | Reviews and order-note logs, including private staff notes. A customer-facing flag alone is not permission to publish archived text. |
| `snippets`, `wpcode` posts / related metadata | Integration and custom linking logic can live here rather than in plugin PHP files. Read code as text; never execute it. |

The reviewed table prefix is `wp_`. Use exact logical tables: a plugin table
containing “users” or “posts” is not another core table. The parser accepts a
validated alternate prefix when a different source actually proves one.

Classic storage was selected by
`woocommerce_custom_orders_table_enabled=no`, with compatibility synchronization
enabled. All597 mirrored HPOS order/refund rows matched the classic status,
currency and totals in the reviewed assessment. Count591orders and6refunds once.
Recheck flags and row correspondence for a genuinely new source.

SQL dump statements are parsed as text; they are not sent to MySQL/PostgreSQL.
Serialized PHP metadata uses a bounded scalar/array parser that rejects objects;
do not use PHP `unserialize`, run `eval`, bootstrap WordPress, or execute archive
PHP to decode it. Archived HTML, shortcodes and JavaScript also remain unexecuted.

## Examples of discoveries that required more than plugin filenames

**PDC shipping:** the actual integration was Code Snippets record34 in
`wp_snippets.code`, named “ElComputer PDC Courier — Test”. The related account
template was `plugins/elcomputer-my-account/templates/my-account.php`.
Static PHP plus stored order metadata established the historical contract.
See [the original PDC review](pdc-wordpress-contract-review.md). Historical booking
evidence does not establish current provider entitlement or authorize a rebooking.
Do not copy the old code's retries, hardcoded parcel defaults, secrets or broad
WooCommerce financial/status changes into Nuxt.

**Linked product choices:** WPCode record8565, “switch Color”, wrote ordered
`_cv5_links` entries with explicit product IDs and authored labels. The entry's
`active` flag identified the current product; it was not public activation.
Upsells, cross-sells, bundles, title similarity and generic relatedness did not
prove family membership. `_color_links` and WPC Linked Variations post8445 were
separate held mechanisms. See [the family review](product-family-recovery-20261104.md)
and its later [completed closeout](product-family-schema112-closeout-20261104.md).

**Historical money:** the source option `woocommerce_price_num_decimals=0`
helped explain204of205 component-total differences by whole-EGP half-up rounding.
One total difference and five coupon-component cases remained unexplained. We
preserved original totals and components instead of “correcting” source records.
See [the metadata review](woocommerce-history-metadata-review.md).

## Completed migrations: do not repeat them

| Workstream | Recorded completed result | Evidence |
|---|---|---|
| Initial catalog import, 17 October | 560 Draft products,68 original variations,2,505 verified image copies,560 per-product receipts; zero opening physical stock then | `BASE/approved-catalog-import-20261017/REPORT.md` and `BASE/published-wordpress-conversion-20261017/LATEST-EXECUTION.md` |
| Core history import,25 October | 516customer snapshots,591orders,6refunds,1,789items,702fulfillment observations,41batches; no Auth/password import | [Production history receipt](customer-history-import-receipt.md) |
| Selected family mapping,4 November | 18groups,45existing products,76directed choices;45presentation rows,18receipts,18audits | [Schema112 closeout](product-family-schema112-closeout-20261104.md) |

Those are original milestone counts, not a claim that the live catalog is still
all Draft or has zero stock. Later customer edits, publication, receipts and live
orders must be preserved. Compare a proposed delta with current authorized data.

The initial catalog source had565published parents/72published variations;
five parents and associated options had explicit holds. The later full SQL
assessment counted626product posts/73variations. These populations and snapshots
are different; neither difference alone establishes missing import work.

Historical customer data uses a private source namespace and composite
`(source_id, legacy_id)` keys. Source/user/order/product IDs are not current Auth
UUIDs or live order IDs. Use the existing exact maps and receipts. Do not create
a fresh source namespace to bypass duplicates after re-encryption or a new filename.

The final history workspace contains `IMPORT-STATUS.json` with
`CONSUMED_COMPLETE`,41batch receipts,`IMPORT-RECEIPT.json` and independent
post-import verification. Do not rerun its `apply`, `resume`, approval or original
pre-import-empty-state checks. Underlying idempotent data commands and durable
receipts do not make a consumed production operator reusable.

## Existing missing fields and held cases

The1November source-to-target reassessment reproduced every approved core history
record. It proposed zero core inserts/updates. Source addresses were preserved
as snapshots, not silently copied into customers' current saved address books.

The limited supplement at commit `9b4107c` was qualified locally for1,088entries:
591original financial aggregates,485archive-SKU references and12private checkout
notes. Its reviewed evidence says **not installed**, no registered migration
number and no production operator. Check later evidence before any continuation.
Do not treat its local SQL/fixtures as an approved live installation.

The485SKUs came from product/variation metadata in the frozen archive, not an
order-time SKU snapshot. Keep the `archive_snapshot` provenance.236missing/empty
line-item SKUs were deferred. All8,353order comments, including236customer-flagged
ones, remained outside that candidate; private staff notes never enter customer
responses. Wallet rows, refund requests and webhook logs are ancillary source
facts, not new wallet balances, executed refunds or jobs to replay.

Core history retained131unlinked orders:110guest and21excluded/missing-owner.
Three historical identities remained held. The513conditionally eligible identities
were not automatically linked; actual claims were zero at the cited verification.
Do not assume the current claim count without a fresh authorized observation.

For product families,19CV5components and two older overlapping mechanisms remained
held. Unpublished/missing members, conflicting labels, overlapping lists or an
unproven dimension require explicit review. Do not publish held products or invent
combinations to complete a selector.

## Planning a new migration or supplement

1. **Define the delta.** Name the requested fields/records and business purpose.
   Inspect completed imports and current source lineage first. Record inserts,
   intentional updates, unchanged records and held conflicts separately.
2. **Freeze provenance.** Pin source/cutoff, archive and parser hashes, exact prefix,
   source IDs and current target. A new export does not authorize an overwrite.
3. **Map exact identities.** Reuse source-to-target product IDs and historical
   source keys. Hold missing/ambiguous matches; never fuzzy-match identities by
   title, image filename, billing email or guessed SKU.
4. **Preserve current ownership.** Keep Supabase Auth UUIDs, verified emails,
   roles, profiles, live orders and newer user edits. Registered legacy email
   plus the existing confirmed-account claim process governs historical access.
   A historical order's billing email never proves ownership.
5. **Normalize without fabrication.** Preserve missing versus empty and explicit
   zero, decimal strings, currency, dates/timezone ambiguity, original status,
   refunds, addresses and source text. Preserve both conflicting observations.
   Do not infer collection, settlement or stock from a legacy status label.
6. **Create an encrypted dry-run.** Produce bounded proposed commands, stable
   source keys, deterministic request/batch IDs, payload hashes, exceptions and
   a private mapping journal. Public reports contain aggregate facts only.
7. **Qualify in disposable targets.** Use synthetic identities or an approved
   protected local restore. Test RLS/RBAC, cross-customer isolation, unchanged
   Auth/current data, duplicates, conflicts, concurrency, lost acknowledgements,
   partial receipts and zero provider/job/financial side effects.
8. **Prepare recovery and the exact review.** Bind a fresh encrypted backup,
   authenticated restore/readback, target checkpoint, SQL and artifact hashes,
   expected writes, withheld rows and rollback limits. Existing atomic import
   and authorization services should be reused where their contracts fit.
9. **Obtain the specific production authority.** Source selection, local fixture
   success, DDL installation, data import, app deployment, publication and provider
   activation are distinct decisions unless explicitly combined in one reviewed
   scope. This guide is not an apply approval.
10. **Execute the new bounded operator once.** Preserve committed partial results
    and durable receipts. Reconcile original data and source amounts afterward.
    Stop on drift, conflicting immutable values, denied permissions or uncertain
    mutation; no blind rerun, global reset or automatic rollback. Update the
    roadmap/handoffs and distinguish technical completion from owner acceptance.

For editorial catalog imports, follow [catalog transfer](catalog-transfer.md),
[approved import](catalog-import.md), [product saves](product-save-safety.md)
and [media safety](media-safety.md). Inventory belongs to the existing receipt/
procurement/ERP contracts. Historical stock quantities do not create physical
units, opening balances or saleable stock. New products stay Draft until reviewed.

Import order history into the existing immutable history representation, never
through active checkout/order/payment flows. No inventory deduction, provider
charge/refund, treasury movement, shipment, email, SMS, ERP job or marketing
event may be triggered by reading/importing old facts. Do not disable global
triggers or RLS to make an import succeed.

The inspected WordPress hashes used `$wp$2y$` prehashed bcrypt. Our migration did
not import them or create a password bridge; ordinary verified signup/recovery
preserved the existing Supabase Auth boundary. Do not strip prefixes, overwrite
working credentials or import privileged WordPress users as current staff.

## File and media recovery

Use encrypted home inventories and archive manifests to find the precise member
before reading a large file archive. Match media by explicit attachment/product
relationships, original relative paths and content hashes. Preserve featured/
gallery order and existing newer relationships. Never infer a missing product
image from a similar filename or fetch an old production URL to fill a gap.

The original22WPvivid parts are preserved as a set. Check their verified manifest
and actual archive layout; do not assume a single part is a complete backup or
concatenate/extract them blindly. If selected extraction is needed, enforce
bounded sizes, canonical relative paths, no traversal, no symlink following,
no special files and no overwrite into production or another worker's files.
Use a new private workspace; retain original bytes and provenance.

PHP/plugin files and `wp-config.php` are read as text. Literal configuration can
establish the historical prefix/origin, but may contain passwords, salts and
provider tokens. Never execute it or include its values in reports. Old public
media copies and a file existing on disk do not prove current Nuxt delivery;
verify the current serving path separately after an approved change.

## About the old server/admin access

Historical15October discovery used:

| Role | Historical access |
|---|---|
| Original WordPress | SSH user `elcomputer`, root `/home/elcomputer/htdocs/elcomputer.net`, key `~/.ssh/elcomputer_wordpress_migration` |
| Archive preparation | SSH user `elcomputerold`, root `/home/elcomputerold/htdocs/old.elcomputer.net`, key `~/.ssh/elcomputer_wordpress_archive` |

See `BASE/wordpress-wp2-discovery-20261015/REPORT.md` and the dated WP3/WP3e reports
for what was actually verified at each stage. The machine was later reinstalled;
these users, directories, PHP/MySQL setup, login assumptions and old SSH host
fingerprint are historical. They are not a current access procedure. Current
production uses the separately pinned root SSH path described in the deployment
handoff. Do not replace its host-key trust with the old WordPress fingerprint.

The current VPS is not a reason to reinstall WordPress or expose an old admin
site. Do not request `old.elcomputer.net`, run WP-CLI/PHP, log into a clone or
restore SQL into a running site just to investigate content. A simple WordPress
request can start copied jobs/integrations. Offline SQL/file parsing is sufficient
for the investigations described here.

If an actual executable WordPress clone is newly required, it needs a separately
reviewed isolated environment with proven network/provider/mail denial, separate
database/credentials, scheduler/queue containment and private ingress before any
bootstrap. Historical preparation reports contain failed/unproven gates too;
their existence is not evidence that a new clone is contained.

## What Claude should report after an investigation

State the exact source and cutoff; what was found and where; what already exists
in Nuxt; the proposed delta; held mappings and missing evidence; local validation;
and the one next action. Keep credentials, customer rows, hashes of passwords,
raw provider payloads and private notes out of the report. A finding in old code
is historical evidence, not current provider acceptance or permission to replay it.

For most new requests, begin with an offline projection from the approved primary,
check existing maps/receipts, and propose only the demonstrated missing content.
