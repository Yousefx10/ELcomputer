# ELcomputer project and deployment handoff for Claude

**Later continuity — 7 November 2026:** E332/E334 record subsequent owner-scoped
hosted Apple Pay and Modern checkout deployments. Latest reviewed baseline is
app `5ff85e59751474cf`, source `93bc457`, schema123; Classic checkout remains
selected and Apple Pay is owner-only. The schema122/Apple-OFF/local-only status
below is the earlier snapshot. Read the newest roadmap/handoffs before acting.
For legacy content, use [the WordPress access and migration guide](CLAUDE_WORDPRESS_DISCOVERY_AND_MIGRATION.md).

Prepared 7 November 2026, Asia/Riyadh. Task `CONT-CLAUDE-01`.

This is a documentation handoff. It authorizes no deployment, provider request,
payment, configuration change or Git push. Local files and Git were inspected;
the VPS and providers were not contacted while preparing it. Production details
below are the latest recorded evidence, requiring a fresh check before execution.

## Answer to “how do updates reach the server?”

Development and release preparation have run on this Mac, from Terminal/Codex,
using this project and its sibling Git worktrees. The recorded release process
builds a Nuxt production artifact locally, inventories and hashes it, and uses
pinned SSH/SCP to install it on the existing Hostinger VPS. A release-specific
operator checks the exact approved plan, stages the artifact, applies any approved
database change, switches the release and performs the approved systemd restart.
Some releases adopt an already staged artifact and upload nothing.

The production app runs under systemd behind Caddy. Supabase is hosted separately.
Database migrations use a separately authenticated PostgreSQL connection; an app
upload does not automatically migrate Supabase. Runtime settings, provider gates
and edge routing are additional parts of the release scope.

The observed process does not require Codex as the execution tool. Claude can
use the same reviewed scripts and local connection files if its environment can
access them. Claude in a browser without filesystem/terminal access cannot reach
this Mac's SSH key merely by reading this handoff.

Hostinger hPanel manages the VPS and recovery console. It is not the routine
release uploader in the recorded process. Git publication is also separate;
do not assume pushing `main` deploys anything.

## Start with these files

Read the newest dated entries first:

1. [AGENTS.md](../AGENTS.md): project rules and required domain contracts.
2. [Master roadmap](ELCOMPUTER_MASTER_ROADMAP.md): requirements and dated evidence.
3. [PROJECT_STATE.md](../PROJECT_STATE.md) and
   [CODEX_HANDOFF.md](../CODEX_HANDOFF.md): both continuity records.
4. [Remaining work and activation register](ELCOMPUTER_REMAINING_WORK_AND_ACTIVATION_REGISTER.md).
5. [Schema122 safe checkpoint](emergency-commerce-safe-checkpoint-20261106-schema122.md).

These are cumulative historical records. Several older paragraphs still say
“current” or “next action”; their dates and later completion/stop receipts matter.
An old review's approval phrase or deadline is not current authority. The latest
E329 entry records Claude's Apple Pay continuation after the earlier owner pause;
that does not resume unrelated paused work.

## Repository and source lineage

Main checkout:

```text
/Users/imac/Documents/ELcomputer/ELcomputer
```

At this inspection:

- `main` HEAD: `4a9ce1ce4d75912e4f37c16d6084f67d46717ebf`.
- Three continuity files already had uncommitted changes before this handoff.
- Git reported 80 worktrees. Several are inside ignored `logs/` directories.
- Production's recorded source is `9fa54a1`, not this checkout's `main` HEAD.
- Claude's Apple Pay branch has advanced to a committed, clean worktree.

Never reset, clean, prune, overwrite, or blindly merge this shared workspace.
Preserve other accounts' dirty files, indexes, untracked artifacts, receipts and
branches. Do not switch an occupied branch out of another worktree. Start a new
change from the verified deployed lineage or a deliberately reviewed descendant.
Inspect any deliberate cherry-pick or integration before rebuilding the candidate.

Useful local, read-only checks:

```bash
cd /Users/imac/Documents/ELcomputer/ELcomputer
git status --short --branch
git worktree list --porcelain
git log -6 --oneline
git -C ../apple-pay-hosted-20261107/source status --short --branch
git -C ../apple-pay-hosted-20261107/source log -3 --oneline
git -C ../apple-pay-hosted-20261107/source diff 9fa54a1..HEAD --stat
```

Most release candidates, tools, protected backups and receipts live outside the
tracked source tree or in ignored directories. A fresh Git clone is not a complete
copy of this working environment. Preserve those files during any machine transfer;
move credentials through a private channel, never through Git or this document.

## Recorded production target and local access

These values come from the target binding used by the latest deployed recovery.
They identify this deployment and must not be hardcoded into reusable app logic.

| Item | Recorded value |
|---|---|
| Public origin | `https://elcomputer.net` |
| Hostinger VPS | `srv1259611`, IP `168.231.104.25` |
| Release transport | SSH as `root`, default SSH port 22 in the reviewed launcher |
| App service/user | `storefront.service` / `storefront` |
| App root | `/srv/storefront` |
| Release selector | `/srv/storefront/current` |
| Release directories | `/srv/storefront/releases/<release-id>` |
| Local app port | `3000`; the target's `port` field is the app port |
| Edge service/config | `caddy.service`, `/etc/caddy/Caddyfile` |
| Server Node | `/opt/node-v22.23.1-linux-x64/bin/node` |
| Shared runtime file | `/etc/storefront/runtime.env` |
| Feature overrides | `/etc/storefront-feature-policy/` and systemd drop-ins |
| Supabase project | `amighioggheqddyypgcl` |
| Direct PostgreSQL | `db.amighioggheqddyypgcl.supabase.co:5432` |

The currently inherited target binding is:

```text
logs/historical-integrations-20261105/operations-dark-review-current/target.private.json
```

The latest recovery's `common.mjs` imports the P0 release's `ops/common.mjs`,
which loads that target file. It includes the pinned machine identity and paths.
Read only the specific fields needed; do not dump the entire private plan.

Existing access files were confirmed present locally, but login was not tested:

```text
SSH private key:
/Users/imac/.ssh/elcomputer_wordpress_migration

Pinned host-key file:
/Users/imac/Documents/ELcomputer/actual-vps-reinstall-preparation-20261020/fresh-known-hosts

Private database credentials:
/Users/imac/Documents/ELcomputer/private-production/amighioggheqddyypgcl/credentials.json

Database CA:
/Users/imac/Documents/ELcomputer/private-production/amighioggheqddyypgcl/prod-ca-2021.crt
```

The SSH key's historical name does not mean a WordPress import should run.
Never print the key, database passwords, service-role keys, HMAC secrets,
encryption keys, access tokens or private customer records. Do not rotate or
“test” provider credentials merely to identify them.

This bounded server inspection command is read-only. It has not been run for
this handoff and is not a deployment preflight:

```bash
ssh -T \
  -o BatchMode=yes \
  -o IdentitiesOnly=yes \
  -o StrictHostKeyChecking=yes \
  -o HostKeyAlgorithms=ssh-ed25519 \
  -o UserKnownHostsFile=/Users/imac/Documents/ELcomputer/actual-vps-reinstall-preparation-20261020/fresh-known-hosts \
  -o ConnectionAttempts=1 \
  -o ConnectTimeout=12 \
  -o ControlMaster=no \
  -i /Users/imac/.ssh/elcomputer_wordpress_migration \
  root@168.231.104.25 '
    hostname
    readlink -f /srv/storefront/current
    systemctl show storefront.service --property=MainPID,ActiveState,SubState,NRestarts
    systemctl show caddy.service --property=MainPID,ActiveState,SubState,CanReload
  '
```

Do not disable host-key checks, overwrite known-hosts, or substitute a new key
to get past a mismatch. Connection failure needs diagnosis; it does not justify
reinstalling the VPS. Avoid dumping `systemctl ... Environment`, `/proc/*/environ`,
runtime files or unfiltered provider logs into chat.

## Last recorded deployment and active controls

Latest hosted technical completion: 6 November 2026, 22:18:56 Riyadh.

| Item | Recorded state |
|---|---|
| Application release | `bea168064d2234bd` |
| Source commit | `9fa54a1a841a0b22571a66e8b77e9cf6daa8cca3` |
| Physical database checkpoint | schema122 |
| App PID then | `394646`; historical, recheck it |
| Recovery seal prefix | `8ba30439`, `CONSUMED_COMPLETE` |
| Hosted verification | 5,905 public file hashes and 176 protected projections passed |
| Scheduled monitor | 8 known warnings, 3 gaps, no critical finding then |
| CARD / COD | ON |
| Merchant-risk payment retries | ON |
| Apple Pay initiation | OFF |
| Coupons | Engine ON; unrestricted 95% + EGP50 offer OFF |
| COD fee | Fixed EGP10; proposed 0.5% fee is not installed/active |
| SMS | Provider OFF, daily limit 0, minimum interval 60 seconds |
| Regular SMS dispatcher | Not installed; old pilot closed/expired |
| Meta ordinary tracking / marketing | OFF |
| Brevo transactional email | ON; provider acceptances recorded, delivery acceptance still open |
| Daftra | Paused |

These flags are recorded operational state, not the default values in
`nuxt.config.ts`. Effective settings can come from runtime files, ordered systemd
drop-ins, database settings and account-scoped gates. Inspect their interaction
before proposing a change. Do not replace the runtime file wholesale or enable
an unrelated capability while changing a payment integration.

The last preservation report retained 25 payment attempts and 12 orders.
Those are dated counts, not expectations for every future preflight. Legitimate
customer activity must be reconciled rather than overwritten to match a snapshot.

## How to make and release a change

1. **Establish scope and source.** Read continuity, inspect shared worktrees,
   identify the current deployed source, and preserve an opening inventory.
   Keep one coherent change per release. Record requirements with stable task IDs.
2. **Implement locally.** Reuse existing abstractions and domain contracts. Use an
   isolated worktree and independent dependency/build caches when appropriate.
   Local reversible implementation can proceed within the owner's requested scope
   without repeated permission questions.
3. **Qualify locally.** Run relevant native/database and browser checks, typecheck
   and production build. Use fixture credentials, a sanitized environment and
   disposable databases; do not let tests discover production secrets. Record
   baseline failures honestly instead of hiding them or weakening assertions.
4. **Prepare the exact artifact.** Freeze the source commit, package `.output`,
   inventory every included file and hash the archive. Exclude secrets, `.env`,
   private media and local dependencies. Preserve required retained client assets
   through the compiled Nitro manifest and serving path.
5. **Prepare a target-bound release packet.** Bind source/artifact hashes, host
   identity, predecessor app/schema, migration contents, effective runtime and
   edge configuration, workers, backups, allowed writes and acceptance checks.
   Prepare an authenticated encrypted backup and validate restore/readback in
   isolation. Use a new packet directory; historical sealed inputs stay immutable.
6. **Present the concrete owner review.** State exactly what will change, what
   passed, remaining gaps, the approval phrase/seal and execution deadline. A
   deployment can include SQL, configuration or a restart only when explicitly
   included in that approved scope. Provider spending/public activation remain
   separate when they are not included.
7. **Execute once after approval and fresh preflight.** Recheck all sealed inputs,
   current host and data, backups, worker health and expiry. Let the specific
   operator stage/adopt, drain permitted timers, commit approved SQL, cut over,
   restart within its budget and resume timers. Do not improvise shell operations
   around a guard failure.
8. **Verify independently.** Confirm the active source/release/checkpoint, effective
   controls, protected data/security and actual HTTPS file bodies against their
   sealed hashes. Check EN/AR routes, privacy/method restrictions, worker recovery
   and the next natural MON run. Disk presence alone does not prove an asset is
   served. A 401/403 alone does not prove an owner workflow works.
9. **Record the result and acceptance boundary.** Update the roadmap and both
   continuity files together, plus the activation register when relevant. State
   local qualification, installed technical verification, owner acceptance and
   genuine provider/device acceptance separately. A passing deploy is not owner
   acceptance or permission to run a real transaction.

There is no universally safe “deploy now” command to copy from old notes. The
operator, packet and allowed operations are release-specific. Never execute a
historical `prepare.mjs` merely to learn what it does; some preparation programs
connect to production or create approval-like artifacts. Read the source first.

## Release machinery to inspect, not replay

The latest completed recovery is recorded under:

```text
logs/emergency-commerce-20261106/sms-ops-recovery/
  common.mjs
  prepare.mjs
  release-cli.mjs
  release-lifecycle.mjs
  release-remote.py
  apply-database.mjs
  OWNER-REVIEW.md
  packet/plan.json
  packet/seal.json
  packet/consumed-complete.json
  packet/postflight-assets.json
```

This recovery adopted a byte-identical already staged artifact, applied one
121→122 transaction and performed one app restart. Its original review still
contains the pre-execution label “UNAPPROVED”; the later consumed-complete receipt
and hosted checkpoint establish what actually happened. Do not rerun its CLI,
approval, migration, cutover, verification wrapper or recovery as a new release.
Read the immutable receipts and prepare a fresh scope for future changes.

Other useful examples:

- `logs/p0-merchant-risk-retry-20261105/ops/`: P0 app/migration operator and shared
  target/database helpers. Its edge correction has separate receipts.
- `scripts/premium-product-finishing-release/` and `scripts/pdc-v6-release/`:
  older checked-in examples of target-bound operators. Their plans and predecessor
  assumptions are historical.
- `docs/deployment-recovery-safety.md`: historical recovery contract; apply current
  task authority and current packet semantics before any action.

**Do not use `npm run deploy` for this production target.** In the checked-out
source, `scripts/deploy.sh` / `deploy-remote.sh` lock onto the older
`newelcomputer`, `new.elcomputer.net`, port3001 and PM2 deployment. Current records
use `storefront`, Caddy and systemd on port3000. The old `.deploy.env` is not proof
that this legacy route is appropriate now. Generic install/setup/publish helpers
also have their own certified boundaries; do not use them to bypass current guards.

`deployments/elcomputer/clean-reinstall.json` is historical preparation with old
source/disabled-commerce assumptions. The Hostinger reinstall procedure is not
an update procedure. Do not run OS reinstall, accepted WordPress/customer imports,
old bootstrap bundles or migration repair to update the current application.

## Database, assets and operational guards

Use reviewed migrations and actual hosted checkpoint/history evidence. Do not
edit applied migrations, manufacture migration-history rows, skip permissions,
disable RLS, grant broad access, or run `supabase db push` casually against this
project. Physical123/124 are proposed follow-ons, not installed or reserved slots.
The number of SQL files in an old checkout does not establish the live checkpoint.
Required PostgREST schema-cache notifications must be included and verified.

Stop on SQLSTATE `42501`, `55000`, `42710`, lock/policy/checkpoint mismatch, seal or
host drift, `REMOTE_GUARD_STOP`, `CADDY_RESTART_STOP`, `MON_WARNING_DRIFT`, failed
workers, or an acknowledged/ambiguous mutation. Preserve the exact receipts and
reconcile read-only. Do not retry a consumed operator, infer that a timed-out
command did nothing, or perform an automatic rollback. A recovery needs a new,
narrowly reviewed scope and authority. An operator's explicitly approved in-flight
transaction rollback or timer recovery is governed by its existing contract.

Caddy requires particular care: the installed setup has had `CanReload=no`, with
the admin API disabled. Prior corrections used a separately qualified signal path
after an isolated test of the exact installed binary. Do not assume
`systemctl reload caddy` works, fall back to restart, or send a signal based on
this historical description. MON pins Caddy's hash; a routing change also needs
the explicitly reviewed monitor binding and a subsequent natural report.

The existing scheduler units recorded in the last release were:

```text
commerce-monitor.timer
storefront-customer-email.timer
storefront-pdc-tracking.timer
storefront-vodafone-transactional-pilot.timer
```

An enabled pilot timer does not authorize sending after its closed latch/expiry.
Do not invoke workers manually to generate acceptance evidence or “fix” a failed
health gate. Pause/drain/resume only within the exact release's authority/budget.

Private packing videos and shipping documents live outside release output:

```text
/srv/storefront/shared/private/packing-videos
/srv/storefront/shared/private/shipping-documents
```

Protect durable media and private Storage. Never replace them with a build or
turn private buckets public. Nitro assets must be checked through real serving
routes, including retained hashes needed by existing browser sessions.

## Application map and local development

This is a reusable ecommerce product; ELcomputer is one deployment. Reuse site
settings and runtime configuration. Keep store names, origins, project IDs,
deployment paths and owner account IDs out of reusable business logic.

The inspected package uses Nuxt4/Vue3, Nitro server APIs, Tailwind4, Supabase
Auth/PostgreSQL/Storage, `pg`, and English/Arabic localization. It includes a
storefront, customer accounts, a staff Dashboard, catalog, inventory/procurement,
orders, payments, shipping, communications and integrations.

| Location | Purpose |
|---|---|
| `app/pages`, `app/components`, `app/composables`, `app/utils` | Vue UI and shared presentation logic |
| `i18n/locales` | English/Arabic copy; verify the active worktree's layout |
| `server/api` | Nitro API handlers and access boundaries |
| `server/utils/payments` | Paymob, checkout, callback and payment lifecycle logic |
| `server/utils` | Catalog, shipping, communications and other server services |
| `supabase/migrations` | Versioned SQL; use the correct source lineage |
| `tests` | Native, contract and browser suites, including disposable DB helpers |
| `scripts` | Development/qualification/installation/release tools of varying scope |
| `logs`, sibling preparation directories | Local operational evidence, artifacts and worktrees |

Reproducible release qualification uses **Node22.23.1 / npm10.9.8** and the matching
lockfile. The default `node` found on this Mac during this handoff was
`/usr/local/bin/node`, **v24.16.0**. Select and verify the pinned Node22 toolchain
before claiming reproducible checks; do not silently qualify a release on Node24.
The server's `/opt/...` executable path is not a local Mac executable path.

Available app commands include `npm run dev`, `npm run typecheck`, `npm run build`
and `npm run preview`. There is no generic `npm test` script in the inspected
package; choose the relevant `node --test` suites and their required fixtures.
Build/preview only in a disposable candidate environment with deliberate safe
configuration. Do not point development at live providers or start a compiled
server using an inherited production environment.

Native integration checks have used PostgreSQL17 and dedicated fixture helpers;
browser checks include Chromium/WebKit and EN/AR, RTL, mobile and theme behavior.
See the actual worktree's scripts and saved qualification receipts before running
them. Preserve accepted evidence for identical sealed bytes; rerun checks when
the change, drift or a new failure justifies it.

## Current Claude Apple Pay work

Worktree and branch:

```text
/Users/imac/Documents/ELcomputer/apple-pay-hosted-20261107/source
claude/apple-pay-hosted-20261107
```

Locally verified HEAD: `d112f3c0f3ad61f46de13193eef3e8d0edf98ad9`,
“Offer Apple Pay through Paymob hosted checkout”, parent `9fa54a1`.
The worktree was clean. E329's “No commit” sentence is now stale; this inspection
does not establish a push, deployment, changed live configuration or live payment.

The dated diagnosis describes the embedded Pixel route failing before native
confirmation, with the association-file URL blocked by Caddy. The proposed
alternative uses Paymob hosted checkout for Apple Pay. Treat this as recorded
investigation and local implementation, not a newly verified provider conclusion.

The candidate adds `hosted: true` and optional `customerIds` to Apple registry
entries. Each attempt creates one Apple-only Intention; SQL binds one integration
per attempt, so do not mix card and Apple integrations in one session. The signed
callback logic accepts the candidate's allowed Apple/card labels while preserving
integration checks. Relevant new coverage includes `tests/apple-pay-hosted.test.mjs`.

E329 reports 130 payment tests passing, four baseline-matching failures, typecheck
and build passing. Those tests were not rerun for this documentation handoff.
Pending work includes Paymob confirmation of the actual callback shape, an exact
schema122-bound release review, a separately reviewed owner-scoped configuration
change, one authorized genuine owner/device test, and later public rollout.
The candidate proposes no SQL change. Do not flip the existing Apple-OFF overlay
or expose it to all customers simply because the code is committed.

## Other unfinished work and financial boundaries

- **Regular SMS:** controls are installed, sending is OFF. Packet `d17bae75` is
  WITHHELD/UNAPPROVED/NOT EXECUTED. Its binding treats `next_request_at` as fixed
  configuration although queue claims update it. The dedicated regression,
  corrected worker and replacement packet were unfinished at the checkpoint.
  The proposed 5/day, 35 total, seven-day allowance is not spending approval.
  Do not renew the expired pilot, replay historical orders or send a test SMS to
  qualify this defect. See the schema122 checkpoint and SMS transition review.
- **Coupons/COD:** the coupon engine is ON; preserve restricted offers/history and
  the disabled unrestricted offer. COD delivery-coupon parity and percentage-fee
  foundations remain local. Operator drafts are incomplete/unsealed. Fixed EGP10
  remains; do not install123/124 or enable0.5% under another feature's approval.
- **PDC:** an older booking is uncertain with no established AWB/PDF; do not
  rebook it. Physical packed-parcel/provider acceptance remains open. A local
  diagnostics wrapper passed12tests but is uninstalled. A transient scheduled
  tracking failure later recovered naturally; that does not authorize a poll,
  credential test, booking, cancellation or tracking-budget change.
- **Brevo:** provider acceptance is not inbox delivery. Keep Auth SMTP and
  transactional/marketing channels distinct; do not resend accepted tests merely
  to create new evidence.
- **Meta:** one bounded real PageView provider acceptance was recorded, then
  cleanup left ordinary tracking OFF. Events Manager receipt, deduplication,
  ViewContent/SKU/catalog/value acceptance remain open. Customer consent and
  exact event authority matter; a retained token is not transmission permission.
- **Daftra and Beta:** Daftra remains paused. Material Beta restrictions and
  deferred owner acceptance remain; do not remove warnings to imply completion.
- **InstaPay/manual transfer and other methods:** installation or Dashboard
  visibility is not activation. Check current gates before touching any method;
  this handoff supplies no recipient, transfer or balance-funding authority.

Unknown payment outcomes must remain unknown until authenticated evidence resolves
them. Closing a payment UI does not prove no charge, provider cancellation or a
failed financial result. Merchant-risk retries are deliberately enabled, with
purchase-lineage protection for one fulfillment. Preserve extra successful
transactions for staff review; never automatically refund, delete attempts,
force orders paid, fabricate callbacks or clear uncertainty to make a test pass.

## UI, authorization and product contracts

Preserve the Dashboard identity and existing compact components, EN/AR, RTL,
Light/Dark/System and responsive behavior. Use short natural copy; never invent
product facts, descriptions or media. Avoid unrelated redesigns.

Reuse existing authentication, RBAC, named permissions and RLS. Never special-case
the deployment owner, bypass permissions to recover access or weaken restrictive
origins/edge routes. Product/editor changes require the contracts linked in AGENTS:

- [Product saves](product-save-safety.md): atomic commands, request receipts,
  revision conflicts, audit and inventory ownership.
- [Product editor](product-editor-safety.md): Draft-first creation, retained drafts,
  navigation guards and independent section saves.
- [Media](media-safety.md): reference coverage, validation, scoped public access
  and deletion recovery; private media stays private.
- [Listing](product-listing.md) and [bulk operations](product-bulk-operations.md):
  bounded search, confidential projections, current-page selection, explicit
  sparse commands and truthful partial receipts.
- [Catalog transfer](catalog-transfer.md) and [approved import](catalog-import.md):
  private bounded preview, exact matching, omitted versus cleared values,
  explicit apply approval and preserved ERP/inventory ownership.
- [Checkout commands](checkout-command-safety.md): preserve the active branch's
  idempotency, authorization and recovery contracts.

For the current Apple Pay continuation, the useful next step is to read the
candidate diff and latest deployment evidence, then establish fresh read-only
server identity/state and prepare the exact review for the intended change.
Do not replay the schema122 recovery or activate a provider from this handoff.
