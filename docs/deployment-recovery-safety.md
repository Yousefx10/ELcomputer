# Deployment rollback compatibility — local implementation, 2026-10-11

The guarded release stopped before production checks or SQL because both deployment helpers automatically restored older output on failure. Migration68 revokes confidential catalog column privileges; the old Dashboard wildcard readers cannot fully edit products afterward. This task changes deployment helpers and documentation only, from clean synchronized `4c9d26c`. No production connection, migration, deployment, PM2 operation, provider/configuration change or database access occurred.

## Exact mode selection

Ordinary compatible deployments retain automatic rollback:

```sh
env -u DEBUG npm run deploy:check
env -u DEBUG npm run deploy
```

For the **pending 64–69 coordinated release containing incompatible migration68**, after separate authorization and fresh entry/database gates, use:

```sh
cd /Users/imac/Documents/ELcomputer/ELcomputer
env -u DEBUG PATH=/private/tmp/elcomputer-preflight-20261010/node22/node-v22.23.1-darwin-x64/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin npm run deploy:check -- --manual-recovery
env -u DEBUG PATH=/private/tmp/elcomputer-preflight-20261010/node22/node-v22.23.1-darwin-x64/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin npm run deploy -- --manual-recovery
```

These are future commands, not executed in this task. Bare `npm run deploy` must not be substituted for this release. `--check` and `--manual-recovery` can appear in either order. Unknown options fail. The mode is invocation-specific, initialized to automatic and read-only after CLI parsing; environment/configuration cannot silently change it.

## Enforcement across both helpers

- Local preflight streams the reviewed remote helper and requests `check manual`. A successful check must return the exact versioned line `ELCOMPUTER_RECOVERY_MODE=manual:v1`. Missing support, a failed check or missing acknowledgement stops before build/upload/activation.
- Local prepare/deploy calls explicitly carry the selected mode. Remote prepare creates a private `manual-recovery` marker. Remote deploy independently validates the mode and marker before modifying output; a missing/mismatched marker stops. An automatic deployment cannot consume marked staging.
- Remote direct restart/health failures and EXIT/ERR/INT/TERM/HUP traps all honor manual mode. The rollback function itself rejects it. No old output is moved back, no fallback restart occurs, no staging is deleted and no backup is pruned. Local public HTTPS failures, errors and signals also preserve artifacts and never request rollback or cleanup in manual mode.
- Manual mode also rejects unexpected early exits with status zero. Local success requires the requested preflight or public health sequence to finish; a remote EXIT trap before verified completion returns failure and preserves artifacts. An exceptional shell exit cannot silently stand in for mode/health verification.
- Remote `rollback`/`cleanup` refuse the same marked release. Later ordinary retention excludes its marked backup. This is an accidental-recovery guard, not a replacement for human authorization or a protection against an operator manually removing files.
- Manual deployments require SHA-256 evidence before activation. Failure to create it stops while current output remains unchanged. A failure during the two output moves can leave `.output` missing, with previous output in the backup and new output in staging; neither is restored automatically.
- Existing user/path/Node 22.23.1/fork/PM2 entry/interpreter/runtime validation, secret-free build and scan, output-only archive, retries/timeouts and `new-elcomputer` restriction remain. Neither helper performs a database operation, grant/RLS change or unrelated restart.

**Downtime is possible.** A restart failure, incomplete swap, failed health check or interrupted deployment may leave the site unavailable. A nonzero result is a STOP, not permission to retry deployment or invoke recovery. Maintain the Dashboard editing window and preserve artifacts until a human separately authorizes a reviewed recovery or compatible forward fix. Never restore insecure grants, weaken RLS, or roll back database migrations automatically.

## Retained artifacts and access

Local manual-mode output prints an owner-only `elcomputer-deploy-evidence.XXXXXX` directory under `TMPDIR` (0700), with `deployment.json` (0600): phase/status/time, archive path/SHA-256, remote staging and both helper fingerprints. The package `elcomputer-deploy.XXXXXX` remains 0600. `public-health.log` retains curl diagnostics without response bodies. The empty build dotenv is still removed. Preserve/copy these files into the authorized incident archive before OS temporary-directory cleanup; do not publish them.

The server retains the current `.output`, previous `.output-deploy-backup-<release-id>` and `.deploy-staging-<release-id>` (0700). Staging retains the uploaded archive, any remaining extracted output, marker, phase evidence JSON (0600), PM2 restart diagnostics and remote health diagnostics. Pre-activation evidence hashes the complete old/new file inventories and archive, records symlink targets without following links, and remains available after activation. Later failure/completion evidence records the then-current locations. No environment dump, raw PM2 jlist, response body or secret value is added to evidence.

Manual success also retains all these artifacts and all earlier backups, including the pre-SQL copy. Cleanup is deliberately deferred to separate reviewed human action; disk capacity and retention must be reviewed before a later release. Forced termination such as SIGKILL, host loss or exhausted disk cannot run traps or guarantee final diagnostic capture; required pre-activation evidence and already-written artifacts remain, and no manual path restores old output.

## Current release and recovery limits

The last verified preparation at `4c9d26c` recorded production 63, repo69, six pending migrations 64–69 and all controls OFF. This task does not reverify production. All migration files remain byte-identical. The recorded encrypted restore-tested backup is `/Users/imac/Documents/ELcomputer/production-database-backups/20261011T121248Z`; the preserved pre-SQL output is `/home/newelcomputer/htdocs/new.elcomputer.net/.output-deploy-backup-20261011-121937-33243`.

The external preparation report/commands are amended to require manual mode and withdraw the old executable output-fallback example. Their original frozen source/evidence remain historical. **The old release-entry guard pins `4c9d26c` and must reject the new safety commit.** After review/authorization, prepare a new reviewed source freeze and fresh execution-time checks; do not bypass or casually edit that guard. Reconfirm recovery freshness/access, exact six hashes/history, target/concurrency, OFF controls/backlogs, delegated Storage capability and cache/acceptance gates before SQL.

Plan the documented Dashboard product/procurement/inventory editing window before migration64, and keep it closed until matching application, database/cache/privacy checks and refreshed authorized staff acceptance pass. Providers, Claims policies, communications and outbound workers remain OFF. Old application output alone cannot restore full product editing after68. No recovery command is authorized by this implementation.

## Validation

`tests/deployment-recovery.test.mjs` executes copies of both Bash scripts inside owned temporary fixtures. Only those copies rewrite locked filesystem paths. SSH/SCP/curl/npm/PM2/whoami/git are replaced by fixtures; SSH/SCP refuse any destination other than `fixture.invalid`, and PM2 refuses any operation other than reading fixture metadata or restarting the fixture's `new-elcomputer`. The tests never use deployment credentials or open sockets. Real tar/mv are confined to owned paths.

Cases cover default restart/remote timeout/public HTTPS/error/INT/TERM/HUP rollback; manual equivalents with no old restoration; local signals/upload/error cleanup; unexpected local/remote zero exits; successful retention; protected backups during later normal retention; missing acknowledgement/marker, extraction/hash/build failure, strict mode/argument handling and wrong target identity. Hashes, permissions, backup contents and exact restart count/target are asserted. Existing static target/runtime/archive/secret guards remain tested. Live `deploy:check` is intentionally not run under this task's no-production restriction.

Final validation on Node 22.23.1: **795 tests passed, zero failures/cancellations/skips**, including **42 deployment checks** (35 new executed failure/retention fixtures and 7 existing guards). The complete suite includes native PostgreSQL 17.11/PostgREST 16.4/actual Supautils tests and checkout, payment, catalog, product management, inventory, warranty, claims, shipping, SMS and email regressions. `npm run typecheck`, `npm run build`, Bash syntax/help and `git diff --check` passed. Build/typecheck retain existing duplicate ERP import, sourcemap, chunk-size and preorder warnings. All 69 migration files were independently byte-compared to `4c9d26c` and are unchanged.

Local logs/report: `/Users/imac/Documents/ELcomputer/deployment-rollback-safety-20261011`. Earlier fixture iterations are retained separately from the final passing full run. No authenticated production/browser/provider acceptance is claimed by mocked deployment tests.

The rollback-compatibility implementation blocker is resolved locally. Remaining release gates are review/authorization of the new commit, a new reviewed source freeze (the old guard must fail), fresh live prerequisites and recovery checks, the coordinated editing window, ordered migration/cache verification and hosted customer/staff acceptance. **STOP after commit/push. No deployment is executed.**
