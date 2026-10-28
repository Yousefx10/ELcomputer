> E128: recovery17c CONSUMED_COMPLETE; next automatic MON passed23:20Riyadh with original3 warnings/critical0. Appa7fa8e8e/schema102 technical closeout PASS, owner acceptance pending. [Completion receipt](checkout-address-book-monitor-recovery-receipt.md). Parentc86 stays CONSUMED_STOP; do not replay parent, recovery or102. Earlier review below is historical.

> E127: schema102 COMMITTED and appa7fa8e8e/routes LIVE; parent approval CONSUMED_STOP, never replay. [Actual stop receipt](checkout-address-book-deployment-stop-receipt.md) and [separate one-field MON recovery](checkout-address-book-monitor-recovery-review.md). Historical readiness below does not authorize another deployment or migration.

# Customer delivery address book — separate migration review — E126

28 October 2026. **LOCAL QUALIFICATION PASS / NOT APPLIED / OWNER REVIEW PENDING.**
Owner decision **OD-20261028-ADDR-02** includes multiple saved addresses in Task1.
No implementation request or historical approval authorizes this migration.

## Exact SQL and numbering

[Review the complete SQL](/Users/imac/Documents/ELcomputer/checkout-address-book-20261028/source/supabase/migrations/20261028210000_customer_delivery_addresses.sql).

- Source branch `local/checkout-address-book-20261028`, commit `2236497a6b69acb680eb074ff23d472d91282e3b`.
- File `20261028210000_customer_delivery_addresses.sql`.
- SHA256 `bdca673587a172b23299f1e9a20423d5f3ea9138406968eccc7647790a6d0281`.
- Current production is101; proposed schema is102. Version20261028210000 was absent
  from all30 original worktree migration inventories and the actual live101 history.
  Only this file may run. No generic database push, old96 deployment or replay.
- Preserve offline location4843754 and its historical96 numbering. LOC-01 must
  derive its new ordering from then-current repository AND production history;
  no location migration or reference data is bundled with this address feature.

## Additive scope

One empty `public.customer_delivery_addresses` table,13 columns, validated constraints,
primary key plus one customer-list index, one RLS policy, and two new functions:
`customer_save_delivery_address(uuid,uuid,integer,jsonb)` and
`customer_remove_delivery_address(uuid,uuid,integer)`.

The table stores customer ownership, recipient, optional label/second address line,
city/governorate/phone, revision and timestamps. Email remains in the existing
account/checkout flow. It does not store provider IDs, financial data or media.

There is **NO profile backfill**. The current owned profile address remains available
as the existing checkout address. No existing profile, order snapshot, payment,
inventory, history, configuration, grant, policy, function, trigger or index changes.
Order addresses have no dependency on this book; removing a book entry cannot edit
an order. The new customer-profile foreign key uses the existing ownership contract.

## Authorization and save behavior

- Authenticated users can SELECT only their own addresses while their profile is
  active. Anonymous reads are denied. Authenticated/service-role direct DML is
  revoked; only the trusted server can execute the two new mutation functions.
- Each API uses the existing `requireCustomerRequest`, requires a current active
  non-anonymous account and derives customer ID from verified auth. Caller-supplied
  ownership fields and unknown inputs are rejected. HTTP responses use private,
  no-store caching. Errors/logs do not echo addresses, phones or failing rows.
- Mutations lock only the customer's profile row before checking ownership/revision.
  At most20 stored addresses per customer; concurrent creates cannot exceed it.
  Book entries and the existing profile address remain separate; saving a book
  entry does not automatically update the profile or place an order.
- Create IDs are retained in memory for explicit lost-acknowledgement recovery.
  Exact repeated content returns the existing receipt without another row/write.
  Updates require a revision unless their exact resulting content already exists.
  Stale conflicting updates/removals fail closed and preserve the UI draft.
- Required fields, lengths, Egyptian governorates, phone and control characters are
  validated server-side. Test address markers are rejected. Existing checkout
  authorization/address/quote/price validation is unchanged and still authoritative.
- Removal needs explicit UI confirmation and an exact current revision. A failed
  or uncertain request retains the draft. Reload distinguishes failure from absence.
  No automatic command retry, provider call, order or payment action is added.

## Evidence and execution boundary

**12 native PostgreSQL/API checks PASS,0 skipped**: ownership, RLS, anonymous/expired/
disabled rejection, mass-assignment rejection, concurrent/idempotent creates, revision
conflict, Arabic data, the20-address bound, removal and profile/financial preservation.
Auth/transport are fixtures; all business data is synthetic in a disposable local DB.

Separate PostgreSQL17.11 migration qualification preserves **144 original projections**,
all existing schema/ACL/RLS/functions/triggers/indexes, Auth and private imported history.
The new table remains empty. Transaction rollback restores schema101 exactly.
The approved deployment transaction must independently preserve all **145 live original
projections**, actual Auth/history/access and the exact qualified schema footprint before
commit. It refuses history drift or an already applied102. No hosted SQL has run.

A fresh encrypted schema101 database backup passed authenticated full pg_restore
readback. All11 encrypted runtime/configuration recovery files passed byte/hash readback.
The Merchant Inquiry key file was not collected or read. No restore ran.

The new foreign key may briefly wait on profile writes; migration lock timeout is5s.
Uncommitted transaction errors roll back normally. After a COMMITTED checkpoint,
never replay the migration or automatically restore/undo it. Preserve receipts and
obtain fresh exact recovery authority for any later stopped stage.

Review this SQL alongside [the exact deployment packet](checkout-address-book-release-review.md).
Only its separate exact approval authorizes the migration, app switch and four
necessary address API ingress rules. Local qualification is not hosted acceptance.
