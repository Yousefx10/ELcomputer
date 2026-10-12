# Phase 3, Milestone 4: first application publication

The separate `scripts/elcomputer-publish.mjs` publisher prepares one fresh
application on an operator-prepared VPS. It never runs the production helpers,
creates a Supabase project, runs SQL migrations, resets data, configures
providers, edits Nginx or manages unrelated services. Production remains the
owner-reported Phase 2 application with 70 migrations. Migration 71 remains
development-only. This milestone does not authorize hosted execution.

## Acceptance boundary

Local validation uses real compiled Nuxt, Node 22.23.1, PM2 6.0.14, TLS/SCRAM
PostgreSQL 17.11, actual Supautils, PostgREST, Auth and Storage in owned disposable
environments. Successful publication protocol tests use a **macOS target with
injected Linux/SSH/Nginx/ingress fixtures**. The public CLI has no fixture bypass.
Real SSH known-host parsing/fingerprints are tested without contacting a VPS.
A Linux VM/container/VPS is unavailable here. Real Ubuntu publication, SSH
transfer, systemd, Nginx reload/state, external DNS/TLS, reboot and hosted
Supabase acceptance are **pending**, including public reachability of the new
API. Fixture success is not hosted acceptance. Keep the IP restriction until
those checks and backup/commerce acceptance have separate approval.

## Prerequisites and target exclusions

Use a reviewed, clean, unlinked Git checkout, development dependencies from
`npm ci`, and exact Node **22.23.1**. The certified `clean-v1`, `portability-v1`,
original 70 source hashes and migration 71 must remain unchanged.

Retain the **original completed Milestone 3 workspace**, plan, complete
checkpoint chain and receipt. A detached saved receipt is historical evidence,
not sufficient publication authorization. The publisher verifies the receipt,
private sealed owner/bootstrap identity, exact schema/ACL and 71-entry history,
neutral data, six private empty buckets, zero ordinary customer/catalog/order
rows, one internal active owner and disabled provider/payment controls through
both direct authenticated TLS SQL and the intended Data API. No owner is
created again. Neutral data and OFF controls are rechecked after startup,
before completion can be certified. Concurrent configuration/business writes
stop acceptance and preserve the incomplete restricted site. `verify` remains a fresh-installation acceptance check; after
normal merchant configuration or business history, it stops instead of adopting
that changed state. Dashboard login may add ordinary internal audit records;
run the final publisher verification before exercising normal dashboard writes.

The operator supplies a protected `registry.json`, with `format: 1` and
`production` / `reserved` objects. Both contain arrays named `project_refs`,
`ssh_hosts`, `ssh_fingerprints`, `domains`, `users`, `paths`, `pm2_names`, `ports`.
The production list must include the known project
`zsqhuwgoasrexdnamlks`, domain `new.elcomputer.net`, user `newelcomputer`, path
`/home/newelcomputer/htdocs/new.elcomputer.net`, name `new-elcomputer`, port
`3001`, **and the independently confirmed production host addresses and ED25519
host fingerprints**. Populate all other occupied/reserved targets too. Do not
copy production credentials. Incomplete lists stop before connection. The tool
never opens `.deploy.env`, production SSH configuration or `.env`.

Prepare Ubuntu **24.04 amd64**, at least 512 MiB RAM and sufficient disk, a new
unprivileged user without privileged groups, no user cron jobs, existing PM2
home/processes or application output. Install Node and PM2 6.0.14 independently
in canonical paths. Reserve one unused nonprivileged loopback port. The tool
rejects the production project/domains/user/path/process/port, registry matches,
SSH identities and matching production IPs; it also rejects root, foreign
ownership, symlink aliases, writable private paths and occupied targets.
The exclusions depend on the operator's accurate infrastructure inventory;
unknown aliases are not discovered by accessing production.

Create owned mode-0700 home/parent directories, with these exact target paths:

- `/home/USER/htdocs/DOMAIN` absent or empty.
- `/home/USER/data/DOMAIN/uploads` absent or empty; media persists here.
- `/home/USER/.elcomputer-pm2` absent, separate from any PM2 installation.

Every input path is absolute and canonical. Private input/workspace/key files
are operator-owned mode 0600, directories 0700, outside Git. An explicit
single-entry ED25519 `known_hosts` file pins the host/port. Verify its fingerprint
independently; an unverified `ssh-keyscan` result alone is insufficient. Use a
new scoped SSH identity for the site user. SSH disables inherited configuration,
agent/password/keyboard-interactive authentication, forwarding and multiplexing.
VPS/domain DNS address sets must match and remain frozen. No default target is
inferred. Runtime Node and PM2 paths are explicit, not inherited VPS settings.

## Publication manifest

Create protected `target.json` in this shape; replace every placeholder:

```json
{
  "format": 1,
  "publication_id": "00000000-0000-4000-8000-000000000001",
  "installation_id": "00000000-0000-4000-8000-000000000002",
  "project_ref": "abcdefghijklmnopqrst",
  "site_origin": "https://fresh.example.com",
  "release_sha256": "PACKAGE_RESULT_RELEASE_SHA256",
  "ssh": {
    "host": "fresh.example.com",
    "port": 22,
    "user": "freshsite",
    "host_key_sha256": "INDEPENDENTLY_VERIFIED_ED25519_SHA256_FINGERPRINT",
    "known_hosts_file": "/private/operator/fresh-known-hosts",
    "identity_file": "/private/operator/fresh-ssh-key",
    "machine_id": "VPS_ETC_MACHINE_ID_32_HEX"
  },
  "site": {
    "app_path": "/home/freshsite/htdocs/fresh.example.com",
    "uploads_path": "/home/freshsite/data/fresh.example.com/uploads",
    "pm2_home": "/home/freshsite/.elcomputer-pm2",
    "pm2_name": "fresh-site",
    "port": 3042
  },
  "runtime": {
    "node_path": "/opt/node-v22.23.1/bin/node",
    "pm2_package": "/opt/elcomputer-pm2/node_modules/pm2"
  },
  "ingress": {
    "nginx_file": "/etc/nginx/sites-available/fresh-site",
    "certificate_file": "/etc/letsencrypt/live/fresh.example.com/fullchain.pem",
    "certificate_key_file": "/etc/letsencrypt/live/fresh.example.com/privkey.pem",
    "operator_ipv4": "192.0.2.44",
    "startup_unit": "pm2-freshsite.service"
  }
}
```

Project, installation ID and HTTPS origin must exactly match the accepted M3
receipt. API URL, supported public key and server privileged key are validated
against that project, with certificate checks. Wrong owner credentials cannot
publish. `ingress.ca_file` is an optional independently reviewed CA file for
isolated testing; TLS verification is never disabled.

## Operator ingress and reboot preparation

The operator prepares DNS, valid TLS and a **new** restricted Nginx site before
planning. Generate its exact expected text with this read-only command:

```sh
node --input-type=module -e 'import{readFileSync}from"node:fs";import{nginxConfiguration}from"./scripts/publish/contracts.mjs";process.stdout.write(nginxConfiguration(JSON.parse(readFileSync(process.argv[1]))))' /private/operator/target.json
```

Install that text as a canonical root-owned file without group/world write;
review, test and enable only the new site independently. Its 443 HTTPS ingress
allows the operator IP plus loopback, denies others, proxies exactly the approved
127.0.0.1 port, sets forwarding headers and returns the publication UUID marker.
Planning expects 502/503 with the marker because the new application is absent.
Successful health expects EN/AR 200 and authenticated owner Setup 200 through
HTTPS. The publisher verifies the exact file and live marker/certificate; it
cannot prove the entire effective Nginx configuration or IP denial from another
network locally. Review `nginx -T`, test an unapproved client and confirm the
new site resolves to the bound VPS during hosted acceptance. Do not inspect or
alter unrelated production configurations.

Prepare a dedicated root-owned enabled `pm2-USER.service` systemd unit for
**this PM2_HOME only**. The complete file must exactly match `startupConfiguration(target)` from
`scripts/publish/contracts.mjs`; generate it using the same read-only command
as Nginx, replacing `nginxConfiguration` with `startupConfiguration`. Its
scoped directives include:

```ini
User=USER
Environment=PM2_HOME=/home/USER/.elcomputer-pm2
Environment=PM2_PROGRAMMATIC=true
Environment=PM2_NO_INTERACTION=true
ExecStart=/opt/node-v22.23.1/bin/node /opt/elcomputer-pm2/node_modules/pm2/bin/pm2 resurrect
```

The exact template includes forking mode, the dedicated PID file, Node PATH,
network ordering and a stop command scoped to this PM2 home. Additional or
overriding directives are rejected. Enable it independently; do not start it before
first publication. The publisher checks its identity and enabled status,
then writes only its own PM2 dump after application acceptance. It never runs
`pm2 startup`, global restart/kill, systemctl changes, Nginx edits or reloads.
A real reboot must prove scoped resurrection and durable uploads later.

## Workflow

Use protected M3 credential and owner files; no secrets in shell arguments or
environment. Clear ambient PG/Supabase/Nuxt/Nitro/PM2/worker/deployment variables,
`NODE_OPTIONS`, custom TLS environment and SSH agent settings before running.
Node must be exactly 22.23.1. Parent directories below must already exist, be
owned and canonical. Each new `--out` and key-record directory must not exist.

```sh
npm run publish:package -- --out /private/operator/bundle
# Put the returned release_sha256 into the explicit target.json.
npm run publish:runtime -- \
  --target /private/operator/target.json --registry /private/operator/registry.json \
  --installation-receipt /private/operator/installation/receipt.json \
  --credentials-file /private/operator/credentials.json \
  --out /private/operator/runtime --key-record-dir /private/key-custody/fresh-site
npm run publish:plan -- \
  --target /private/operator/target.json --registry /private/operator/registry.json \
  --installation-receipt /private/operator/installation/receipt.json \
  --credentials-file /private/operator/credentials.json \
  --bundle /private/operator/bundle/bundle.json \
  --runtime-file /private/operator/runtime/runtime.json --out /private/operator/publication
npm run publish:check -- --plan /private/operator/publication/plan.json \
  --credentials-file /private/operator/credentials.json
npm run publish:apply -- --plan /private/operator/publication/plan.json \
  --credentials-file /private/operator/credentials.json \
  --runtime-file /private/operator/runtime/runtime.json \
  --owner-file /private/operator/owner.json \
  --confirm 'REF:DOMAIN:SSH_HOST_FINGERPRINT:PLAN_DIGEST'
npm run publish:verify -- --receipt /private/operator/publication/receipt.json \
  --credentials-file /private/operator/credentials.json --owner-file /private/operator/owner.json
```

The complete confirmation string comes from `plan`. Review the frozen plan
before supplying it. It binds the original receipt digest, source/dependency
and certificate hashes, complete output inventory, generated runtime ID, host
key/IP/machine/user, domain, paths, PM2 identity, Node, port and ingress. Node bytes and the complete dedicated PM2 node_modules tree
(including dependencies, modes and links) are hashed; drift stops. Any
changed source, credentials, private approved runtime, key custody, output,
identity or prerequisites stops. `apply` refuses a second run; use `verify` or
exact recovery. Completed verification creates only ephemeral locks and an
Auth session, not application/database provisioning.

## Artifact and private runtime

Packaging copies Git-tracked source into an isolated build workspace, supplies
an empty dotenv file and a minimal environment, and runs the actual production
Nuxt build. It packages **only `.output`**. Neither runtime secrets nor source,
private inputs, database contents, demo merchant data, uploads or production
media enter the archive. The complete inventory includes every directory,
file size/SHA-256/mode and relative in-bundle symlink target/hash. Absolute or
escaping links, special files, native platform binaries, unsafe modes and
unexpected tar members stop. A native dependency requires separately reviewed
Linux packaging; the tool cannot silently ship macOS binaries to Ubuntu.
The tar hash, inventory hash, release digest and clean source are rechecked
locally, after transfer, after extraction, before activation and on verification.
The source build/output workspace must remain available for safe resume.

The publisher applies the same known-value secret scan used by deployment,
without opening production `.env`: supplied new runtime secrets/passwords are
searched in all output bytes before transfer; privileged JWTs, `sb_secret_`
values and private key blocks are rejected independently. This is not a
complete detector for arbitrary unknown credentials. Clean tracked source,
minimal build environment and the protected dependency lock are the primary
boundary. Public build defaults carry no project credentials.

Runtime preparation generates **two independent random 256-bit encryption
keys**. It writes a separate mode-0600 independent key custody record; retain
and back it up securely before publication. Re-generation, substitution or
loss stops safe resume. The approved private runtime snapshot is outside the
output bundle and Git. No secret values or credential hashes are printed or
recorded in public plans/receipts. SSH sends runtime/owner acceptance data over
the pinned encrypted channel, through stdin rather than command arguments.

The remote mode-0600 runtime and launcher live under
`APP/.elcomputer-publication/`, outside `.output`. The PM2 daemon starts in a minimal environment and the process explicitly
filters inherited variables and Node arguments. The launcher also clears
inherited environment before loading only approved new-project settings. PM2 stores
only scoped identifiers, safe paths and interpreter settings; service keys and
encryption keys are loaded inside the application and excluded from its dump.
Uploads use the separately owned mode-0700 durable directory, never `.output`.
SMS, Email, Shipping and ERP worker secrets are blank, shipping live requests
and Paymob are false, payment integrations are empty, and the fresh database's
provider credentials/payment controls remain OFF. No schedules are installed
and no transaction is attempted. The operator must separately ensure network
policy and external schedulers do not enable provider traffic.

## Activation and failure recovery

Filesystem leases on the local workspace and dedicated remote user, plus M3
installation/global database advisory leases, prevent concurrent publication.
Stale locks reconcile only for the exact plan and a provably dead process.
A PID reuse or unverifiable outcome stops; do not delete a lock blindly.

The archive transfers into a protected staging area. Exact verified output
moves into `.releases/RELEASE_HASH`, then an atomic relative `.output` symlink
activates it. No previous application output is assumed or overwritten. PM2
creates one scoped process in fork mode with the exact Node interpreter,
loopback port, no watch/cron and no automatic restart. Existing or foreign
processes are rejected. The accepted process is saved only in the dedicated
PM2 home after EN/AR, RTL, Dashboard protection, anonymous denial, actual owner
Setup and private-runtime rendering checks. Nginx remains restricted even when
the secret-free local and remote publication receipts say complete.

If an operation fails or its acknowledgement is lost, preserve the complete
workspace, key custody, remote logs/state/receipt/archive/output and owner.
Close stops **only the matching newly created PM2 process** when acceptance is
incomplete. It never rolls back SQL, deletes Auth identities, removes output,
resets a project or changes ingress. Abrupt host/transport death may prevent
process stopping; the pre-existing operator IP restriction is the fail-closed
boundary. Do not release it based on a partial receipt.

```sh
npm run publish:resume -- --plan /private/operator/publication/plan.json \
  --credentials-file /private/operator/credentials.json \
  --runtime-file /private/operator/runtime/runtime.json \
  --owner-file /private/operator/owner.json \
  --confirm 'THE_SAME_FROZEN_CONFIRMATION'
```

Resume verifies exact identities and protected intent/checkpoint records,
retransfers partial bytes from the same archive, preserves incomplete
extraction under `interrupted-extraction-UUID`, verifies/reuses matching staged
output and atomic activation, and restarts only its own stopped matching
process. Unknown files/processes, changed hashes, completed modified releases,
missing intent or malformed state stop for review. A completed remote receipt
with a lost local acknowledgement can finish the local checkpoint chain.
A damaged derived local receipt pointer can be regenerated from the original
protected plan and complete chain via `resume --plan`; missing or damaged
original checkpoints cannot. No force, reset, rollback or target-adoption flag
exists. Interruption during initial remote directory/state creation may leave
unverifiable empty/partial initialization; preserve it for operator review
instead of guessing ownership or automatically deleting it.

## Validation commands and remaining acceptance

```sh
node --test tests/publisher-contracts.test.mjs tests/publisher-platform.test.mjs
NODE_OPTIONS=--import=./tests/helpers/keepTestProcessAlive.mjs \
  node --test --test-concurrency=1 tests/*.test.mjs
npm run typecheck
npm run build
node scripts/publication-browser.mjs
node scripts/neutral-storefront-browser.mjs
node scripts/setup-browser.mjs
node scripts/pdc-tracking-browser.mjs
```

Native tests need the documented isolated M3 PostgreSQL/Auth/Storage tools,
exact Node and PM2, plus an actual secret-free compiled output. See the M4
validation report for paths and actual results. Missing native tooling must be
reported as skipped, not acceptance. The fresh browser run exercises real
owner login; the broader Setup/neutral/PDC suites use their existing declared
fixtures and do not establish hosted Auth or VPS behavior.

Before Phase 4: review M4; authorize and complete compatible Linux/hosted SSH,
DNS/TLS/Nginx ingress/IP denial, Linux process ownership/mode and reboot checks;
complete Phase 3 Milestone 5 end-to-end/backup/recovery and separately approved
commerce/provider acceptance. Keep migrations, production, providers and
cloning untouched. Phase 4 import/export, portability packages and mapping
remain outside this milestone.

References: [PM2 programmatic API](https://pm2.keymetrics.io/docs/usage/pm2-api/),
[PM2 startup persistence](https://pm2.keymetrics.io/docs/usage/startup/),
[OpenSSH configuration](https://man.openbsd.org/ssh_config).
