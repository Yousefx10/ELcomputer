# Migration-79 installation validation — 2026-10-14

Authorization: BETA Gate 1B only, starting from clean
`5b056d512b4897e1c3daa3805830617109abb4e3`.
Application source remains frozen at that checkpoint. Changes cover only the
separate release certificate, installer/publication verification, fixtures and
documentation. No production, hosted project, real VPS, provider activation,
migration edit or unrelated application/UI change occurred.

## Accepted certificate and preserved history

`release-79-v1/manifest.json`:
`84a020efb402f6a60e4b53c033cfebf01cc2f132cc28d8c1725f76e438ddbc3f`.
`schema-79.json`:
`26f64aaae03d2c4f0c0fd19dd763cc8ce7c84171e9c0a346147eaab4bd2ec3c0`.

Independent owned native compiler runs reproduced every final artifact byte.
The final compiler also proved six private empty buckets and the permanent seal
at every stage; its immutable `--write` mode verified existing bytes unchanged.
All 79 migration hashes and all 13 historical clean/portability bundle files
match the starting commit. The permanent bootstrap migration, original
certificates, legacy exclusions, production deployment helpers and existing
sealed receipt authority were preserved. No migration 80 was needed.

The new schema catalog adds private namespaces, complete trigger coverage,
function/table/column/default grants, effective schema privileges, browser/service
role flags and memberships, and all Storage object/bucket policies. Each stage
also verifies live managed ownership/ACL/RLS and the frozen public namespace.
Statement digests prevent matching names/counts from accepting altered history.

## Local acceptance

| Check | Result | Evidence boundary |
| --- | --- | --- |
| Full regression | **1,145 passed; zero failures/skips/cancellations** | Complete corpus, including unchanged historical engine-1 fixtures and new engine-2 release cases |
| Release-specific focused tests | **31 passed; zero failures/skips/cancellations** | Two complete guided brand flows, every migration interruption, receipt recovery, schema/history/grant drift and certificate/source tampering |
| Final standalone CLI/operations | **10 passed; zero failures/skips/cancellations** | Actual fresh CLI apply/complete resume and post-installation API/reset checks |
| Typecheck and production build | Pass | Node22.23.1, explicit empty dotenv, clean credential-free environment; existing missing-key/duplicate ERP import warnings |
| Compiled application input seal | **592 hashes pass** | Current production output corresponds to the certified application inputs |
| Existing browser matrix | **1,842 assertions /330 screenshots** | Product save, Media, editor, listing, bulk, CSV/XLSX transfer/import, warranty and reset; synthetic shells and Auth are declared by each suite |
| Two actual guided Nuxt/owner browsers | **176 assertions /24 screenshots** | Independent Cedar/Saffron origins, actual production Nuxt, PM2, Auth, PostgreSQL, Storage and PostgREST; explicit Linux/SSH/ingress fixtures |
| Total browser result | **2,018 assertions /354 screenshots** | Zero unexpected page errors or external requests; EN/AR, RTL, mobile and themes included |

Cedar and Saffron have different installation/project/owner IDs, origins, machine
IDs, SSH fingerprints, PM2 names, ports and independent encryption keys. Both
complete the guided preparation, separate database/publication confirmations,
normal migration path, publication, verification and exact resume.

The recovery brand loses responses at packaging, preflight, database planning,
owner verification, each migration72–79, migration79's SQL acknowledgement,
database completion, runtime preparation, publication planning/execution and
final verification. Exactly **10 native CLI jobs** remain: one baseline adoption,
one normal71 push and eight normal72–79 pushes. Resume never repeats migration79,
creates another owner or bucket, or rewrites the original component receipts.
Missing derived pointers are reconstructed only by their original engines.

Drift fixtures alter a migration statement, add an unknown public table, change
private usage grants, change certificate/application bytes or add an unknown
migration. Verification stops. Restoration occurs only within disposable test
fixtures; the installer never repairs or adopts that drift.

## Installed application and reset coverage

Fresh acceptance verifies zero products/categories/brands/business orders,
non-owner profiles, visitor/session records, Storage objects and private catalog
metadata. Neutral reference data, disabled singletons, Quick Setup identity and
one internal owner follow the unchanged clean-baseline policy.

Synthetic merchant fixtures begin only after that fresh proof and publication.
Actual native HTTP/SQL/Auth/Storage checks cover Draft creation, atomic revision
and retry receipts, bounded listing, durable bulk receipts, CSV/XLSX exports,
read-only previews, explicit approval/apply and safe pending-import invalidation.
Actual new-owner Chrome sessions enter Dashboard/Quick Setup and Products;
empty Cart/checkout initialize. Both compiled Nuxt publications also perform
Full Reset: actual durable public/private byte captures are removed, owner APIs
reinitialize, the seal/ledger survive and a new Draft product is created. A customer quote initializes and a disabled
payment method is rejected. Payments/providers/workers remain OFF. Synthetic
SQL order persistence is checked after Full; paid/provider checkout is unaccepted.

Both installed brand targets exercise all eight reset scopes. Each verifies the
complete schema/security catalog, unchanged 79-entry ledger and permanent seal,
managed Auth/Storage/Realtime ownership/ACL/RLS, valid foreign keys, existing
owner token and fresh password login, Chat and analytics initialization, and
scope-dependent file/Storage behavior. Products/Full close pending import
commands. Full removes captured private objects and fixture customer identities,
retains the owner, recreates disabled Chat/PDC settings and permits new products
and synthetic order rows.

The single-target eight-scope run advances only its synthetic reset-attempt
window to avoid waiting 15 minutes. The production limiter is unchanged and
retains its separate regression tests. Public image bytes, private attachment
bytes, warehouses, products, customer/staff identities and order rows are
explicit synthetic fixtures, never installer defaults or real business data.
The existing native reset suite additionally checks physical byte deletion,
changed-file pauses, lost Storage/checkpoint responses, retained Claims blockers,
permissions, concurrency and replay behavior.

## Evidence and limits

Secret-free logs, compiler reproduction, preservation inventory, sealed build,
browser reports/screenshots and command results are retained outside Git:
`/Users/imac/Documents/ELcomputer/beta-gate1b-installation79-20261014`.
A discarded initial fixture called the save-status endpoint as a listing. The
fixture was corrected to `/api/admin-products/list`; no application fix or
schema change was needed. A standalone recovery probe omitted its required
confirmation and correctly stopped; the confirmed rerun passed. Discarded results are not acceptance totals.

Actual native services: PostgreSQL17.11, Supautils, CLI2.109.1, Auth2.184.0,
Storage1.28.0, PostgREST16.4, strict local TLS/SCRAM, compiled Nuxt, isolated PM2
and Chrome. Realtime delivery and macOS representations of Linux/site-user,
SSH and Nginx/TLS ingress are explicit mocks. Browser component suites declare
synthetic Nuxt/Auth shells independently; they do not become native integration
claims. No real hosted target, production credentials or business data were used.

Known local blockers: **none found**. The migration-79 release is locally
certified for a separately authorized hosted staging acceptance. Actual managed catalog/policy delegation, extension
prerequisites, Auth/Storage/Realtime behavior, Linux/SSH/strict ingress, startup
reboot, backup restore and external restrictions still require that acceptance.
The certificate must reject a mismatch; it must not be rewritten to force a host.

Fresh-install verification is intentionally bounded to the empty installation
and publication handoff. Merchant/browser activity begins afterward. Occupied
live data must never be reset to make the fresh installer verify or resume.
Existing-production70→79 upgrade and production deployment remain separate tasks.

STOP after commit/push and review. BETA Gate2 is not authorized.
