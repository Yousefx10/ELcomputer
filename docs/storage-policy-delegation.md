# Migration 64 Storage policy compatibility — 2026-10-11

The approved migration-64 patch removes its unsupported Storage RLS alteration. It retains the restrictive policy exactly and requires an ordinary, already RLS-enabled Storage objects table before committing. Application code is unchanged.

Approval source: `/Users/imac/Documents/ELcomputer/production-storage-policy-review-20261011/proposed-migration64.patch` and its accompanying report. Starting main: `e9ffed1b52a128455116378124c27b955c51d121`. This implementation uses only newly owned disposable local databases and synthetic records. No production connection, migration, deployment, backup refresh or provider activation occurs.

## Exact source and history impact

In [migration 64](../supabase/migrations/20261008120000_after_sales_claims_core.sql), remove only `ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY`. Preserve the entire `after_sales_evidence_server_boundary` CREATE POLICY statement byte-for-byte: RESTRICTIVE, ALL, anon/authenticated, unchanged USING and WITH CHECK. Append the approved `$storage_rls$` DO block immediately after CREATE POLICY inside the existing BEGIN/COMMIT.

The block reads pg_class and requires `relkind='r'` and `relrowsecurity=true`. Otherwise it raises SQLSTATE 55000. CREATE POLICY already obtains the table DDL lock, retained until transaction end, so RLS cannot be disabled between this verification and commit. Policy creation errors also abort the transaction. There is no exception handler, policy replacement, skip or automatic RLS repair. Bucket insertion and all earlier Claims changes roll back together.

| Migration | SHA-256 of current source |
| --- | --- |
| 64 `20261008120000_after_sales_claims_core.sql` | `7db914fecd7be043281f18fe7dbbb0563de8180665634880e9c80e0a581af4cd` |
| 65 `20261008160000_after_sales_reverse_logistics.sql` | `833b36b9dcf7acefbc47de95b2f21af64202b94233d73e673328348aaa8942d2` |
| 66 `20261008180000_email_foundation.sql` | `e32c88ad21f6fb971bcf82da293857d10eb6a4f5eb25bcf219392597ab78784d` |
| 67 `20261009120000_after_sales_communications.sql` | `df83fed86e8cb119a67b12e84974de059c665ea3b449c5d8724f5e35e9543f63` |
| 68 `20261011120000_catalog_confidentiality.sql` | `e7d9fb35a05f9c8cb2b82c343efdb79e515c607842e0d7f9c5369e4365bb3cae` |
| 69 `20261011140000_order_amount_constraints_reconciliation.sql` | `d2b60fbd08f8d457c9d507737b9f0b6665b34b89b6860214bfc5f5329ce7cf89` |

The previous 64 fingerprint was `f6bc35160ed6c6d20682c6ad4fb1d2f6554a1b71538b34bd4127ab04be760314`. Only still-unapplied 64 changes in place. Its version/name is unchanged; all 1–63 and 65–69 files remain byte-for-byte identical to starting main. There are still 69 files, with pending order 64→65→66→67→68→69. No migration 70, history repair or fabricated entry is added. Any other environment that already applied 64 requires separate provenance review before using amended source.

Inspection of every statement in 64–69 finds no additional managed Storage ownership operation. Migration 64 retains bucket INSERT and restrictive policy CREATE; 65 retains only its existing restrictive reverse-label policy CREATE. Migrations 66–69 contain no managed Storage DDL. Migration 65 uses the same supported delegation; no scope expansion is needed.

## Official delegation behavior, independently checked

Supabase's [Supautils policy documentation](https://github.com/supabase/supautils#manage-policies) supports non-owner CREATE/ALTER/DROP/COMMENT POLICY through `supautils.policy_grants`. Its [platform configuration](https://github.com/supabase/postgres/blob/develop/ansible/files/postgresql_config/supautils.conf.j2) delegates Storage objects/buckets and Realtime messages policies to postgres. [Managed Storage ownership](https://supabase.com/docs/guides/platform/permissions) remains with the platform.

The [versioned hook](https://github.com/supabase/supautils/blob/42d491cd2519d763918527760151f9e6bd5c9f23/src/table_grants.c) checks the configured table allowlist, obtains AccessExclusiveLock and executes only the authorized policy utility statement through the managed hook. General ALTER TABLE is not covered. The [execution wrapper](https://github.com/supabase/supautils/blob/42d491cd2519d763918527760151f9e6bd5c9f23/src/utils.h) temporarily uses its configured internal superuser context and restores the caller on success or error.

This platform-internal operation is part of Supautils. The migration runner remains logged in as non-superuser postgres; it issues no SET ROLE, gains no owner membership, requests no additional grant and changes no managed ownership. Public functions remain owned by postgres. Existing postgres/service BYPASSRLS attributes are modeled but never added by the migration; browser security tests use NOBYPASSRLS logins.

The preceding read-only review recorded hosted PostgreSQL 17.6, Storage RLS already enabled, Supautils session-preloaded and postgres delegation including Storage objects/buckets. That is historical evidence from the review, not a refreshed production observation in this implementation. The earlier plain PostgreSQL rehearsal correctly reproduced the ALTER TABLE failure, but lacked Supautils and therefore could not establish failure of delegated CREATE POLICY.

## Actual Supautils test environment

The [current official Supabase PostgreSQL package](https://github.com/supabase/postgres/blob/develop/nix/ext/supautils.nix) pins Supautils 3.4.4. Its unmodified official source was compiled locally against native PostgreSQL 17.11:

- Source tag: v3.4.4; commit `42d491cd2519d763918527760151f9e6bd5c9f23`.
- Downloaded commit archive SHA-256: `fe101df24d9dc0fd644f09844ad1b0302ff93c1562c55906a60bbe315143c269`.
- Build: `make -j2 PG_CONFIG=/private/tmp/elcomputer-email-audit-pg/install/bin/pg_config PG_VERSION=17`. The explicit PG_VERSION avoids the source Makefile's GNU grep dependency on this Mac; source code is unchanged.
- Library: `/private/tmp/elcomputer-storage-supautils-2yy81zck/supautils-42d491cd2519d763918527760151f9e6bd5c9f23/supautils.dylib`. No global installation or existing database service change.

[Native fixture](../tests/helpers/storageNativeDatabase.mjs) initializes a separate temporary cluster per scenario, binding only 127.0.0.1 and its owned temporary Unix socket. It loads the actual library through session_preload_libraries and configures a representative allowlist: postgres → realtime.messages, storage.objects, storage.buckets. Negative delegation cases retain Realtime support but omit Storage.

Synthetic bootstrap and Storage owner logins create the platform fixture only. Storage tables are created under their synthetic owner from the outset; ownership is never changed. Existing-style schema/table DML rights are established only during disposable fixture setup. The application schema and every migration execute under the actual postgres non-superuser login, without owner/bootstrap membership. Hook identity is checked using its registered SIGHUP GUC, preload configuration and executable behavior; an unregistered custom GUC cannot satisfy the checks.

The default [reset fixture](../tests/helpers/resetDatabase.mjs) now enables objects RLS in platform setup, before application migrations, matching the supported baseline. It allows the native fixture to create platform objects and switch connections before application SQL. The fixed 64 hash expectation is updated in the catalog audit test. Dependencies, lockfile, production scripts and application files are unchanged.

## Security and ordered-chain checks

[Storage regression source](../tests/storage-policy-delegation.test.mjs) tests actual delegated execution, rather than a superuser-only substitute:

| Scenario | Actual result — all PASS |
| --- | --- |
| Non-owner postgres, enabled RLS and Storage delegation | Full migration succeeds; exact restrictive policy retained |
| Non-owner postgres, no Storage delegation | SQLSTATE 42501; entire migration rolled back |
| Storage RLS disabled | SQLSTATE 55000; policy, bucket, Claims tables/functions/grants/data all rolled back |
| Existing conflicting policy | SQLSTATE 42710; conflict retained, complete transaction rolled back |
| Partitioned Storage objects table | SQLSTATE 55000; ordinary-table requirement fails atomically |
| Original ALTER TABLE under delegated postgres | Still denied with 42501 before/after the chain |
| Anonymous/customer logins with an added broad permissive policy | Cannot read, insert, update, delete or move protected evidence/reverse-label rows |
| Authorized unrelated Storage objects | SELECT/INSERT/UPDATE/DELETE retained, including ordinary outbound shipping labels |
| Existing trusted service login | Can read intended private records; protected records remain unchanged |

Restrictive policies continue to compose through AND with permissive policies, as [PostgreSQL documents](https://www.postgresql.org/docs/17/sql-createpolicy.html). The fixture's broad permissive rule deliberately tests this boundary. Restrictive policies add no access by themselves; with no permissive policy, browser access remains default-denied. Both policies retain exact roles, ALL commands and USING/WITH CHECK expressions. Private bucket properties remain public=false, 5 MiB, JPEG/PNG/WebP/PDF.

The complete actual 64→69 sequence runs under non-owner postgres and real Supautils on five baselines: fresh canonical; populated corrected63; populated canonical63; supported absent order-check pair; corrected63 with previously observed nullable-profile-email/full-unique-index drift and a synthetic NULL-email customer. Every old public column value is compared across the chain. Corrected 45-policy OIDs, validated order CHECK OIDs/definitions, Storage table OIDs/owners/ACLs/RLS and role memberships remain intact. The absent pair is restored by unchanged 69; profile drift is preserved and Claims reads remain authorized by customer ID.

All providers, return/warranty and communication/channel/template controls stay OFF. Claims, reverse shipping, outbound shipping, Email/SMS and other new work ledgers stay empty; existing synthetic SMS events remain suppressed. No historical sendable/shipping work is created.

The installed CLI 2.109.1 also executes files 1–63 against the new local cluster before population/corrections, then previews and executes exactly 64–69 from an unlinked temporary project. Only the real runner writes history after successful SQL. Success must produce all 69 exact version/name pairs; missing Storage delegation must leave exactly 63 and a complete unchanged rollback snapshot. No roles, seeds, include-all or repair flags are used. No hosted URL or credentials are passed.

CLI 2.109.1 [serializes its connection configuration](https://github.com/supabase/cli/blob/v2.109.1/apps/cli-go/internal/utils/connect.go) without retaining URL sslmode. The disposable test repeats PGSSLMODE=disable only in its scrubbed loopback child environment. This is not a hosted connection setting. DEBUG stays unset. For a later hosted preflight, independently verify the actual runner's effective postgres identity, loaded delegation and encrypted connection requirements; avoid assuming URL options alone survive CLI serialization.

## Validation record and reproduction

Focused Storage/Supautils/CLI checks: **31 passed, zero failures/skips** on Node22.23.1/native PostgreSQL17.11/Supautils3.4.4/CLI2.109.1. Complete suite: **760 passed, zero failures/cancellations/skips**, including existing catalog REST security, Claims/reverse/communications/Email, concurrency and order-reconciliation regressions. Local REST tests use actual PostgREST16.4. Typecheck, build and diff checks pass. Pre-existing ERP duplicate-import, sourcemap, chunk-size and preorder target warnings remain.

Reproduction uses the already prepared native tools and the compiled library above:

```sh
env -u DEBUG \
  PATH=/private/tmp/elcomputer-preflight-20261010/node22/node-v22.23.1-darwin-x64/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin \
  DYLD_LIBRARY_PATH=/Users/imac/Documents/ELcomputer/production-backup-tools/postgresql-17.11/lib \
  EMAIL_REVIEW_PG_BIN=/private/tmp/elcomputer-email-audit-pg/install/bin \
  EMAIL_REVIEW_PG_DRIVER=/private/tmp/elcomputer-email-audit-pg/driver/node_modules/pg/lib/index.js \
  PAYMOB_REVIEW_PG_BIN=/private/tmp/elcomputer-email-audit-pg/install/bin \
  PAYMOB_REVIEW_PG_DRIVER=/private/tmp/elcomputer-email-audit-pg/driver/node_modules/pg/lib/index.js \
  CATALOG_REVIEW_POSTGREST_BIN=/private/tmp/catalog-review-tools/postgrest \
  SUPAUTILS_REVIEW_LIBRARY=/private/tmp/elcomputer-storage-supautils-2yy81zck/supautils-42d491cd2519d763918527760151f9e6bd5c9f23/supautils.dylib \
  NODE_OPTIONS=--import=./tests/helpers/keepTestProcessAlive.mjs \
  node --test --test-concurrency=2 tests/*.test.mjs
```

For focused reproduction, replace the final test arguments with `--test tests/storage-policy-delegation.test.mjs`. These hook tests are explicitly skipped without their native tool/library variables; the recorded run supplies them and has zero skips. Typecheck/build use the same Node22 PATH with DEBUG unset: `npm run typecheck`, `npm run build`; final whitespace check is `git diff --check`.

Logs reside under `/private/tmp/elcomputer-storage-*.log`; Supautils build provenance resides under `/private/tmp/elcomputer-storage-supautils-2yy81zck/`. All disposable database clusters and unlinked runner projects are removed after each test. Initial fixture-only issues (restricted setting visibility, pg name-array decoding, local CLI TLS-mode serialization and the historical schema fixture's open transaction blocking a separate CLI connection) were corrected in tests; no additional migration/application change was made to accommodate them.

## Remaining hosted uncertainty and next preflight

The real-hook local test establishes supported non-owner policy behavior. It does not execute hosted DDL, identify the exact hosted Supautils binary, exercise Supavisor/backend session behavior or prove physical hosted Storage/Auth HTTP acceptance. Those remain separately authorized checks. If the exact delegated policy fails on the approved runner, stop for Supabase support; do not change roles, ownership, RLS or skip policies/history.

This source is ready for another production preflight after successful local validation and main commit/push. Recheck exactly 63 hosted identities, the six current hashes, hook/allowlist, ordinary Storage RLS, conflicts, corrected security/order state, OFF controls and historical ledgers. The encrypted recovery point still requires refresh because live analytics changed; that blocker remains outside this task. Retain the previously documented coordinated catalog/code transition and recovery limits.

No release or provider activation is authorized by these results. STOP after this scoped local implementation, audit, commit and push.
