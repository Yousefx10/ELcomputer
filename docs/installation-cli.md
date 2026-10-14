# BETA Gate 2B release extension

The separate [migration-82 certificate](installation-release82.md) now extends
the guarded fresh path through82 and binds publication to the corrected H1/H2/H3
application inputs. Historical71/79 certificates and receipts remain unchanged.
This is local authority only; hosted staging requires separate authorization.

# BETA Gate 1B release extension

The current separate [migration-79 certificate](installation-release79.md)
extends the guided fresh path through79 and binds publication to its exact
installation source. Historical milestone boundaries below remain evidence
for their original releases. Local certification does not establish hosted
acceptance.

# Guided fresh installation integration

Use [the guided entry point](guided-installation.md) for a new store's complete
journey. It delegates to this engine and M4, preserves all legacy hardcoded
exclusions, and adds one shared protected additional-only policy. M3 `plan`
also accepts `--policy FILE`; its binding stays frozen through check/apply/
resume/verify. Completed resume can re-publish the engine's derived receipt
after exact live verification, without replaying resources or checkpoints.
The historical milestone boundaries below remain unchanged.

# Phase 3, Milestone 4 publication integration

The separate [fresh application publisher](application-publication.md) now
provides guarded package/runtime/plan/check/apply/resume/verify operations for
an already completed M3 installation. Production, migrations 1–71, certified
bundles and production deployment helpers remain unchanged. Local actual
Nuxt/PM2/Auth/Storage tests use explicitly declared Linux/SSH/ingress fixtures;
real Linux/hosted/reboot acceptance remains pending. STOP for M4 review.
The milestone notes below retain their original historical boundaries.

# Phase 3, Milestone 3: guarded installation CLI

This operator tool initializes a fresh database, six private buckets and one
owner. It uses the unchanged `clean-v1` source-70 certificate and unchanged
migration 71. It creates no hosted project and publishes no application.
Production, VPS publication, provider activation and Phase 4 remain excluded.

## Approved target and prerequisites

Use a clean, unlinked checkout of the reviewed installation commit. Run
`npm ci` with development dependencies. The tested runtime is Node **22.23.1**;
the installer rejects other versions. Supabase CLI **2.109.1** is pinned exactly.
Its native package version and binary SHA-256 are checked. PostgreSQL must be
version **17**, with a direct authenticated TLS session as non-superuser
`postgres`, database `postgres`. Only the direct `db.<ref>.supabase.co:5432`
profile is accepted for a hosted project. Poolers, custom API aliases and
credentialed URLs are excluded.

The approved platform must already provide Auth, Storage, Realtime RLS and
actual Supautils policy delegation. Managed tables retain their owners;
the operator cannot own them or inherit their owning roles. Browser roles
cannot create public objects or bypass RLS. Supautils must allow the reviewed
policy DDL. The installer never creates managed schemas/roles, changes their
ownership, grants managed-role membership or disables RLS.

Auth settings must report public signup disabled and anonymous users disabled.
This prevents another identity arriving before first-owner sealing. The CLI
checks these prerequisites; it does not configure Auth or OAuth providers.
Supply a reviewed CA file for PostgreSQL. API TLS uses the system trust store
unless an explicitly supplied owned CA file is required. Both connections
verify certificates and hostnames. Certificate/CA, server, role, extension,
managed-object and native-tool evidence is frozen in the plan. Any drift stops
the run for review, including certificate rotation.

There must be no application objects, private bootstrap namespace, application
migration ledger, Auth identities, Storage buckets or objects. Empty managed
platform schemas and platform audit/migration tables are prerequisites. There
must be no merchant, catalog, ordinary customer, order or business history.
The known production project and every supplied excluded reference are blocked
before connecting. `elcomputer.net` and its subdomains are excluded as origins.

## Protected input

All input paths must be absolute and canonical, without symlinks. Credential,
owner, plan, result, receipt and checkpoint files must be owned by the operator
with mode **0600**. Installation workspaces must be **0700**, newly created and
outside the checkout. CA files may be readable but cannot be writable by others.
Use a private editor or secret-manager export for secret input; never put a
password, API key or credentialed DSN in command arguments or shell history.

The strict target JSON has these fields. Replace placeholders before use; no
credentials belong here.

```json
{
  "format": 1,
  "profile": "supabase-direct",
  "installation_id": "OPERATOR-APPROVED-UUID",
  "project_ref": "NEW-20-CHARACTER-REF",
  "api_url": "https://NEW-20-CHARACTER-REF.supabase.co",
  "site_origin": "https://your-approved-store.example",
  "database": {
    "host": "db.NEW-20-CHARACTER-REF.supabase.co",
    "port": 5432,
    "name": "postgres",
    "user": "postgres",
    "ca_file": "/absolute/reviewed-ca.pem"
  },
  "excluded_project_refs": ["zsqhuwgoasrexdnamlks"]
}
```

Optional `api_ca_file` must be an absolute reviewed CA path. The credentials
file has exactly `project_ref`, `database_password`, `service_role_key` and
`anon_key`. Routing comes only from the target. Legacy JWT keys must have the
matching project, expected role and unexpired claims; the TLS APIs authenticate
them. Opaque `sb_secret_`/`sb_publishable_` syntax is accepted, with hosted gateway
acceptance still pending. Do not substitute a browser key for the Admin key.

The owner file has `email`, `password` and optional `full_name`. Passwords must
contain 16–1,024 characters. There is no default identity or password. An owned
private regular file or FIFO can instead supply this JSON through `--owner-fd`
with a descriptor from 3–1,024. Close the writer after sending the bounded JSON.
Owner email/password, keys and credential hashes never enter public output,
plans, checkpoints or receipts. The private SQL journal retains only the
approved normalized owner-email digest and nonsecret request binding.

## Commands

Run from the frozen checkout with an explicit Node directory. The examples use
an empty environment so local production credentials cannot be inherited.
The tool never loads dotenv. It rejects ambient `PG*`, `DATABASE_URL`,
`SUPABASE*`, Nuxt credential variables and Node TLS/code-injection variables.
An existing `supabase/.temp/project-ref` or branch link stops source validation.
Use an unlinked checkout; do not alter an existing deployment checkout's link.

```sh
INSTALL_NODE_BIN=/absolute/node-v22.23.1/bin

env -i PATH="$INSTALL_NODE_BIN:/usr/bin:/bin" LANG=C node scripts/elcomputer-install.mjs plan \
  --target /absolute/private/target.json \
  --credentials-file /absolute/private/credentials.json \
  --out /absolute/private/new-installation

env -i PATH="$INSTALL_NODE_BIN:/usr/bin:/bin" LANG=C node scripts/elcomputer-install.mjs check \
  --plan /absolute/private/new-installation/plan.json \
  --credentials-file /absolute/private/credentials.json

env -i PATH="$INSTALL_NODE_BIN:/usr/bin:/bin" LANG=C node scripts/elcomputer-install.mjs apply \
  --plan /absolute/private/new-installation/plan.json \
  --credentials-file /absolute/private/credentials.json \
  --owner-file /absolute/private/owner.json \
  --confirm 'EXACT-REF:EXACT-INSTALLATION-UUID:EXACT-PLAN-DIGEST'

env -i PATH="$INSTALL_NODE_BIN:/usr/bin:/bin" LANG=C node scripts/elcomputer-install.mjs resume \
  --plan /absolute/private/new-installation/plan.json \
  --credentials-file /absolute/private/credentials.json \
  --owner-file /absolute/private/owner.json \
  --confirm 'EXACT-REF:EXACT-INSTALLATION-UUID:EXACT-PLAN-DIGEST'

env -i PATH="$INSTALL_NODE_BIN:/usr/bin:/bin" LANG=C node scripts/elcomputer-install.mjs verify \
  --receipt /absolute/private/new-installation/receipt.json \
  --credentials-file /absolute/private/credentials.json
```

Copy the exact confirmation from the successful `plan` result after reviewing
`plan.json`. Review the commit, target, installation UUID, origin, observed
capabilities and all frozen hashes. Confirmation is required for `apply` and
`resume`; elapsed time does not approve anything. A completed resume requires
no owner input and only verifies the sealed installation.

The equivalent npm scripts are `install:plan`, `install:check`, `install:apply`,
`install:resume` and `install:verify`, with flags after `--`. Unknown/duplicate
flags, mixed plan/receipt inputs and force/reset options are rejected. Output
is one bounded JSON result on stdout, with stage progress on stderr. Results
are saved as protected `result.json`; unsuccessful runs use fixed error codes
and messages without raw platform diagnostics. `--json` is optional because
JSON is already the default.

`plan` checks a fresh target and writes its frozen plan and initial checkpoint.
`check` validates the source, target, protected chain and observed stage.
`apply` starts only from the approved fresh plan. `resume` reconciles exact
authorized checkpoints. `verify` compares observed state without changing the
target. Read-only commands use shared advisory leases and never execute
migrations, create buckets/identities, reload PostgREST or configure settings.
They do write protected local command results.

## Installation stages and history

1. Install the certified final schema, explicit object permissions and neutral
   seeds in one transaction. Set the approved installation UUID atomically.
   Compare the complete catalog, RLS, functions, constraints, triggers, ACL
   matrix and seeds before committing. The original artifacts stay immutable.
2. Record adoption intent, then use the pinned CLI's explicit-version
   `migration repair --status applied` for exactly the 70 certified identities.
   No historical SQL is executed against the candidate. Names/versions and
   retained source statements are verified. Only the missing approved subset
   can resume after a partial adoption; unknown identities stop the run.
3. Apply migration 71 through normal `db push`. Verify all 71 ledger identities,
   the certified public catalog and complete private schema/permissions.
   Migration 71 is never repaired, replayed or skipped after uncertain DDL.
4. Verify neutral settings, all provider/payment controls OFF, NULL credentials,
   empty business tables and 17 zero generations. Bind the plan digest, source
   authorization, project, request, owner-email digest and origin to the private
   immutable journal. Reload PostgREST only after verified initialization.
5. Create exactly six private buckets through Storage APIs, preserving reviewed
   limits and MIME restrictions. Compare each API result with authoritative
   bucket rows. No bucket/object SQL writes or media copying occurs.
6. Use Auth Admin `createUser` once with confirmed email and exact server app
   metadata. Migration 71 atomically links the active owner, creates its audit
   record and seals bootstrap. The existing internal-analytics trigger creates
   one owner-only internal ledger row; it is not merchant business history.
7. Verify one accepted Auth subject, one internal owner profile, full owner
   permissions, one bootstrap audit, no ordinary profiles/business/media,
   dormant providers, exact schema/history and six private buckets. Write the
   protected completion receipt.

The CLI uses a generated unlinked workdir, hashes every copied SQL file and
passes the database password only through a 0600 PGPASSFILE. Credentials are
absent from URLs, native process arguments and forwarded diagnostics. A private
supervisor runs the actual pinned native binary, watches parent IPC death and
terminates it on disconnect. It records native-child exit before allowing
resume. The binary hash, parent/supervisor identity and exit evidence remain
protected; PGPASSFILE is removed after the child stops.

## Interruptions and stop conditions

Keep the entire workspace and frozen checkout. Filesystem and database leases
cover both the installation identity and target database. A live competing
lease is rejected. A dead filesystem lock can be archived only by `resume`
after matching its owner, host, plan, identity and dead PID. Unverifiable locks
are preserved. An outstanding CLI supervisor blocks resume; missing child-exit
proof stops on uncertainty. No forced takeover or resource cleanup is offered.

Append-only checkpoint files contain chained digests and stage intent before
every mutation. Each publication uses fsync and atomic no-overwrite placement;
`receipt.json` is a derived pointer. If receipt publication was interrupted,
use `resume --plan .../plan.json`; the contiguous protected chain remains
authoritative. Never edit checkpoints, forge exit proofs or reconstruct them
from the presence of tables. Losing the workspace loses automatic resume
authorization and requires operator investigation.

| Interrupted state | Supported reconciliation |
| --- | --- |
| Baseline rolled back | Recheck truly empty target; repeat the baseline transaction |
| Baseline committed, acknowledgement lost | Verify exact schema, ACLs, clean data and approved UUID; do not replay SQL |
| Partial source-70 history | Revalidate certified baseline and adoption intent; adopt only missing approved identities |
| Migration 71 response lost | Accept only exact schema plus its exact ledger identity; never repair a missing 71 entry |
| Bucket response lost | Match API and SQL definitions, recorded intent and object count; create only missing buckets |
| Auth response lost | Match the one server-marked request identity and authoritative SQL fields; never resend creation |
| Auth intent with no identity | Stop unresolved; do not create another identity automatically |
| Owner-link failure or lost acknowledgement | Resume exact subject/request or accept the sealed SQL receipt; no new identity |
| Completed owner demoted/deleted | Report owner unavailable; bootstrap stays permanently sealed |
| Unknown schema/history, extra users/content, changed provider controls | Stop; preserve target and evidence for investigation |

Generic error codes are fixed. `source_changed`, `target_changed`,
`checkpoint_changed`, `history_uncertain` and `bootstrap_uncertain` require
review of the corresponding frozen evidence. `platform_unavailable` requires
checking the exact runtime, TLS, role/delegation, Auth guards, API credentials
and pinned-binary prerequisites above. `lock_busy` means another lease or
supervised native job is active. `stage_uncertain` means use exact reconciliation
only after proving no CLI child remains. Never change privileges, reset a
project or use history repair as a workaround.

## Validation and acceptance boundary

Local tests use independently owned disposable TLS/SCRAM PostgreSQL 17.11,
non-superuser `postgres` without managed-owner membership, actual Supautils,
PostgREST 16.4, official Supabase Auth v2.184.0 and Storage v1.28.0 services.
Their own upstream Auth/Storage migrations create managed service tables before
the installer runs. Storage uses an owned file backend. A local TLS gateway
routes only these three services; no hosted or provider endpoint is available.
Realtime remains an explicit contract fixture; realtime delivery is unverified.

The suite exercises independent installations, native CLI history adoption and
normal 71 push, actual owner login, owner/non-owner/anonymous PostgREST access,
private bootstrap RPC denial and service Storage upload/list/delete. Direct
browser writes to private buckets stay denied. It checks wrong targets, keys,
passwords, TLS trust, inherited credentials, links, file permissions, hashes,
confirmation, locks, second apply, safe checkpoints, interruptions at all
critical stages, API response loss, child supervision and permanent sealing.
Test-only non-owner identities and temporary media are removed through supported
APIs inside owned fixtures; the installer performs no compensation deletion.

Configure `INSTALLER_REVIEW_PG_BIN` to a PostgreSQL 17 build with OpenSSL,
`SUPAUTILS_REVIEW_LIBRARY` to the actual extension and
`CATALOG_REVIEW_POSTGREST_BIN` to the native executable. The fixture optionally
accepts `INSTALLER_REVIEW_NODE_BIN` and `INSTALLER_REVIEW_SERVICE_TOOLS`.
The latter directory must contain `auth-server` compiled from the official
v2.184.0 source and a built `storage-1.28.0/` tree with native fs-xattr installed.
Existing application native fixtures also require the documented Email/Paymob
PG binary/driver variables. Do not count skipped native tests as acceptance.

```sh
node --test tests/installer-contracts.test.mjs tests/installer-platform.test.mjs
NODE_OPTIONS=--import=./tests/helpers/keepTestProcessAlive.mjs \
  node --test --test-concurrency=1 tests/*.test.mjs
npm run typecheck
npm run build
```

Public source archive SHA-256s used for this local profile:
Auth `286b6f0960a7fca741c46df1f6f1aa9f6d04d37d31ba5fbb4724160fe0fd22a3`;
Storage `308d97836e0eede17da01e057e37acbd1457fb9f57240d788be7762fc4a3175d`.
These identify test inputs, not hosted acceptance. Official sources are
[Supabase Auth](https://github.com/supabase/auth/tree/v2.184.0) and
[Supabase Storage](https://github.com/supabase/storage/tree/v1.28.0).
The existing [baseline certificate](clean-install-baseline.md) and
[private bootstrap contract](installation-bootstrap.md) retain their evidence.

The receipt is historical installation evidence. It is not a reusable owner
capability or launch approval. After deliberate merchant configuration, strict
fresh-state verification may report drift; it cannot reopen bootstrap. VPS
publication, hosted current platform/opaque-key acceptance, managed extension
profiles, live Realtime, Auth signup/OAuth, application session/Storage flows,
backup/restore and commerce/provider tests require later authorization. This
milestone makes no claim of hosted or production acceptance.
