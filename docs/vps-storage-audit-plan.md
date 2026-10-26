# Supabase Storage versus VPS — queued read-only audit

STOR-01 / OD-20261026-STORAGE-01, recorded2026-10-26.
**QUEUED AFTER THE CURRENT PUBLIC BETA MILESTONE. NOT EXECUTED.**
Launch work remains first. Unused legacy bucket configuration is class B/deferable,
not a Beta gate. An actual exposed private file or broken active upload, if found,
will be reported as a separate defect with its affected workflow and evidence.

## Architecture and authorization

Supabase PostgreSQL owns records and file metadata. Actual application upload
bytes belong on the VPS, including private files. No ongoing application-media
byte dependency on Supabase Storage is the desired architecture. A bucket's mere
existence proves neither an active dependency nor that it contains bytes.

The user authorizes this targeted READ-ONLY audit after the Beta milestone. No
bucket/object deletion, file move/upload, data migration, permission/policy/ACL
change, production configuration/deployment/service operation or provider call.
PDC remains paused; do not regenerate/fetch labels through provider APIs, retry the
uncertain shipment, or touch its original reference/barriers. No Git push/cleanup.

## Evidence collection when the milestone is complete

1. Identify the actual deployed source/schema/runtime read-only; distinguish it
 from main/schema91 and any not-yet-deployed candidate. Preserve all worktrees,
 secrets and existing source. Inspect current records and logs without assuming
 that older zero-object/metadata-only installation evidence is current.
2. Inventory all six named buckets with paginated/complete object counts, known
 byte totals, missing/invalid size counts, oldest/newest created timestamps and
 separate metadata-update timestamps. Report uploads in24h/7d/30d, with the UTC
 observation time and Riyadh presentation time. Metadata size is recorded size,
 not an independently downloaded-byte integrity proof. Never turn unknown into0.
3. Map every application Supabase Storage call: upload/update, list/download,
 public URL, signed URL creation/use and remove/delete, including shared adapters,
 direct SDK calls, raw Storage REST URLs, SQL/storage references, cleanup/reset/
 installer paths and runtime/feature flags. Separate active deployed request paths,
 dormant fallback/legacy readers, tests and metadata-only compatibility definitions.
 Trace each to its authorization, resource owner, storage_backend/path columns,
 private/public delivery route and VPS root. Report file/line evidence.
4. Map the equivalent VPS upload/read/download/delete path for each workflow.
 Read existing metadata and private file manifests to identify bytes referenced
 in Supabase, bytes present on VPS, missing references, duplicates and stale URLs.
 Resolve only configured allowed roots; do not scan arbitrary VPS directories or
 expose filenames, object paths, tokens or customer files in public reports.
5. Verify customer/staff authorization and download parity using existing receipts
 plus genuinely read-only existing-resource checks where access is available.
 A GET route may log recent activity, generate a label, refresh a provider or mutate
 metadata; inspect its code BEFORE invocation. Do not use it under this audit if
 it writes. Do not mint signed URLs, create sessions/accounts, impersonate users,
 bypass RLS or submit uploads/deletions as a functionality test. If positive upload
 functionality lacks accepted hosted evidence, label it NOT EXERCISED; source
 inspection/empty buckets/401/403 do not establish fully functional workflows.
6. Return the concise six-bucket table plus a small workflow matrix. Include
 counts/known bytes/recent upload activity, ACTIVE/LEGACY/EMPTY, live dependency,
 VPS counterpart, functional evidence boundary and whether migration is required.
 Preserve all private-file permissions; isolate any actual security/upload defect
 from the broader nonblocking compatibility-bucket cleanup.

Classification precedence: ACTIVE means a current application upload/read/signed-
URL/delete dependency, even with0 objects. LEGACY means retained objects or dormant
compatibility references without a current runtime dependency. EMPTY means verified
0 objects and no active dependency; note any dormant definitions. An incomplete
inventory remains UNVERIFIED and must not be assigned a reassuring classification.

| Bucket | Counts/bytes/activity | Classification before audit |
|---|---|---|
| support-attachments | NOT MEASURED | NOT AUDITED |
| shipping-labels | NOT MEASURED | NOT AUDITED |
| order-packing-videos | NOT MEASURED | NOT AUDITED |
| chat-attachments | NOT MEASURED | NOT AUDITED |
| after-sales-evidence | NOT MEASURED | NOT AUDITED |
| admin-documents | NOT MEASURED | NOT AUDITED |

## Conditional minimal migration plan, only if dependencies remain

The audit may PREPARE this plan. It does not authorize any migration or deletion.

- Private immutable inventory: object ID, metadata/record owner and authorization,
 source key, destination ID, MIME, byte length and SHA256. Keep mapping and any
 customer-identifying paths outside Git/chat. Separate empty compatibility buckets
 from files that really need movement; do not migrate nonexistent bytes.
- Back up the relevant DB metadata, original file bytes, VPS private-file roots,
 ownership/modes and current adapter/routing configuration. Verify restorability
 and manifest hashes before a later cutover approval.
- Copy to reviewed private VPS destinations, keeping originals. Enforce allowed
 roots, no symlink traversal, bounded MIME/size and atomic file placement; verify
 length and SHA256 at source and destination, with explicit missing-file handling.
 Never put private attachments in public product-image directories.
- Qualify adapter/metadata changes in isolation and verify private-access parity:
 owner customer, unrelated customer denial, authorized named staff permissions,
 revoked/no-session denial, safe download headers and unchanged retention rules.
 No broad new grants, public bucket conversion or authorization bypass.
- Prepare a bounded backend/path metadata cutover and application release with
 separate exact approval. Record per-file copy/verification/cutover receipts,
 partial failures and idempotent resume. Do not rewrite parent business records.
- Roll back metadata/adapter references to the retained original files when safe;
 preserve new uploads and reconcile dual-period writes without loss/duplication.
 Keep old bytes until the reviewed retention period and a separate deletion
 approval. Bucket removal is never implied by migration acceptance.

Coordinate with PROD-03, CHAT-01, DOC-01, ORDER-02, SHIP-06 and FUT-06 to avoid
parallel replacement storage projects. The audit itself is one bounded follow-up;
any necessary implementation gets its own minimal reviewed scope.
