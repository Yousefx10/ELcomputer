# Historical metadata supplement — local qualification

Verified **1 November 2026, Asia/Riyadh**. **METADATA SUPPLEMENT READY LOCALLY;
NOT INSTALLED.** Core migration is already complete and is not repeated.

Source commit `9b4107cabbb96fcf1f8124d03f9318aa4650cf22` on isolated branch
`local/history-metadata-20261101`, based on deployed7d989cd. Five new files only:
o application routes/components, historical migrations, dependencies or existing
history code changed. The SQL remains an unregistered qualification candidate under
`scripts/customer-history-metadata/`; no migration version or live approval is reserved.

Latest confirmed production remains owner/E171-reported
**1fd7ef6909869361/schema107**. This qualification made **zero production
connections**, provider requests, archive HTTP requests or production writes.
A fresh read-only deployed-release/schema check is mandatory before any future
release preparation or execution. No production health acceptance is inferred from
these local fixtures. CARD/COD, Email, PDC tracking, MON, Dashboard settings and
emergency controls receive no changes.

## Limited fields and exact population

| Recoverable field group | Proposed metadata rows | Visibility / provenance |
| --- | ---: | --- |
| Original discount total, discount tax, shipping total, shipping tax, order tax; original currency label |591 | Owner projection only after existing verified ownership checks; original strings/explicit zeros retained |
| Product/variation SKU references observed in the frozen archive |485 line items | Owner projection; explicitly `archive_snapshot`, never claimed as an order-time SKU |
| Original checkout note from `wp_posts.post_excerpt` |12 | Private only; never returned by the customer reader |
| Total |1,088 in22 bounded batches | No new core customer, order, refund, item or ownership record |

All fees/shipping/coupon item snapshots already exist. They are not copied again,
recalculated or converted to current financial entries. Existing total, payment
status, dates, refund records, source/customer IDs and addresses remain immutable.
The financial supplement contains no replacement grand-total field.

The raw encrypted archive still matches its original SHA256
`4c62f42b156e40cc45ccdf7ba43ef682ea7ab234362ecb53963f7e9a8ec7aefd`.
Fresh note/SKU/precision extraction was combined with the already authenticated
E171 five-field financial projection. Both inputs have the same encrypted source
and plaintext digests; every overlapping metadata row was checked by ID/value.
No source amount or note text was fabricated or truncated.

There is no order-item SKU snapshot field in the source. The485 references come
from archived product/variation `_sku` metadata and are labelled accordingly.
Current Nuxt SKUs are never read for fallback or overwritten. Missing/empty SKUs
on236 line items are deferred, preserving legacy product IDs and item titles.

All8,353 order-comment logs remain deferred, including236 customer-flagged comments
and8,117 other/private comments. A customer-facing flag alone is insufficient to
publish their contents. Unknown customer-profile notes, ambiguous source fields,
unsupported/oversized notes, ancillary wallet/refund-request/webhook records and
unknown refund-item allocation remain outside the candidate. They do not expand
this into another migration. Original encrypted source evidence is retained.

## Findings on the205 total differences

The source option `woocommerce_price_num_decimals` is **0**. All205 differing
orders use COD and have whole-EGP recorded totals. Using the unchanged source
line/fee/shipping/tax amounts:

- **204** recorded totals equal the nearest whole-EGP component sum using half-up
  rounding. This is consistent with archived zero-decimal pricing.
- **1** does not match that rounding pattern. Its cause is unproven and deferred.
- The separate **5 coupon-component differences** remain unexplained. Their
  source discount aggregate and coupon-item values are both preserved.

The setting and numeric pattern are evidence, not a per-order execution trace.
No exact historical plugin/manual-edit cause is invented. No recorded total,
fee, coupon, tax, payment status or refund is corrected. No collection, outstanding
cash, provider settlement or reconciliation is inferred. Record-level classifications
are encrypted outside Git. One unexplained source difference does not require
changing an exact historical record or block independent UI review.

## Small private candidate

The SQL proposes **two tables** (`entries`, `batches`) in a separate
`customer_history_metadata_private` schema and **three service-only RPCs** for
bounded supplementation, owned reads and scoped withdrawal. It adds no application
trigger and modifies no existing history rows, columns, grants or function bodies.
Standard internal foreign-key checks bind new rows to existing source/order/item
keys. The original five history tables and41 core receipts remain separate.

Each entry reuses `(source_id,kind,legacy_id)` and its existing order/item linkage.
The original source snapshot hash must match; the source cannot be hidden. A new
source namespace is never created to bypass duplicates. Exact item/order/product
references are checked against the immutable core. Non-default source table prefixes
and logical table names are supported and tested; no deployment ID/domain is
embedded in reusable code.

The batch limit is50 entries /1MiB. Source-level transaction locks, content hashes,
stable bundle/batch IDs, strict field allowlists and durable receipts protect
concurrency and replay. Identical commands return their original receipt; changed
commands or immutable values fail atomically. Duplicate entities within a batch,
wrong sources/items/refunds, unknown fields, replacement totals, missing money and
caller-selected visibility are rejected. Native pg JSONB array parameters must be
serialized as JSON; the qualified native harness uses that transport.

The file has one BEGIN/COMMIT boundary so new function definitions and privilege
revocation become visible together. A future guarded DDL-plus-data installation
would strip only those reviewed outer markers and reconcile the full dataset in
one explicit transaction before commit. There is **no production operator** here.

## Privacy and side-effect boundaries

Both tables have RLS and no direct schema/table grants to anon, authenticated or
service_role. Only the three mediated functions are service-executable. Authenticated
staff do not gain direct private access. No current customer or staff endpoint is
installed by this work.

The new reader delegates authorization to the existing historical-order reader,
which requires the current confirmed email/active profile, linked Auth UUID and
visible owned source/order. It returns only the financial/SKU fields. Checkout notes
and raw source evidence never appear in that response. No staff-note reader is
added; a future authorized staff viewer needs its own RBAC/UI qualification.

All131 unlinked orders remain private. Held identities, unverified accounts,
changed emails, other owners and hidden sources cannot gain access through the
supplement. No billing-email linking, claim action, account/password migration or
verification message is proposed. Local fixtures use synthetic identity/claim
operations only; no real claim or production Auth action occurs.

The only new write targets are the two metadata tables. No live order, payment,
refund, inventory, shipping/COD, Email, marketing, Treasury or Auth table is written.
There are no network functions, operational workers, tracking registrations or
callbacks. The native fixture protects13 active-commerce tables with fail-on-write
sentinels; they remain unchanged.

## Qualification and rollback

| Check | Final evidence |
| --- | --- |
| Focused planner/PGlite privacy/ownership/idempotency/portability tests |11 PASS |
| Native PostgreSQL17.11 scenarios |11 PASS; isolated Unix socket, no TCP listener, synthetic data only |
| True two-session behavior |Same-command serialization, conflicting immutable command and cancelled lock-wait rollback PASS |
| Real-source reconciliation in memory |1,088 exact records;591 financial/485 archived SKU/12 private notes |
| Exact batch replays |22/22 PASS; no duplicate metadata/core records |
| Core and ownership preservation |Zero core/active row changes;131 unlinked orders and0 claims preserved in the full-data rehearsal |
| Grants/RLS and field visibility |Both tables/three roles, service-only functions, owner/guest/other-account/verification denial PASS |
| Additive DDL rollback |Whole schema disappears on outer rollback; original core remains |
| Scoped metadata withdrawal |Hides only the exact metadata bundle, retains records/receipts/core and prevents replay resurrection |
| Source/archive and code checks |Archive SHA unchanged; Node syntax/Git whitespace PASS;5-file source scope frozen |

Native fixtures were stopped. Real note text was reconciled only in memory and
remains encrypted in local artifacts. Customer identities were replaced with
synthetic records for the full-data rehearsal. Tests observed zero non-loopback
network attempts. No production schema/data/configuration was accessed or altered.

Initial local extraction-list, SQL alias and native JSON-array transport failures
are retained with the corrected final proofs. They involved local data/fixtures
only. The final mapper reproduces the reconciled bundle digest without changing
source values. Qualification is not deployment or hosted owner acceptance.

If this optional storage is installed later, rollback should withdraw only an exact
metadata bundle under separate approval, not delete/reimport core history or restore
an old database. Existing core order reads continue; metadata becomes unavailable.
Fresh recovery, actual schema compatibility, RLS and source/record reconciliation
must be sealed before a production action. No automatic retries or rollback are
introduced by the local candidate.

## Release decision and next action

The **smallest possible future release** is SQL/data-only: two private tables,
three service-only functions and the1,088 supplemental entries in22 bounded batches,
with no core updates, current UI/routes, provider calls or app restart. No schema
number, deployment seal, approval expiry or production installation is prepared.

Production installation is optional and can wait until the UI review establishes
how the fields will be used. Current core history does not depend on it. No further
optional note/SKU/source-total investigation is required before that review.

**Remaining genuine history acceptance:** DTR-06 still lacks an evidenced hosted
claim/list/detail session from a properly authorized, verified order-bearing owner.
This work creates no real account/claim/email to manufacture that evidence.
Missing optional SKUs, comments and the unexplained source differences remain
explicit deferrals, not reasons to alter historical totals or stall UI review.

**ONE next action:** begin the customer/Admin UI/UX review, including whether staff
need a dedicated historical-order Dashboard viewer. Preserve the existing design,
EN/AR/RTL and permissions; viewer implementation remains a later reviewed change.
Paymob Pixel/Pay Again await the provider reply. Detailed PDC settlement/ERP stays LAST.

Owner decision `OD-20261101-METADATA-LIMIT-01` / task `MIG-03-META-01`.
Private qualification packet:
`/Users/imac/Documents/ELcomputer/woocommerce-history-metadata-20261101`.
All original worktrees and deferred evidence are retained; no Git push.
