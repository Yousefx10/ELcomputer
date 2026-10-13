# Product Manager Task 3: draft-first editing

Authorized baseline: `0571768f001a58077ac0002315efe4b732c9b236`.
Scope: the existing product create/edit forms, independent gallery/specification
saves and their navigation. No listing redesign, import/export, bulk actions,
Quick Setup development, providers, deployment or production access.

## Publication and migration 74

`20261013160000_product_draft_default.sql` changes only the future
`public.products.is_published` default to `false`. A database default change is
necessary to cover writers that omit publication; changing the form alone would
leave those inserts published. It does not rewrite existing products or change
required constraints, grants, RLS, inventory functions or the atomic save RPC.
Migrations 1–73 are preserved byte-for-byte.

The creation form creates a Draft. Its existing success route opens the editor
when the actor has edit permission. Publishing requires deliberately changing
Store Visibility and saving product details in the existing revision-checked
transaction. API callers can still supply an explicit boolean publication choice
under existing Products add/edit authorization. Existing published products keep
their saved state when loaded and edited. Public RLS, storefront views and checkout
publication checks remain authoritative; drafts are excluded from public catalog
reads. Drafts must still meet every existing product/variant database requirement.

Title, URL, explicit valid price, an active primary warehouse and at least one
option remain required for new individually tracked products. An empty category,
brand, preferred supplier, description or image does not cause invented values.
The existing Default option is an inventory definition, not physical stock.
Creation still produces zero items; Procurement receives stock. Daftra ownership,
legacy stock validation, cost confidentiality and warehouse history rules remain.

The certified fresh installer remains frozen through **1–71**. Development now
contains **72, 73 and 74**; separate installation/release certification remains
necessary. No certified engine, bundle, manifest or installer artifact is changed.
Migration 74 is exercised only in disposable local databases in this task.

## Main save and navigation

`useProductEditor` compares complete editable field snapshots, including nested
options, warranties, preorder and SEO values. UI focus, loading flags and live
tracked inventory projections are not authored fields. Hydration establishes the
baseline. Returning a field to its baseline clears its dirty state.

Vue Router leave/update guards cover editor links, programmatic transitions and
browser back/forward. A cancelled discard keeps input and the current route.
Active saves, refreshes and image uploads block navigation. Deliberate discard leaves after
confirmation; unresolved Task 1 request UUIDs remain available for recovery.
`beforeunload` protects refresh and tab closing with supported browser behavior.
Browsers decide whether to display their native warning and supply its text.
No customizable native warning text or guaranteed mobile unload is promised.

Main saves retain Task 1's immutable pending command, one UUID, revision conflict,
receipt recovery, duplicate submit lock and transactional audit. The creation form
navigates after success; editing stays open. Saving details does not save gallery
or specifications and does not unmount their editors during a snapshot refresh.
Main, SEO and gallery upload state reaches the existing editor. Related save
buttons/handlers wait for the upload result, so a late image URL cannot be
overwritten by a concurrent save/refresh. Browser unload protection covers an
upload even before its URL changes. Upload authorization/content checks are
unchanged. Existing deliberate legacy deletion checks the returned row and
leaves after its confirmed write without a second discard prompt.

A confirmed core save followed by a failed refresh retains all section input and
blocks further core saves until a successful reload. Conflict reload still needs
explicit confirmation and preserves input if the fetch fails.

Product details, gallery and specifications show separate saving/unsaved/saved/error
states. Early validation appears beside the relevant main fields; server validation
remains authoritative. Existing form components and layout are retained. No
persistent bar or new decorative interface is introduced. EN/AR labels, RTL,
mobile and Light/Dark/System styling follow the existing Dashboard standards.

## Independent sections

`useProductSection` locks each operation through its write and dependent reads.
A failed section preserves typed input and never undoes another section's save.
After a successful write, its own row baseline updates. Refresh merges preserve
other dirty rows, including a dirty row removed by another actor, so input is not
silently discarded. Main snapshot refresh leaves these component instances alive.

Gallery, specification, feature and shared-name edits use the loaded writable
values in conditional UPDATE/DELETE filters. Returned rows are required: an empty
RLS-filtered or stale result is a conflict, not success. Concurrently changed
values are retained for review and are not overwritten. Category suggestion
updates/deletions and each existing reorder step also check loaded values.
Ordering remains a series of independent writes; no new transaction is claimed.

An unknown section acknowledgement locks resubmission. Reload requires explicit
discard confirmation for that section and reads saved data before clearing input.
A successful write followed by a read failure instead reports that it was saved
but could not refresh. A failed reload preserves drafts. Independent gallery and
specification audits retain the existing best-effort client logging; they are not
part of the core product transaction. Task 2 reference guards, scoped library
permissions and deletion reservations are unchanged.

## Empty-store links and draft retention

Empty optional category/brand/supplier choices explain that they can be left empty.
Category/brand creation links respect the existing add permissions. Warehouse and
supplier links use the existing active staff commerce/CRM workflows; no Settings
permission is required. A missing warehouse blocks save and links to its current
management route. Daftra instead explains external warehouse ownership and omits
local creation links. No records, suppliers, warehouses or stock are auto-created.
Lookup choices refresh on each visit so new prerequisites are available on return.

A deliberate prerequisite visit retains only main editable values and the loaded
revision in actor-scoped Nuxt memory. Returning restores them, including an old
revision if another administrator edited the product while away, so the next
save conflicts safely. Unsaved gallery/specification changes still require discard
confirmation before such a visit. Retention writes no draft contents to localStorage,
sessionStorage or the database. Task 1 sessionStorage still contains only request
UUIDs. Clearing Dashboard access clears retained drafts; actor changes also clear
the active editor's retained entries.

## Limits and acceptance

In-memory retention survives client route visits only, not a full reload, closed
tab or browser crash. Native unload warnings vary by browser and user activation.
An uncertain section save requires a deliberate section reload; there is no new
cross-section retry receipt or all-sections transaction. Conditional row checks
protect current values, not a new revision ledger for every shared library row.
Other existing writers retain their authorization and contracts. Draft publication
controls catalog visibility; existing public upload URLs are not private assets.

See [local validation](product-editor-validation.md), [atomic product saves](product-save-safety.md)
and [media safety](media-safety.md). Local HTTP/native SQL/PostgREST/browser tests
use synthetic Auth and disposable data/files. They do not certify hosted Auth,
production permissions, a deployed migration or real provider operations.

Stop after Task 3 commit/push for review. Do not begin Task 4 automatically.
