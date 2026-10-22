> INCOMPLETE APPLICATION-ONLY CANDIDATE. Do not deploy or seal this scope.
> Exact HTTP replay confirmed missing server RPC grants in schema89.
> Use the [complete89→90 procedure](pdc-v6-rpc-release.md) after separate approval.

# PDC V6 application release procedure

Use only `scripts/pdc-v6-release/operator.mjs` for this correction. Historical PDP,
footer and live-sales plans remain consumed. No PDC deployment approval exists.

Application candidate: `82ec667`. The baseline is the deployed Premium finishing
release `ea0dcc850b3a7d35`, schema89. The guarded source comparison allows only
`server/utils/pdcLookups.js` and its Dashboard lookup caller to change. Every
storefront, Product Editor, Classic/Premium PDP and footer source stays identical.

1. `prepare SPEC NEW_DIRECTORY` checks the accepted release/seal, clean source,
   exact schema89, all protected data/Auth/security/settings, runtime/Caddy/media,
   public commerce holds and disabled provider flags. It creates verified encrypted
   DB/runtime backups, builds the pinned source once under Node22.23.1/npm10.9.8,
   retains current client assets, scans the artifact and independently extracts it.
   Format0 is deliberately undeployable. Production staging/activation never runs.
2. Replay the exact extracted archive with `scripts/pdc-v6-artifact-replay.mjs`
   against disposable loopback SQL/PostgREST and synthetic Auth/provider fixtures.
   Foreign network connections are refused. Bind the archive/inventory and complete
   report, offline matrix, Dashboard fixtures, typecheck/build and operator guards.
3. `seal CANDIDATE QUALIFICATION` validates the exact-artifact replay and evidence,
   rechecks live preservation and creates an independent format5 approval plan.
4. `check PLAN` verifies every input, inventory, encrypted backup readback,
   single-use status and current production baseline. It performs no target writes.
5. Only separately explicit owner approval of the final64-character seal may
   authorize `apply PLAN --approved EXACT_SEAL`. Apply records its intent before
   preflight, creates fresh verified backups, stages into the new independent
   namespace, tests a loopback candidate and performs final read-only preservation
   before switching the application symlink/systemd service once.

No migration, SQL write, credential rotation, provider request, Caddy/runtime edit,
webhook opening or commerce activation is included. The exact new approval must
name this PDC correction; the previous PDP approval cannot authorize it.
Every consumed intent/STOP/receipt remains preserved. No automatic retry/rollback.

Post-deployment verification checks public health/holds, schema89/data/Auth,
settings/credentials, media and the selected Classic/Premium/Modern Footer state.
Hosted owner acceptance and separately authorized live PDC lookups remain later
steps. Production callback cutover and token rotation have separate plans in
[pdc-webhook-cutover-plan.md](pdc-webhook-cutover-plan.md).

Recovery is separately reviewed and application-only. Retain the deployed Premium
finishing archive and backups, preserve schema89 and newer data, and review any
retained-asset additions before executing recovery. Do not restore the database
merely to reverse this parser correction. No generic PM2/Git deployment or push.
