# Milestone 2 follow-on, 2026-10-12

The certified source-70 `clean-v1` files and hashes below are unchanged.
Migration 71 and `supabase/bootstrap/portability-v1/` are separate follow-on
artifacts. The compiler/tests explicitly stop the original source reconstruction
at 70, then independently test the adopted baseline upgrade to 71.

PDC is now a disabled NULL-identifier draft, Claims origins are portable, and
first-owner linking uses a private permanently consumed operator journal.
See [the implementation contract](installation-bootstrap.md). Hosted service
acceptance, installer CLI and VPS publication remain Milestone 3 work.
The remainder documents the original Milestone 1 certification.

# Clean installation baseline — Phase 3, Milestone 1

Date: 2026-10-12. Scope: local database foundation only.

The versioned bundle is `supabase/bootstrap/clean-v1/`. It represents source commit
`ae3a58d7a6e81a00b720bed49d8953aabd3bb160` through migration 70. It is outside
the migration glob and must never be applied to an existing installation.
No remote installer or migration 71 is included.

## Source and reproducibility

The compiler reads the complete repository schema reference and all 70 unchanged
migrations into a newly owned loopback PostgreSQL cluster. It extracts the final
application DDL with native `pg_dump`; it never accepts a database URL, existing
cluster, production dump, dotenv, project link or remote target.

The schema reference is compiler input only. Its overlapping definitions,
merchant-specific PDC seed and open transaction make it unsuitable for direct
fresh-project installation. The original reference and migrations are unchanged.

The ordered `filename<TAB>SHA256<LF>` migration digest is
`0bebb93ecc0a4a7cc3d73d587aed0df5e752eca769410b38e12ae08208e1e7db`.
The reference digest is
`c45588387105d146ba4c3824ea56d01e5a3f207e7840d6955720f28e5b6126a8`.
`manifest.json` records every bundle artifact hash. These hashes establish
integrity relative to the reviewed Git commit, not independent hosted proof.

## Bundle contents

| Artifact | Contract |
| --- | --- |
| `schema.sql` | Final application DDL, RLS, policies and application hooks on managed objects; empty-target and capability guard |
| `permissions.sql` | Explicit per-object table, column, function and sequence permissions; no role creation or blanket grants |
| `clean-seeds.sql` | Reviewed neutral references, disabled settings and fresh setup metadata |
| `storage.json` | Six private bucket definitions for later Storage API creation; no media or SQL bucket writes |
| `expected-schema.json` | Full source catalog, including function bodies, ownership, search paths, constraints, indexes, views, policies, triggers and sequence dependencies |
| `permissions-manifest.json` | Complete effective role matrix and each intentional table privilege difference |
| `seed-manifest.json` | Allowed initial records and metadata rules |
| `covered-migrations.json` | Exact 70 version/name/filename/hash identities |
| `manifest.json` | Secret-free source identity, artifact hashes, capability profile and deferred dependencies |

Application objects are created by non-superuser `postgres`. Platform roles,
Auth/Storage/Realtime tables, their owners and extensions are prerequisites,
not bundle provisioning. The bundle adds only the existing application Auth
trigger, private Realtime policy and two restrictive Storage policies.
Actual Supautils policy delegation is required. No managed ownership alteration
or role membership workaround exists.

The laboratory applies DDL, permissions, seeds and validation in one transaction.
An occupied public schema, migration ledger, Auth or Storage target is rejected.
Browser roles must not bypass RLS. A failed seed or capability check rolls back
the entire candidate. This is a test harness, not a hosted installation workflow.
Browser schema creation is also denied by the prerequisite check. The supported
database capability profile is PostgreSQL 17.

## Catalog and permission differences

The catalog comparison covers 117 application tables, three views, five sequences,
1,542 columns, 865 constraints, 416 indexes, 271 functions, 187 application
triggers, 90 policies, 240 types and extension/sequence dependency catalogs.
Function bodies and security attributes remain exact.

Eight CHECK definitions have a reviewed native dump/restore normalization:
`chat_conversations_email_check`, `chat_conversations_mobile_check`,
`chat_settings_allowed_mimes_check`, `document_folders_name_check`,
`documents_name_check`, `email_templates_check`, `email_templates_check1`
and `site_pages_path_check`. `pg_dump` expands BETWEEN; restore flattens the
left nested AND. The comparison permits only those exact associative rewrites.
Operands, operators, OR grouping, validation state and all other fields match.
Any additional change fails certification.

The reference omits older hosted implicit grants. The fresh candidate has no
public table or sequence default grants. There are 55 explicit table/role
differences, enumerated in `permissions-manifest.json`: existing permissive RLS
contracts receive their required browser privileges; listed server paths receive
their missing base-table privileges. New service grants are limited to explicit
read/write contracts. Private command tables retain their original restrictions.
No new browser writes are granted to the corrected nine-table boundary.

PUBLIC function execution is replaced by explicit grants preserving the three
application roles' source-defined effective access. No function execution is
expanded for those roles. Sequence privileges follow source grants and owned
insert dependencies. No default privileges are broadened.

Catalog costs and product supplier/warehouse references remain browser SELECT
denied. Storefront views remain security invoker. Staff readers recheck active
staff identity. Quick Setup remains browser denied, service SELECT-only, and
writable only through its existing owner-checked command. Email and Claims
command-only boundaries remain intact. Existing validated order amount checks
and restrictive Storage composition are preserved.

These differences compare against the source reconstruction, not a newly read
production catalog. Supabase documents the [fresh-project grant policy](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically).

The source profile keeps `customer_profiles.email` NOT NULL with its unique
constraint. The handoff's observed nullable/unique-index production variation
is not imported or silently reconciled. `product_images_variant_required_check`
remains NOT VALID in both catalogs. Both order amount checks remain validated.

## Clean initial data

Every application table is counted. All tables outside the explicit seed
allowlist must have zero rows. Products, variants, product categories, brands,
inventory, suppliers, warehouses, employees, customers, orders, payments,
coupons, business history, queues, communication history and media stay empty.
Auth users and physical Storage objects also remain empty in this milestone.

Allowed source references are 31 specification definitions, nine help categories,
382 PDC city references, 32 status references, seven return reasons, seven
disabled SMS templates/bindings and seven disabled Claims communication settings.
Help categories are separate from product categories. Return-reason definitions
do not enable a return policy. Generic reference UUIDs are deterministic from
system keys; SMS bindings follow the remapped IDs. They are not merchant IDs.

Disabled Vodafone, Brevo, Chat and draft after-sales settings retain reviewed
generic defaults. Credentials are NULL, approval flags false and caches empty.
The new store settings singleton has blank branding/contact/prose and every
payment choice, including Cash, off. No manual courier is manufactured.

The historical PDC settings singleton is omitted because its account/product
identifiers cannot yet be NULL. The unused idle ERP worker lease is omitted;
no worker or connection is configured. These are deliberate seed differences.
The neutral PDC singleton needs migration 71 in Milestone 2.

Configuration seeds precede Quick Setup metadata. Existing write guards stay
enabled; trusted transaction-local initialization uses their existing write
contexts and clears them. Exactly one new setup UUID, empty choices, revision
zero and 17 zero generations are created. No captures, acknowledgements or
setup events exist. Seed values, counts and dormant controls are checked before
the transaction commits, then checked again before history adoption.

## Verified migration history mechanism

The installed CLI is checked against exact version **2.109.1**. In a new unlinked
temporary work directory, the laboratory uses the supported `migration repair`
mechanism with **all 70 explicit versions** and `--status applied` only after
provenance, catalog, role matrix, clean data and target identity match.
See the [pinned implementation](https://raw.githubusercontent.com/supabase/cli/v2.109.1/apps/cli-go/internal/migration/repair/repair.go).

The runner never uses repair-all, reverted status, include-all, include-seed,
linked-project flags or manual ledger insertion. Ambient credentials are not
passed to CLI children. Host, port and database derive only from the owned
cluster. A local advisory lock protects the rehearsal. The later installer
still requires its separate target-bound locks and checkpoint design.

The ledger contains exactly the original version/name mapping and local source
statements. Those statements can include historical seed literals; recording
source provenance does not execute them or import their settings. Candidate
business data, setup UUID and neutral seeds remain unchanged by adoption.
Receipts must describe **70 baseline-covered versions, zero historical SQL
files executed on the candidate**. The source compiler did execute all files
in its separate disposable reconstruction database.

A temporary later migration was the only pending dry-run entry. Two ordinary
pushes produced one execution, one row and one additional history identity.
That fixture exists only in temporary storage; no migration 71 is added to Git.
Modified source/bundle hashes, wrong target binding, occupied history and
schema/ACL/seed drift stop before history adoption.

## Validation and reproduction

Use the prepared Node 22, native PG17, driver, PostgREST and Supautils paths from
[storage-policy-delegation.md](storage-policy-delegation.md). The new native
suite requires those tools; missing native tools must not be treated as a pass.
Unset `NODE_OPTIONS` for the standalone compiler; the keepalive preload is for
the Node test runner only.

```sh
node scripts/certify-clean-baseline.mjs --write
node scripts/certify-clean-baseline.mjs
node --test tests/clean-baseline.test.mjs
node --test --test-concurrency=2 tests/*.test.mjs
npm run typecheck
npm run build
git diff --check
```

`--write` regenerates the reviewed local bundle. Without it, compilation must
reproduce every artifact byte. Neither command accepts a target or DB URL.
The native tests use real non-superuser sessions and actual Supautils. Real
PostgREST requests verify public projections, confidential-field/filter denial,
private setup denial and active staff/customer boundaries. A broad permissive
Storage fixture cannot defeat either restrictive boundary. No provider endpoint
is contacted. Business/Auth/Storage acceptance fixtures are introduced only
after initial empty-data assertions and are destroyed with their owned cluster.

Final local results: **850 regression tests passed, zero failures/skips; 15 focused
baseline results passed**. Independent byte-for-byte artifact reproduction,
Node 22.23.1 typecheck, production build and diff checks passed. The native tools
were PostgreSQL 17.11, Supautils 3.4.4 and PostgREST 16.4. Existing ERP import,
sourcemap and chunk-size warnings remain. Persistent logs and compiler catalog
differences are under `/Users/imac/Documents/ELcomputer/quick-setup-phase3-milestone1-review-20261012`.

## Limits and the next milestone

The native managed-service schemas are explicit contract fixtures. They are
not full Supabase Auth, Storage or Realtime services and are not shipped in the
bundle. Docker/full local Supabase is unavailable in this environment. Actual
Supautils, non-superuser privilege execution and PostgREST are verified; hosted
platform compatibility, Auth Admin creation, Storage API bucket/file operations,
Realtime delivery and key-format compatibility remain unverified. The 500 MiB
packing bucket still requires an adequate hosted global upload limit.

The migration-70 Claims function retains its source production-origin literal.
Legacy DDL defaults and application empty-list/contact/SEO fallbacks also remain.
Initial database rows contain no merchant origin or contact data. Preserve DDL
equivalence now; fix these portability dependencies additively in **Milestone 2**.
This bundle cannot yet produce an accepted portable merchant installation.

Milestone 2 needs migration 71, the nullable disabled PDC singleton, portable
Claims origin, neutral application fallbacks and trusted first-owner journal.
Owner Auth/internal records may then exist; ordinary customers must remain zero.
Installation locks/checkpoints, remote publication, independent full-stack and
separately authorized hosted testing remain later Phase 3 work. Phase 4 imports,
cloning and recovery remain separate. No production access, deployment,
provider configuration, real System Reset or remote project creation occurred.

Quick Setup Phases 1 and 2 are already deployed at the user-accepted migration-70
checkpoint. Earlier local-only release notes are historical. Phase 2 hosted
captures/acknowledgements/conflicts/invalidation retain the handoff's independent
evidence limits; this milestone does not claim to close them.
