# Gate 2B: release82 local installation authority

`release-82-v1` certifies the migration82 application inputs from
`084058e127f7964bf2ab2953f595f9abb9f1f521`. It adds installation engine3 and
receipt format3. Historical engines1/2, all migrations1–82 and all23 earlier
bootstrap artifacts remain unchanged. No application, payroll, checkout,
payment or inventory behavior changes in this task.

Certificate: [manifest.json](../supabase/bootstrap/release-82-v1/manifest.json),
SHA-256 `f6a9d75166154f5c1c2bd91b306f7a61157857d5a5b41d6442f95fafa047eeae`.
Final [schema-82.json](../supabase/bootstrap/release-82-v1/schema-82.json),
SHA-256 `903886ec96b483885b9f9507815ec60b4e877450d789f11f4eeb3cd2e015eee7`.
The manifest binds82 SQL identities/hashes, exact retained CLI statement digests,
597 application input hashes and complete stage71–82 schema/security hashes.
Stages71–79 reference the original immutable release79 artifacts; stages80–82
are new artifacts. The clean Git commit and complete tracked tree are additionally
frozen in each target's plan and package. The current tool also rejects a source reduced to71; historical engine1 uses
its exact original checkout/validator, so removing later SQL cannot bypass the
application seal. A different application input, SQL,
certificate, linked checkout or dirty tree fails `source_changed`.

## Supported fresh path

Use the protected inputs, exclusions, platform prerequisites and two separate
confirmations in [guided-installation.md](guided-installation.md). The public
commands and their protected workspace layout are unchanged.

1. Explicitly approve a genuinely empty, prepared target and restricted host.
2. Package the matching output and preflight the publication target before SQL.
3. Apply the unchanged certified source70 clean baseline. Adopt only its exact70
   covered identities, after the recorded fresh-only adoption intent. Historical
   migration SQL is never replayed.
4. Push original71 normally using pinned CLI2.109.1. Create six private buckets
   through Storage and create/link/permanently seal exactly one approved owner.
5. Push original72–79, then80 packing authorization,81 salary commands and82
   checkout commands, one normal migration per verified stage.
6. Verify exact history including statement digests, complete public/private
   schema, functions/triggers, RLS/grants/default privileges, managed ownership,
   Storage policies, sealed owner and empty business/private command state.
7. Prepare independent runtime keys and approve publication separately. Publish
   only matching `.output`, with durable uploads outside it. Verify owner access,
   health, original component receipts and disabled providers before merchant
   activity begins. The existing Dashboard Quick Setup is the handoff.

The permanent owner seal, target reservations and production exclusions remain
mandatory. An exclusion policy can only add exclusions. Unknown history,
statements, tables, privileges, source, keys, TLS/host identity, stale approval,
missing mutation intent or uncertain child exit stops the run. No history repair
or baseline adoption is allowed on an existing/populated target.

## Recovery and version boundaries

The original pending-before-mutation checkpoints, leases, CLI supervisor and
coordinator journals also cover80–82. Resume reconciles an acknowledged migration
against its exact catalog and ledger rather than replaying it. Completed resume
only verifies and reconstructs derived receipt pointers through the original
engine. It creates no second owner, bucket, migration or replacement key.

An old79 receipt remains evidence of79. It is never rewritten or upgraded into
a fresh82 receipt. Existing79→82 compatibility is rehearsed separately: verify
an installation made by exact approved79 source, retain its original workspace,
then execute original80,81,82 through sequential normal CLI pushes. Compare every
stage with this certificate and preserve all79 ledger rows/statements and the
owner seal. This rehearsal authorizes no real-host upgrade command. The fresh
publisher requires a matching source/installation/package and an empty prepared
publication path; it cannot reuse a79 receipt to publish82 or fall back to79
against82. Database downgrade and automatic rollback are unsupported.

## Reproduction and acceptance limits

`scripts/certify-installation-release82.mjs` accepts only optional `--write`.
It creates its own disposable native services, never accepts a DSN/target/key,
and compares71–79 with historical bytes before generating80–82. Write mode
creates only missing files; existing different bytes fail. Normal mode requires
complete byte-for-byte reproduction. A mismatch needs review and a new version,
not editing this certificate.

Required local tests include two independent fresh guided merchants with actual
Nuxt/PM2/Auth/Storage/PostgREST/PostgreSQL, migration and coordinator interruption,
acknowledgement loss, drift/security rejection, immutable79 upgrade history and
current business/reset acceptance. Merchant fixtures begin after empty acceptance.
[Validation and evidence](installation-release82-validation.md) distinguish real
services from simulated Linux/SSH/ingress, Realtime and merchant/failure fixtures.

This is local certification for separately authorized hosted staging acceptance.
Actual hosted catalog/delegation/Auth/Storage/Realtime, Linux/SSH/ingress,
crash/reboot supervision, backup/restore, load and merchant policy acceptance
remain separate. PM2 retains its existing `autorestart:false` configuration;
local publication/retry checks do not certify unattended recovery. Gate2 findings
and payment/provider exclusions remain open. Production is owner-reported70 and
must not be accessed. No hosted deployment or provider activation follows this
task automatically. Stop after validation, commit/push and review.
