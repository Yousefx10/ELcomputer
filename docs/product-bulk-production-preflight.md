# Product bulk UX production preflight — 2026-10-19

Later owner clarification: enabling `allow_out_of_stock_purchases=true` was
intentional. The [Products protected preflight](products-protected-preflight.md)
records the explicit new six-boolean baseline and fresh scoped compatibility/
Auth checks. The historical false-only failure below remains intact; it is no
longer an unexplained incident or a requirement to restore the flag to false.
Other security/deployment requirements are not waived.

Decision: **BLOCKED before staging or deployment**.
One read-only preflight was performed. No production mutation, staging, backup
creation, restart, reload, rollback, browser/session operation or Git push.

## Approved release and live application

Approved application commit: `3d5fe61c1109190c2ac3df12fb858987bc103aa5`.
Archive: **5,277,655 bytes**, SHA-256
`7bfe6316a1f544d84b37366f447cdfdd7b11bd11d3473df632930c5ad6618846`.
Its present bytes and all 597 committed application input hashes were verified.
Completed local tests/builds were not repeated.

Fresh non-root SSH evidence verifies:

- `current` still resolves to
  `/home/elcomputer/main-runtime/releases/release-82-40b87a3a289ea999`.
- All **1,066 live release entries** and **5,865 installed Node entries** match
  the retained installation inventory. The remote custody bundle equals the
  preserved local bundle; source commit is `9a9c2d8dba76321694a1b1183c8634018ba5ec12`.
- The retained old archive matches SHA-256
  `1b92463cb61626f1322a09dd99ecc4629e83312f42f066539e3a671ee434cc48`.
  The exact old release and archive remain available for reviewed rollback.
- Ubuntu 24.04/x86_64, Node 22.23.1, runtime UID 1002 and existing systemd unit
  `elcomputer-main.service` match the release requirements. PID 12065 remains
  active, NRestarts=0 and Restart=no. Unit, environment and start-receipt hashes
  match their recorded identities; the running environment matches the file.
- Runtime remains on `127.0.0.1:3002`. Proposed private candidate port 3003 is
  free. Approximately 155.8 GB and 25 million inodes are available. Media mapping
  exists. Pointer and PID stayed unchanged during the read.

Exactly six application inputs differ from the verified live source:

1. `app/composables/useProductBulk.js`
2. `app/pages/dashboard/products/index.vue`
3. `i18n/locales/en.json`
4. `i18n/locales/ar.json`
5. `app/components/dashboard/commerce/ProcurementTab.vue`
6. `package-lock.json`

The last two are the declared earlier corrections: add `created_at` to the
existing Procurement projection, and add 17 missing lock records. Existing lock
records are unchanged; none were removed, and package.json is unchanged. No
unexpected runtime inputs or unrelated new feature were found. Procurement
production acceptance remains separately tracked and is not established here.

## Ingress and target health

`scripts/nginx/dashboard_read_policy.json` changes only the EN/AR `review_inputs`
hashes. All 263 source bindings match. Every routing, method, decision and
authorization field is identical: 70 allowed GET patterns and ten held patterns.
The prior release review also proved identical rendered fixture configuration.
The source hash refresh requires no Nginx deployment and alters no permission.

Eleven bounded anonymous HTTPS GET health checks pass: EN/AR storefront, login
and product pages; exact public-image identity; bulk receipt GET returning
401/no-store; a representative held route returning 403; signup and checkout
returning 403. No cookie, credential, session, POST or original batch was used.
The historical 110-route audit was not repeated.

The protected production vhost cannot be read by the non-root account:
`PermissionError`. No escalation or retry was attempted. Its current exact bytes
and full loaded configuration are therefore **not freshly attested**. Prior
ADM-01 infrastructure/public PASS evidence retains its original provenance.

## Database gate: settings drift

One invocation used the existing unchanged sealed read-only collector. All 192
input hash/metadata pins passed. Its PostgreSQL connection enforces TLS and
default_transaction_read_only=on; the inspected verifier performs SELECT/SET,
without a write transaction. No database write was requested and no retry ran.

The collection began at `2026-10-19T14:26:16.529Z` and stopped with
`POST_REVIEWED_SETTINGS_DRIFT`:

| Field | Approved baseline | Observed |
| --- | --- | --- |
| `allow_out_of_stock_purchases` | false | **true** |
| `updated_at` | prior value | different |

The actor, cause and mutation time are not established. No setting was corrected
and no expected baseline was replaced to suppress this failure.

The sealed verifier's execution order establishes that schema 82/migration/RLS/
grant checks and product/revision/variant baseline comparisons completed before
the settings assertion. This is partial evidence, **not a new complete database
PASS receipt**. Later stock/order checks, Auth disable_signup GET, second coherent
snapshot and prior-receipt comparison were not reached. The old successful receipt
is preserved as historical evidence and was not promoted to a fresh result.

The changed purchasing flag does not by itself establish commercial activation:
the fresh signup/checkout ingress checks still return 403. It nevertheless fails
the approved browse-only settings contract and blocks this release preflight.
The owner's original pending bulk batch remains unverified and was not queried,
retried, replaced or cleared.

## Deployment readiness and next action

No migration, API/RBAC/RLS/Auth implementation change, Nginx change or commercial
activation is required by the candidate. The partial schema check supports the
unchanged API contracts, including the existing Procurement field and bulk
receipt functions. Full current database/Auth/OFF-state acceptance is incomplete.

The exact old release/retained archive, unit/environment identities, capacity and
private port are verified. Preserve all backups, media and old client assets.
After blockers are resolved, the exact candidate still requires privately staged
Linux runtime/health validation before any current-pointer switch. That was not
attempted under this authorization.

A candidate-bound application staging/activation operator is not yet prepared.
The existing main provisioner is a first-install guard bound to the old archive
and rejects an occupied runtime. Generic deploy.sh is locked to the separate demo
user/path/PM2 target and cannot deploy this main systemd application. Historical
ADM-01 operators concern Nginx and are not application-update authority. Reuse
their safety contracts, not their execution commands: exact identities/hashes,
exclusive new release, private health first, one separately approved pointer/
service action, and no automatic retry, rollback or cleanup. No guard was weakened.

Outstanding gates: reconcile the unexpected purchasing setting without weakening
the browse-only contract; obtain protected ingress evidence through an authorized
owner-controlled procedure; prepare/review the exact candidate-bound application
operator. Formal authenticated acceptance remains DEFERRED/BLOCKED, not waived.

Next owner action: confirm whether enabling `allow_out_of_stock_purchases` was
intentional. Any correction or new production attempt requires a separate reviewed
task. This preflight stops here.

Private and sanitized evidence:
`/Users/imac/Documents/ELcomputer/product-bulk-production-preflight-20261019-8pzap6pq/`.
Raw database diagnostics remain private; user-facing reports disclose only the
necessary field names and purchasing boolean, without settings rows, credentials
or session data.
