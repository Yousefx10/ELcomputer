# Shipping Company tariff manager

Open **Commerce → Shipping → Shipping companies → Tariffs** on a PDC company.
This feature manages carrier configuration only. Checkout prices, operational PDC
settings, credentials and provider gates remain unchanged, even for verified rates.

## Editing and history

Users need existing Settings access and Edit settings permissions; owners inherit
them. Both HTTP handlers and service-only SQL commands enforce active staff access.
Tariffs belong to the exact company UUID. No merchant/account identifiers are
hardcoded in application logic. This release supports the installed PDC adapter;
it does not advertise unknown APIs or independent accounts behind the legacy record.

A draft edits all six zone prices, additional-weight rates, base weight, volumetric
divisor, percentages, fee/VAT bases, optional insurance/surcharges, invoice terms,
effective dates, annual review date, shipping product and exact city mappings.
Prices use fixed decimal strings. Empty amounts are invalid; zero is explicit.
Dates may remain unknown in a draft. Annual review never applies an increase.
Optional surcharges inherit the version's effective dates; empty zone scope means
all zones. Every text/numeric/list input is bounded. No arbitrary media/URLs/secrets.

Save creates a durable revision and full configuration history in one transaction.
Stale revisions conflict. A lost acknowledgement retains the same command/payload
in memory; **Recover saved command** replays its durable receipt. Fields stay locked
until recovery. No automatic network retry. Export before choosing to discard a
conflicting draft. Browser/route/company changes warn about unsaved work; an
uncertain save prevents navigation. No draft is stored in browser local storage.

Verification requires explicit product/commercial/surcharge confirmations, a real
effective date, known weight rounding and fee/VAT bases. Every included city needs
a confirmed zone, one exact current alias and saved provider city cache membership.
The selected product must appear in the saved product cache. Excluded cities do
not count as covered. At least one included city must be confirmed. Merely selecting
a candidate never confirms its mapping or service coverage.

Verification freezes that version. Use **New draft version** to edit it or restore
a historical revision. Prior rows remain immutable and can be viewed by revision.
Lists show the latest100 versions/revisions; older revisions remain addressable
through the bounded UUID/revision GET contract. There is deliberately no Activate
button or checkout reader. Full reset retains configuration/history tombstones;
deleted company IDs cannot access or reassign them.

## Import, preview and export

The JSON contract is `shipping-tariff/v1`. The editable document contains no company
ID, credential reference, enabled-commerce flag or authority to activate checkout.
The current company and server-checked revision bind every request.

1. Export JSON for a portable merchandising/configuration copy.
2. Import a JSON file up to1.5MB. It stays in memory; no source file is uploaded.
3. Server preview validates and compares the complete document. It writes nothing
   and makes no provider request. Omitted required fields are errors, not clears.
4. Imported confirmation flags reset to unverified; insurance resets off. Review
   full field diffs and coverage warnings, then load the preview into the draft.
5. **Save draft** is the separate explicit persistence action. Production imports
   in this milestone additionally require the owner's exact business-write approval.

No CSV uploader is claimed. The supplied CSV is an owner review companion; import
the JSON. The [owner package](operations/shipping-tariffs/README.md) records source
and mapping assumptions. Source files contain business-specific data outside
reusable application logic. Future installations start with no tariff rows.

## API and schema

`GET /api/admin-shipping/companies/:id/tariffs` returns versions, current/selected
document, revision metadata, saved alias/cache context and verification blockers.
Optional `tariff` UUID and positive `revision` select a historical view. Responses
are private/no-store. Secret columns are never selected.

`POST` accepts `preview`, `save` or `verify`, exact `tariff_id`, expected revision,
complete document and (for writes) a durable `command_id`. Preview requires no
command receipt. SQL rechecks company/actor/revision and verifies terms atomically;
receipt replay precedes revision checking. It never invokes PDC or Paymob.

Proposed migration91 is `20261023010000_shipping_tariff_drafts.sql`. It adds only
two private RLS-protected tables, internal guards and service-only read/save RPCs,
plus narrowly registered reset retention. Browser roles and direct service-role
table access are revoked. Revision rows provide durable configuration audit without
depending on the Dashboard's trimmed activity-log history. No price/business rows
are seeded; existing schema objects and migration history are preserved.

This migration/application is one release unit. It must not be combined with account
consolidation, gateway secret migration, checkout pricing or loyalty schema changes.
Do not apply SQL or import the package without separate exact production approval.
