# BETA Gate 1B: fresh installation through migration 79

This is a separate local release certificate, `release-79-v1`.
It extends the existing guided installation without changing its historical
source-70 baseline or migration-71 certificate. Hosted staging acceptance is
pending. Production remains owner-reported at migration 70 and was not accessed.

## Release identity

Application input checkpoint: `5b056d512b4897e1c3daa3805830617109abb4e3`.
All 592 application input hashes remain identical to that commit. Installer,
publication verification, tests and documentation form this release extension.
The installer additionally freezes the exact clean Git commit and tracked tree
of the checkout used for each installation. A later application edit requires
its own reviewed certificate; matching migration counts alone cannot certify it.

Certificate: [manifest.json](../supabase/bootstrap/release-79-v1/manifest.json).
SHA-256: `84a020efb402f6a60e4b53c033cfebf01cc2f132cc28d8c1725f76e438ddbc3f`.
Final schema artifact: [schema-79.json](../supabase/bootstrap/release-79-v1/schema-79.json).
SHA-256: `26f64aaae03d2c4f0c0fd19dd763cc8ce7c84171e9c0a346147eaab4bd2ec3c0`.
The manifest records all 79 filenames, versions and SQL hashes, exact retained
CLI statement digests, application hashes and every stage-71–79 catalog hash.
It contains no credentials, owner email, business records or live target data.

The source-70 baseline comes from `ae3a58d7a6e81a00b720bed49d8953aabd3bb160`,
checkpoint `20261012120000`. Migration71 portability records input
`4928dc7e636f8f96dda739401f29767b5e1263df`. These identities remain historical.

Historical certificate hashes remain:

| Artifact | SHA-256 |
| --- | --- |
| Source-70 `clean-v1/manifest.json` | `93a26458f2ebd7fbe5e38adfdc5cb4f8168f506f12447cf98de5cf18ad0b8be3` |
| Migration-71 `portability-v1/manifest.json` | `135e9cf17285dc39ecaf8baa1998836ef7f1891780e5b977ff610e643024c068` |

Migrations 1–79 and every file in both historical bundles remain byte-identical.
Historical plans and receipts remain immutable. Historical migration-71 sources
retain engine 1 and receipt format 1. This release uses engine 2 and receipt
format 2; it cannot reinterpret an old receipt as a migration-79 installation.
Use an old installation's exact original source/tool authority for its history.

## Supported installation order

1. Prepare an approved, genuinely empty Supabase target and publication host.
2. Apply the unchanged certified source-70 clean baseline.
3. Adopt exactly the 70 baseline-covered identities using the existing reviewed
   fresh-target `migration repair --status applied` procedure. None of their
   historical SQL is replayed. This authorization belongs only to the certified
   empty-target baseline and its recorded adoption intent.
4. Apply migration 71 normally with pinned Supabase CLI 2.109.1.
5. Create exactly one Auth owner, link it and permanently seal bootstrap using
   the existing migration-71 logic. Create the six private buckets through Storage.
6. Apply each migration 72–79 separately with normal `db push`, in the order
   below. Verify exact history, complete stage schema/security, empty data and
   owner sealing after each step. No normal migration is history-repaired.
7. Verify migration 79, six private empty buckets, one active owner, neutral
   Quick Setup, all external providers and workers OFF, and empty business data.
8. Publish the exact matching application through the existing guided publisher.
   Verify health and owner access before handing off to Dashboard Quick Setup.

| Ordinal | Normal migration version | Purpose | SQL SHA-256 |
| --- | --- | --- | --- |
| 71 | `20261012160000` | Installation bootstrap | `f518219c3fdd0a5d6a934da2bc84caee04d41d97dd5add0bd254ace85d6c0434` |
| 72 | `20261013120000` | Atomic product saves | `c084c89d5a10b24853cc93be28c40a9df5434f577095237e391d6fe3f6b32102` |
| 73 | `20261013140000` | Media reference safety | `6ec6a9bbfc18d01e0285e0e05e5ef2ae1d4c4fa86b84a5e17edcbb477920e409` |
| 74 | `20261013160000` | Draft creation default | `a305188a5ac9cfb84650ebaafdedd1af3e697e7ec510fae25cab5cc3dece7aed` |
| 75 | `20261013180000` | Product listing | `a05357c015651005746cad6fb496a9ec7c0308acefb5ed45ee635d4b3d084ca8` |
| 76 | `20261013200000` | Product bulk operations | `9ffa8745cc09cf1fb09a4453611c006756ab62fe53431b795bebddaa1868f145` |
| 77 | `20261014120000` | Catalog transfer | `b4bbaff0cf1c7010c6c9bd9b270262b92768b7a21c43eca63ed4e9c9f035b6ea` |
| 78 | `20261014180000` | Approved imports | `ae5e86e81ef76722ce9e6c9b8e4bff69f00289b99bf8257f94b681281658caf4` |
| 79 | `20261014200000` | Reset compatibility | `c7173c3e2a67e1d9fb3c1356ab27d9ed5d9bf0b21261dd48a078a7de8645ca11` |

The complete baseline-covered version list is the manifest's first 70 entries.
It is unchanged from the original clean-baseline inventory.

## Platform and protection requirements

Keep the prerequisites in [installation-cli.md](installation-cli.md) and
[guided-installation.md](guided-installation.md): Node 22.23.1, CLI 2.109.1,
PostgreSQL 17, non-superuser direct authenticated TLS, actual Supautils policy
delegation, managed Auth/Storage/Realtime ownership, disabled public signup and
anonymous Auth, and an unlinked clean source checkout. Managed roles, ownership
and RLS are never changed to make installation pass.

The new release also rejects an occupied `catalog_private` namespace or existing
policies on Storage objects/buckets before baseline application. A fresh managed
Storage target has no operator application policies. Public namespace privileges
and managed table ACLs are frozen as additional engine-2 identity evidence.
All application relations, columns, functions, indexes, constraints, RLS,
policies, grants, defaults, role flags/memberships and triggers are checked,
including public triggers implemented by private functions and Storage policies.

Migration 75 requires trusted `pg_trgm` 1.6 in `extensions`. Capability is checked
before owner creation. An existing exact extension is retained; otherwise only
that expected addition is reconciled after the certified migration-75 ledger
entry. Wrong namespace/version or any other extension drift stops execution.
Host-specific PostgreSQL catalog or role differences require review, not a
weakened certificate. Different platforms are not certified by local success.

Hardcoded production exclusions and the additional-only operator reservation
policy remain unchanged. Exact project, origin, TLS/CA, server, role, source,
SSH host key, machine, paths and publication binding remain mandatory. The
publisher rejects a bundle whose source differs from the installation plan.
Private files, independent key custody, two confirmations, exclusive leases,
checkpoint chains, supervised CLI exit proofs and upload durability remain.

## Recovery boundary

Every mutation has a protected pending checkpoint before execution. Resume
requires that original intent, exact statement history and the corresponding
schema/security proof. Lost acknowledgements reconcile committed work without
SQL replay. Completed resume only verifies live evidence and reconstructs the
derived receipt pointer; it creates no owner, bucket, migration or checkpoint.
The immutable component receipts remain authoritative for the coordinator.

Unknown history/statements, missing migration identity, changed source/security,
unknown child exit, occupied target or uncertain Auth creation stops the run.
A failed upgrade never receives baseline adoption or history repair. A sealed
owner remains sealed if any later step fails. Publication stays gated until all
79 entries and the final proof pass. Do not attempt an automatic SQL downgrade:
application rollback cannot undo these database migrations. Retain original
plans, receipts, keys and credentials for reviewed recovery or abandon only the
explicitly disposable target. Hosted backup/restore acceptance remains separate.

## Reproduction and evidence limits

`scripts/certify-installation-release79.mjs` accepts no target, DSN or credentials.
It creates its own disposable native services, applies the exact path above and
compares all artifact bytes. `--write` creates missing artifacts only; differing
existing bytes fail and require a new reviewed certificate version. Neither
mode rewrites historical evidence or changes a deployment target.

Local native services: PostgreSQL 17.11, Supautils, pinned CLI 2.109.1,
Auth 2.184.0, Storage 1.28.0, PostgREST 16.4, actual TLS/SCRAM, compiled Nuxt,
isolated PM2 and Chrome. Realtime delivery, Linux/site-user layout, SSH and
Nginx/TLS ingress are explicit fixtures. Synthetic merchant rows and the reset
limiter's synthetic clock advance occur only after empty-target acceptance.
No fixture or certificate creates initial merchant content or claims readiness
for payments, ERP, shipping, SMS or Email.

[Validation results](installation-release79-validation.md) distinguish native
integration evidence from browser shells and synthetic business data.

## Hosted staging acceptance still required

Use a separately authorized empty hosted staging project and prepared Linux
host. Verify actual catalog compatibility, managed policy delegation, Storage
API/physical cleanup, extension prerequisites, Auth and owner sealing, Realtime,
private file ownership, strict TLS/SSH/DNS ingress, PM2 startup/reboot, backup
restore and external access restrictions. Exercise interruption/recovery on that
staging target while providers remain OFF. Do not change hashes or repair history
if any checkpoint differs. Review and stop before any production proposal.

This task ends after local certification, commit/push and review.
It does not authorize hosted execution, production deployment or BETA Gate 2.
