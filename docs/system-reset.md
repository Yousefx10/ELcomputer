# Owner system reset

Open **Settings → Reset system**. Only active owners can preview or execute a reset. Execution requires the current password and exact phrase. Preview never changes data. Password verification revokes only its temporary Auth session.

## Required release

Use application code and additive migration **79**, `20261014200000_system_reset_compatibility.sql`, together. It requires migrations 1–78 in order. Historical files and certificates stay unchanged. The frozen guided installer remains certified through71; this task does not recertify it.

Browser roles cannot execute reset RPCs, call private engines, acknowledge cleanup or finish resets. Service keys stay private. Do not reset during deployment, provider work or merchant activity.

## Eight-scope matrix

All scopes preserve schema, migration history, grants/RLS, permanent bootstrap seal, installation identity, Quick Setup choices/history and reset tombstones/current-owner attempt protection. Foreign keys and protected dependencies can block deletion. No reset restocks erased orders.

| Scope | Cleared or invalidated | Retained / blockers |
| --- | --- | --- |
| Products | Catalog/taxonomy, reviews/specifications, inventory/units/movements; pending import approvals/items close with reset. | Accounts, order snapshots, settings, uploads and terminal receipts. Purchasing, serialized orders or Claims may block deletion. |
| Orders | Online orders/items/returns, packing/messages, payment/preorder records, shipping jobs/webhooks and ERP reservations; captured packing videos/outbound labels. | Catalog, stock quantities, manual commerce, accounts, settings, unrelated files and imports. Serialized inventory or Claims may block deletion. |
| Commerce | Orders plus sales, purchasing, inventory, transfers, returns and treasury; stock/cost projections become zero; captured packing videos/outbound labels. | Catalog, customers/staff, warehouses, employees/suppliers, settings and imports. Claims may block deletion. |
| Documents | Document metadata/folders/access and captured admin-documents objects. | Bucket/security, accounts, products, imports and all other files. |
| Media | Captured public-library images; exact relative scalar image/SEO fields; affected product revisions advance. | Products, orders, alt text, external URLs, unrelated uploads and imports. Authored HTML/Markdown/specification/nested references block deletion. |
| Store content | Help articles/categories, pages/settings, banners/announcements/offers/navigation. | Products, tickets, orders, coupons, uploads, accounts and imports. Store settings use application fallbacks. |
| Analytics | Visitor sessions/events and NPS responses. | Orders/reviews, internal exclusions, configuration, accounts and imports. |
| Full | Explicit business allowlist, other accounts, captured public/private application files; pending imports close. Chat/courier singletons restart disabled. | Current owner Auth/admin identity and internal exclusion; setup history; policy defaults/reasons/purchased archives; private tombstones; protected Claims, communications and email data. Dependencies may block Full. |

Full preserves the owner's login, not its customer profile. No provider or notification activates automatically. Courier settings have no merchant identifiers/credentials. Chat attachments, assignment, sound and request-call controls restart disabled.

The explicit table policies are in `server/utils/systemResetScopes.js` and SQL `system_reset_tables`. Every scope checks **public, private and catalog_private** coverage. An unreviewed application table blocks preview/execution; it is never implicitly erased.

### Private application metadata

| Table | All-scope policy |
| --- | --- |
| private.salary_payment_commands | Retain minimal salary receipts; Commerce/Full retire them before financial erasure. Old commands cannot repost. |
| private.installation_bootstrap | Permanent journal/seal stays unchanged; reset cannot create another first owner. |
| catalog_private.product_revisions | Cascade only with deleted products; Media advances affected surviving products. |
| catalog_private.product_save_receipts | Retain terminal retry/conflict metadata; replay cannot recreate deleted products. |
| catalog_private.media_paths | Retain reservations and permanent deleted-path tombstones. |
| catalog_private.product_bulk_receipts | Retain terminal idempotency/conflict receipts. |
| catalog_private.import_jobs / import_items | Products/Full close pending authority transactionally. Preserve terminal counts/hashes/receipts. Other scopes preserve approvals, still subject to expiry and permission checks. |

Full retains completed reset IDs while clearing their actor/count payloads. Delayed retries cannot erase post-reset data.

Old imports return closed receipts without applying items. Reusing a source requires a **new preview and explicit approval**, linked through the existing retry workflow. Reset stores no source files or accepted field values.

### Six private Storage buckets

| Bucket | Products / Media / Content / Analytics | Orders / Commerce | Documents | Full |
| --- | --- | --- | --- | --- |
| admin-documents | Retain | Retain | Delete captured objects | Delete captured objects |
| support-attachments | Retain | Retain | Retain | Delete captured objects |
| chat-attachments | Retain | Retain | Retain | Delete captured objects |
| order-packing-videos | Retain | Delete erased video-record paths | Retain | Delete captured objects |
| shipping-labels | Retain | Delete erased outbound label paths; protect retained claim labels | Retain | Delete captured objects except retained claim labels |
| after-sales-evidence | Retain | Retain | Retain | Delete captured objects except retained evidence paths |

Bucket definitions/security remain. Other buckets are untouched. Orders/Commerce preserve unrelated objects. In-flight packing uploads and submitting/pending-label shipping jobs block these scopes. Claims/evidence retain original dependency guards. New metadata cannot attach a path reserved by pending cleanup.

## Recoverable cleanup

1. SQL locks public application tables, rechecks ownership/coverage/dependencies, closes affected imports and captures files/accounts in one transaction. Foreign keys stay enabled. Existing business triggers are suspended only during the established destructive phase and restored transactionally. Media clearing uses **enabled reference/revision triggers**, reserving paths before commit.
2. The server deletes private bytes using **Supabase Storage APIs**, public images using guarded unlink, and accounts using Auth Admin APIs. Application SQL never deletes Storage metadata as a substitute for deleting bytes.
3. Each successful chunk of at most100 items receives a service-only SQL checkpoint. Storage/Auth acknowledgements verify captured names/accounts are absent. Media checkpoints finalize reservations. Exact manifests stay until completion.
4. Finish refuses unacknowledged items. Failures/lost responses leave `cleanup_pending`; resume the same ID with password confirmation. Acknowledged items are skipped. SQL erasure never repeats; later files/accounts are outside the request.
5. Completion writes one `settings.system_reset.completed` activity log, completes the journal and clears manifest/progress atomically. Repeated completion returns the same result.

Maximum **10,000 total cleanup items**, 8MiB media input and bounded Storage/account captures. Larger requests stop atomically; use smaller scopes or a reviewed cleanup plan. Older format-1 pending journals require **operator review**. Migration79 does not reinterpret historical evidence.

Media capture covers regular images in supported public-library directories/root. Unknown/private directories, non-images and external URLs remain. Cleanup refuses symlinks, unsafe/changed roots, traversal and changed size/mtime/inode/device. Changed files leave cleanup pending for investigation. Do not replace captured paths during cleanup. Normal uploads use unique names; operator filesystem/Storage replacement requires operational exclusion.

Remove unresolved authored links deliberately before Media Reset. Stale editors fail revision checks; new references check reservations. Unsaved drafts remain for review. Reset cannot erase carts/drafts in other tabs/devices. Stale cart rows may remain visible, while checkout revalidates database products/stock and rejects erased items.

## Quick Setup and recovery limits

Reset advances relevant domain generations while retaining choices, installation UUID and append-only history. Products invalidates policies/shipping/infrastructure; Orders payment/shipping/infrastructure; Commerce payment/shipping/Daftra/infrastructure; Documents authentication/infrastructure; Media branding/infrastructure plus actual changed settings; Content its configuration domains; Analytics infrastructure; Full all domains. Recreated singletons do not duplicate reset invalidation.

Five password/reset attempts per owner are allowed in15 minutes. Passwords/tokens never enter journals/logs. Pending cleanup blocks another reset. Current owner authorization must remain valid to resume.

SQL erasure requires recovery restore to undo. Application rollback cannot undo deleted data or migration79. A later authorized release must check pending journals, verify fresh recovery and apply79 before enabling these reset routes. Stop on lock/checkpoint/role/policy/manifest mismatch. Migration-history repair is unsupported.

Salary retry protection requires additive migration81 and matching application code. See [salary-payment safety](salary-payment-safety.md).

Checkout retry protection requires additive migration82 and matching application code. All scopes retain private checkout quote/command hashes. Products, Orders, Commerce, Store Content and Full retire quotes; Orders, Commerce and Full also retire commands. See [checkout identity and recovery](checkout-command-safety.md).

## Local certification

Read [validation and evidence boundaries](system-reset-validation.md). Tests include actual disposable PostgreSQL, PostgREST, Auth, Storage and files, synthetic failure fixtures, full regression and browser checks. No production credentials, merchant data, providers or deployment are used. Hosted platform/workload/durability and real BETA acceptance remain separately authorized work.
