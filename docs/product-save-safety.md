# Product Manager Task 1: atomic product saves

Authorized baseline: `ecc31985836a1e5dc81d3213d43d55da1fb69f64`.
This task covers the existing product create/edit forms and their APIs only.
Quick Setup, providers, production deployment, imports, exports and bulk actions
remain outside scope. Stop after delivery for review; do not begin Task 2.

## Save contract

The existing POST `/api/admin-products` and PATCH `/api/admin-products/:id`
validate the authenticated administrator and send one service-only database
command, `catalog_save_product`. It locks current authorization, ERP configuration
and the product, checks the loaded revision, saves product fields and invokes the
existing `commerce_define_product_variants` function. Legacy primary-warehouse
quantity reconciliation, the administrator audit and the completed receipt are
part of that same transaction. Any failure rolls the complete command back.
There is no compensating DELETE or second UPDATE after a failed definition save.

Each command needs a UUID `request_id`. PATCH also needs the integer
`expected_revision` from GET `/api/admin-products/:id`. That GET returns product,
active definitions and revision from one SQL snapshot. Revisions are opaque
generations, not timestamps or a count of saves. Product/variant content triggers
advance them for other existing writers too. Physical tracked-stock, cost and
rating projection updates do not make an editorial snapshot stale. Legacy
aggregate quantity is editable content and does advance the revision.

A different administrator's stale command returns HTTP 409 before it changes
anything. Reload requires explicit discard confirmation and fetches the complete
current product and definitions. There is no automatic overwrite or merge.

An advisory transaction lock serializes the same request UUID. Its canonical
normalized payload, operation, product and expected revision are fingerprinted.
The same actor retrying the same command receives its original ID/revision,
without another product or audit, even after a later edit. Reusing that UUID with
different details or another actor fails. GET `/api/admin-products?request_id=...`
reconciles the current actor's committed receipt without returning product data.
Authorization is checked again before receipt replay or recovery.

## Migration 72

`20261013120000_atomic_product_saves.sql` is the only new migration. Original
migrations 1–71, public business functions, public column grants, RLS policies and
certified bootstrap bundles stay unchanged. It adds:

- Private `catalog_private.product_revisions` and `product_save_receipts` tables.
- Product/variant revision triggers; existing products start at revision zero.
- Three public service-only RPC entry points for snapshot, save and recovery.

The private schema and tables have no browser or service-role direct grants;
RLS is enabled. Security-definer functions use an empty search path, require the
service role and independently check an active actor's effective Products access
and add/edit permission. Viewers cannot use the editor snapshot or save commands.
Existing storefront views and staff catalog read permissions remain intact.

Receipts contain IDs, a payload digest and completion metadata, never authored
product values, inventory cost, supplier data or credentials. Their product and
audit IDs deliberately have no cascading foreign keys. Product deletion/reset
retains minimal revision and receipt tombstones so an old retry cannot recreate
a deleted product. Reusing a product UUID advances its previous generation.
These private rows add no external dependency that blocks existing guarded reset
preflights. An unavailable product returns 409. Do not
purge receipts automatically; deleting one removes that request's retry guarantee.

Review and apply migration 72 to an approved target **before** releasing these
APIs. No linked project, hosted database or production SQL is accessed by this
task. Missing migration support fails safely with a clear error.

The frozen fresh-install engines certify exactly migrations 1–71. They deliberately
reject a source checkout containing 72 until separate installation certification
is authorized. Their code and bundles remain frozen. Historical installer,
publisher and guided-install regression fixtures keep their certified 1–71
migration boundary; that is regression evidence, not acceptance of a 72-based
fresh hosted installation.

## Validation and business safeguards

- Price must be explicitly supplied as a finite nonnegative decimal with at most
  two decimal places, up to `9999999999.99`. Explicit zero remains valid where
  existing selling rules permit it; missing/blank/null/boolean prices fail.
- Optional old price may be empty. Fractional, negative, blank, boolean or
  out-of-range stock quantities fail rather than being truncated or coerced.
- Title, URL slug, UUID references, SKU, option names/codes and field lengths are
  checked. SKU leading zeros/case are preserved; controls and non-text values fail.
  Existing product and active variant uniqueness constraints remain authoritative.
- New products use individual tracking, zero stock/cost and an active primary
  warehouse. Definitions do not create physical items; Procurement remains the
  receiver. Tracked product quantity/cost are live projections, excluded from
  editorial writes. Tracking mode and stocked/history warehouse rules remain.
- Daftra ownership restricts local supplier/warehouse/legacy quantity edits under
  the configuration lock. Content editing stays available. Existing procurement,
  physical history, variant gallery integrity, warranty and preorder logic remain.
- Only the server transaction records `products.create`/`products.update`.
  Existing unrelated gallery and deletion audits remain separate.
- Errors use safe, translated reasons. Raw SQL details, costs and reference
  internals are never sent in save errors. Editor responses are private/no-store.

## Form behavior and design standards

Keep the current Dashboard identity: existing typography, colors, spacing, forms,
tables and components. Interfaces must be clean, compact and professional. Avoid
flashy gradients, oversized cards, excessive rounding, decorative icons and
unnecessary animation. Use natural, concise labels; never invent descriptions,
specifications, media or facts. Preserve EN/AR, RTL, Light/Dark/System and mobile.
These standards apply to future Product Manager and UI work, not just this task.

This task changes only save states, errors and recovery controls. The submit
button and form inputs lock while a command is running. An unconfirmed response
keeps the original command immutable for Retry save or Check save. Session storage
holds only an actor-scoped request UUID; private draft contents are not persisted.
Validation and authorization errors retain that UUID until a completed receipt is
confirmed. An expired session after a lost response cannot start a second create.
After reload the form checks for a completed receipt. A conflict keeps entered
values visible until the administrator explicitly reloads. Price controls accept
cents. Existing visibility defaults and all other management layouts stay intact.

The transaction covers the core product and variant definitions. Existing media
uploads, gallery and specification operations have their own save flows; they
are not falsely presented as part of this transaction. Network loss plus a page
reload can lose unsaved typed values, but the retained request UUID protects the
completed creation from duplication and supports receipt recovery.

## Local acceptance

Run the complete regression suite with Node 22.23.1 and the existing optional
native PostgreSQL, PostgREST and Supautils fixture tools enabled. No database URL,
production dotenv or hosted credentials are needed. A secret-free Nuxt build
and typecheck use an empty `--dotenv` file.

Focused suites: `product-save-validation`, `product-save-database`,
`product-save-api`, `product-save-concurrency` and `product-save-rest` tests.
They cover successful saves, transactional rollback including audit failure,
simultaneous administrators, simultaneous retry, lost acknowledgements, strict
validation, direct-writer conflicts, effective permission revocation, private
RPC access, actual Procurement, legacy warehouse reconciliation, Daftra ownership,
deferred gallery integrity, existing warranty and migration preservation.

`scripts/product-save-browser.mjs` compiles the actual forms/components/composable
against built application CSS, actual HTTP handlers and disposable native SQL.
It checks EN/AR, RTL, three widths and Light/Dark/System, creation/editing, duplicate
submissions, translated validation, dropped responses, receipt recovery and
explicit conflict reload/cancellation. Hosted Auth verification, Nuxt shell and
unrelated media/SEO controls are fixtures. External browser requests are blocked.
`scripts/warranty-browser.mjs` preserves the existing wider warranty/UI regression.

Native independent-session and local browser evidence do not certify hosted
Supabase Auth, production accounts, real provider flows or a deployed migration.
Hosted acceptance and any deployment require separate authorization.
