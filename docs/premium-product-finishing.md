# Premium PDP finishing enhancements

This milestone adds five features to Premium. Classic markup and the original
shared product route remain unchanged. Both footers remain unchanged.
Deployment requires a new final owner approval. No migration is required.

## Customer controls

- **Favorites:** a compact heart beside Share, below the gallery. Guests save up
  to 100 product IDs in this browser. Existing non-anonymous accounts save the
  same bounded list using the existing Supabase Auth user-metadata service.
  Favorites never influence ratings, authorization, prices or publication.
- **Share:** native sharing when supported; clipboard fallback on rejection or
  unavailable native sharing. Cancellation stays silent. Other outcomes have
  visible localized feedback. URL construction reuses the page's canonical and
  locale helpers, without query/tracking parameters. The catalog's single authored
  title is also the heading and share title on both localized pages.
- **What's in the box:** a keyboard-accessible disclosure shows only authored
  package specifications. Missing contents hide the entire section. Legacy text
  stays verbatim; quantities are shown only when explicitly authored.
- **Need help?:** a purchase-panel disclosure opens the localized Help Center,
  validated existing footer email/phone contacts, and existing support tickets
  for signed-in accounts. The current production chat-status route is held (403).
  It never starts anonymous Auth, advertises live availability or opens providers.
- **Metadata:** real brand, variant/product SKU, model and existing specification
  attributes remain authoritative. Authored tags become bounded, unlinked chips.
  Compatibility retains existing specifications and curated product relationships.
  Empty values do not create badges or unsupported navigation.

Guest and account favorite lists stay separate. Signing in never uploads guest
history; signing out never copies private account history into browser favorites.
Fresh verified Auth reads precede account updates. Each update freezes its bearer
and changes only `storefront_favorites_v1`; other profile metadata is preserved.
An ambiguous acknowledgement requires a fresh read before another toggle. There
are no automatic retries. Concurrent device updates follow Auth metadata's
existing last-write behavior; this is not a transactional wishlist ledger.
Browser storage denial and expired sessions show a recoverable failure.
No hosted account has been changed for qualification.

## Dashboard controls

Product Editor → Specifications now includes **What's in the box** and
**Product tags** authoring controls. Enter a confirmed item name and quantity,
or one factual tag. Add saves through the existing `product_specifications`
permission/RLS contract. Existing per-row Save, Delete and arrow controls edit
and order the rows. Package rows expose separate name and quantity inputs.
Shared specification definitions are not created or modified automatically.

Package rows use `label='Box contents'`, `value='2 × Authored item name'` and the
existing `sort_order`. Tags use `label='Tags'` with an authored value. The exact
integer format is recognized; ordinary legacy text is never interpreted as a
quantity. Existing specification names/groups for package contents still work.
Existing saved data is not rewritten. New rows remain ordinary readable
specifications for other existing consumers, including Classic.

The same section lock, loaded-row conditional writes, permission checks, dirty
navigation, in-memory drafts and unknown-acknowledgement controls apply. Reorder
remains independent conditional writes; no multi-row transaction is claimed.
Saving this section does not save core details, inventory or presentation videos.
The existing Premium section setting can still hide package contents globally.
Support contacts reuse existing footer settings, including enabled Modern
mailto/tel contacts when the legacy contact field is empty. Neither footer changes.

## Qualification and release

The dedicated finishing browser harness extends the accepted milestone's real
catalog/native PostgreSQL/PostgREST review. Original qualified harnesses and
consumed release operators stay immutable. Additional synthetic Auth protocol
checks cover account persistence without reaching hosted Auth. Dashboard checks
compile the actual specification component and use native RLS, not fake saves.
Browser request routing excludes external services. Fixture package items and
tags are explicitly owned test data, never catalog facts or production inserts.

The new operator is `scripts/premium-product-finishing-release/operator.mjs`.
Preparation builds a clean application archive with retained client assets,
verifies encrypted DB/runtime backups and archive readback, then produces a
non-deployable candidate. `seal` requires qualification of that exact archive
before producing a format4 plan. Consumed format3 activation approvals fail.
`check` is read-only; `apply` requires the complete final seal and is single-use.
Candidate and final checks retain Caddy/systemd, current settings, Auth, catalog,
media, all 138 protected table projections, and existing disabled commerce gates.
Only the established two analytics tables and Auth activity timestamp projection
may advance; analytics counts cannot shrink. Schema and Auth security stay bound.
No SQL write path exists. Recovery preserves schema89 and newer data, requires
separate review, and never runs automatically.

See the private milestone directory for exact artifacts, approval and owner checks.
PDC and WordPress work remains deferred until this milestone is accepted.
