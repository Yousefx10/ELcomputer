# Phase 3, Milestone 4 local validation — 2026-10-12/13

Reviewed development base: `bffd12cd620e484c674262bf82c19bff1eac25a3`.
Scope: the separate first-time application publisher, its tests and operator
runbook. Production was not accessed. No real Supabase project/VPS was created
or used. Migration sources 1–71, both certified bundles, schema reference,
production deployment helpers, application/UI source, Nuxt configuration and
dependency lock remain byte-identical to the base.

## Results

| Check | Current result | Evidence boundary |
| --- | --- | --- |
| Full regression | **905 passed; 0 failures, skips or cancellations** | Node test runner, concurrency 3, isolated native fixtures |
| Focused publisher | **24 passed; 0 failures or skips** | 7 contract/CLI checks plus native protocol parent and 16 scenarios |
| Production deployment regression | **42 passed; 0 failures or skips** | Existing safety/recovery helpers exercised through their disposable mocks; no live deploy/check |
| Typecheck | Pass | Node 22.23.1; expected empty-key notice and existing duplicated `getErpSettings` warning |
| Production build/package | Pass | Actual Nuxt production build in clean unlinked source mirror, empty dotenv, minimal environment |
| Output inventory | **1,042 entries: 786 files, 253 directories, 3 links** | Full bytes/modes/link hashes; uploaded/extracted/staged inventory checked |
| Actual Nuxt browser | **52 assertions, 9 screenshots** | Real local Node/Nuxt/PM2/Auth/PostgREST/Storage/PG; new owner login, non-owner 403, anonymous dashboard denial, neutral catalog, EN/AR, RTL, desktop/mobile, light/dark, unchanged Phase 2 revisions |
| Neutral storefront browser | **229 assertions, 32 screenshots** | Existing actual Vue/content-reader fixtures |
| Setup browser | **1,171 assertions, 146 screenshots** | Existing Vue/H3/SQL fixtures; fixture Auth, Phase 1/2 compatibility |
| PDC browser | **495 assertions, 48 screenshots** | Existing component/API fixtures; fixture authentication |
| Browser errors/external requests | **0 / 0** in all four suites | Browser request interception; does not certify OS-wide hosted egress |

The focused and full runs include `NODE_OPTIONS` test preloading. An initial
full run caught PM2 inheriting the preload into the application. The publisher
now starts its daemon in a minimal environment, explicitly filters process
inheritance and fixes Node arguments. The complete rerun passed all 905 checks;
the initial failing run is not counted as acceptance. A final exclusion-registry
type review added fail-closed checks for malformed ports, fingerprints, project
references and paths; both contract and complete regression runs were repeated. Private `umask 077`
extraction/mode preservation, relative symlink copying and browser hydration
were also corrected before final acceptance.

## What ran with real services

Owned macOS x86_64 fixtures use Node **22.23.1**, PM2 **6.0.14**, authenticated
TLS/SCRAM PostgreSQL **17.11**, actual Supautils policy delegation, PostgREST
**16.4**, native Auth **2.184.0** and Storage **1.28.0**. M3's actual pinned
Supabase CLI initializes each disposable platform before publication. Auth
Admin APIs create the fixture owner; no fake owner bearer is used for the
publisher's owner health proof or the new Nuxt browser login.

Publication tests execute real tar transfer/write/extraction, complete output
hash/mode/link verification, independent encryption-key generation, private
runtime files and launcher, atomic activation, isolated PM2 creation, Nuxt
startup, loopback HTTP, live owner Setup access and anonymous denial. They
reject occupied ports, concurrent claims, changed runtime/source/receipt,
reserved production identities, unsafe paths/modes/links, private SSH key mode
and wrong host fingerprint. CLI production/ambient-credential/force rejection
occurs before reading a receipt or opening services.

Eight stage acknowledgements are intentionally lost: transfer, artifact,
runtime, staging, activation, process, health and receipt. Every case reconciles
the exact frozen plan and verifies completion without creating another owner.
Additional cases preserve partial transfer/extraction evidence, recover a
derived local receipt pointer, stop only the matching new process on startup
failure, reject database drift before final receipt, and serve the same durable
upload bytes before/after a controlled owned output replacement. Unknown or
unverifiable initialization is preserved for review, not silently adopted.

Providers, worker credentials and live/payment controls are verified OFF
before publication and again before completion. No provider or financial
transaction is attempted. User cron/process/systemd/Nginx checks for the Linux
profile are implemented; their successful local substitutes are fixtures.
Neither browser interception nor these local fixtures prove host-wide network
egress policy. Hosted provider/scheduler/egress acceptance remains pending.

## Reproduction and evidence

The protected evidence directory is:
`/Users/imac/Documents/ELcomputer/quick-setup-phase3-milestone4-review-20261012`.
It contains successful test/build/browser logs, immutable-source comparison,
secret-free receipt examples with explicit fixture labels and artifact hashes.
A post-commit clean checkout build records the exact delivery commit separately.
Detached fixture receipts are historical evidence; their disposed installation
workspaces cannot authorize another publication.

Native test tooling was already prepared outside Git. The SSL-capable PG bin
is `/Users/imac/Documents/ELcomputer/production-backup-tools/postgresql-17.11/bin`;
the earlier email-review PostgreSQL build lacks SSL and cannot substitute.
The prepared Supautils library, PostgREST, PG driver and M3 Auth/Storage paths
follow `docs/installation-cli.md`. PM2 resides at
`/private/tmp/elcomputer-publication-tools/node_modules/pm2`. The successful
secret-free source-mirror build is retained at
`/private/tmp/elcomputer-m4-reviewed-package/build-source/.output` for fixtures.
`PUBLICATION_REVIEW_OUTPUT` and `PUBLICATION_REVIEW_PM2_PACKAGE` can select
independently prepared owned tooling; these are test-helper inputs, not public
publisher bypasses. Playwright/Chrome paths follow the existing browser tools.
Use `PDC_REVIEW_PLAYWRIGHT` / `PDC_REVIEW_CHROME` for the PDC suite.

Run the commands in [the publication runbook](application-publication.md) with
those explicit native-tool variables. Build only in the isolated clean source
copy: the `publish:package` command supplies an empty dotenv and a minimal
environment. The full test runner needs the existing keepalive preload for
mock provider timeout cases. Do not replace native checks with skips and claim
acceptance.

## Acceptance still pending

No compatible Linux VM/container/VPS is available on this machine. Successful
protocol tests inject **macOS target, Linux/SSH/Nginx/systemd/DNS/TLS ingress
fixtures**; the public publisher accepts only its actual Ubuntu 24.04 amd64
profile and exposes no fixture/force flag. Real SSH fingerprint parsing is
verified locally, but an actual SSH transfer/session is not certified.

Still required: real dedicated-user/process/ownership/Linux checks, SSH
transport and interruption, effective restricted Nginx and unapproved-client
denial, DNS/TLS/HTTPS/API reachability, supported hosted public/private keys,
Realtime compatibility, PM2 reboot resurrection, durable uploads across reboot,
independent backups/restores and controlled network egress. Phase 3 Milestones
5 and 6 and separately approved commerce/provider acceptance precede Phase 4.
The publisher never opens public ingress automatically. **STOP for M4 review.**
