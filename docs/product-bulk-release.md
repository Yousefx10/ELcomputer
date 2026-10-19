# Product bulk UX release review — 2026-10-19

Status: **GO for separate deployment review**. No production staging or deployment.
The final external release manifest binds the review commit containing this file.
Implementation was already committed in `c7480a0c307d154a8c612852553c9cc5cd23ea97`;
this review preserves that history rather than amending it.

## Reviewed scope

The exact bulk implementation diff from `e11e34c` to `c7480a0` was reviewed.
POST 405 records method refusal; 401/403 records access denial. Neither establishes
the outcome of an earlier attempt. Known denials suppress UI and programmatic
mutation retries. Lost responses, timeouts and unclassified/malformed responses
retain uncertainty, original UUID, operation, assignment and product revisions.
GET recovery remains authenticated, actor-owned, body-free and retry=0. Only an
exact terminal receipt clears the command. Actor-generation guards reject late
responses, and storage failures cannot silently overwrite pending evidence.
No application correction was needed during review.

The 597 application inputs differ from the previously sealed Procurement candidate
only in `useProductBulk.js`, Products `index.vue`, and the EN/AR locale files.
The candidate carries the earlier reviewed Procurement projection and lockfile
corrections unchanged. Their production acceptance remains separately tracked.
All 82 migrations, transaction/receipt validators, Auth/RBAC/RLS handlers and
deployment helpers remain unchanged. Original Release 82 evidence is not relabeled.

The only registry changes are the two reviewed EN/AR `review_inputs` hashes.
All 263 bindings now match. The complete routing/method/authorization policy is
unchanged; the existing renderer produces byte-identical fixture configuration.
Registry source SHA-256 changes from
`aa40e475976116d5e53cb52d6492a0bb929e0cbd484706b42c1265fe2af631f2` to
`8849fd91dc2eb461a7b39c7f4ed90fc393d1ba5e3172c373582db2815570139b`.
These are source-review identities, not claims that deployed Nginx bytes changed.
No sealed historical activation package or production configuration was edited.

## Focused validation

| Check | Result |
| --- | --- |
| Recovery state-machine tests | 54 PASS; zero failures/skips |
| Existing pure/HTTP/native concurrency bulk tests | 19 PASS; zero failures/skips |
| Chrome bulk regression with fresh locked dependencies/candidate CSS | 310 assertions / 36 screenshots PASS |
| Source inventory/binding guards | 2 PASS |
| Independent clean npm installs | 2 PASS; 801 identical installed records |
| Fresh-dependency Nuxt typecheck and production build | PASS |
| Local candidate HTTP checks across two deployment bindings | 598 PASS |

The existing 202-assertion browser coverage remains. Six added scenarios provide
108 assertions for EN/AR 405, 401/403, timed-out submission and malformed POST
acknowledgement. Each checks null/malformed/lost GET results, actor isolation,
reload, retained command bytes and absence of mutation retries. Denied/aborted
submissions add no native business/audit counts or bulk receipts. Existing native
cases verify real lost acknowledgement after commit, same-command replay, revision
conflicts, actor-only results and revocation. Only disposable databases are used.

Browser contexts are fresh and temporary, with external requests blocked. Real
components, Vue Router, Chrome storage, H3 and PostgreSQL/PostgREST are exercised;
Auth verification and ingress denials are explicit fixtures. No owner profile,
session or production batch was accessed. Unexpected browser errors and external
requests: zero. The full historical suite was not repeated. Build logs retain
duplicate ERP-import, sourcemap and chunk-size warnings; the binding test emits an
existing CSV ResourceWarning. None failed its check; no unrelated cleanup occurred.

## Sealed candidate

Evidence root:
`/Users/imac/Documents/ELcomputer/product-bulk-release-review-20261019-9oxru4kf/`.
Candidate: `candidate/release.tar.gz`.

- Archive SHA-256: `7bfe6316a1f544d84b37366f447cdfdd7b11bd11d3473df632930c5ad6618846`.
- Size: **5,277,655 bytes**.
- Output inventory: **1,167 entries**; SHA-256
  `3ebb47018ff542797f50272fab452e374c20aced53d1dc654c1d7e35ac128b34`.
- Application inputs: **597**; SHA-256
  `ea2531f1b45a8069f9028e6b266dd7819b8295459f8b5554765b745c3436b5fd`.

Node 22.23.1/npm 10.9.8 clean installs use lifecycle scripts and empty npm config;
the lock remains byte-identical. The stock build uses an empty dotenv and explicit
non-production configuration. All 135 immutable client assets from the verified
accepted archive are supplied before build. Old `builds/latest.json` is excluded.
Generated group-write permissions are removed without changing file bytes.

The existing strict output inventory and portable/no-mtime archive process are
reused. Repeated archives and extracted inventory match. A separate Python reader
verifies archive members, modes, zeroed archive metadata, hashes, committed input
objects and exclusion of secrets, uploads, native payloads and production bindings.
See `candidate/release.json`, `candidate/SHA256SUMS` and
`INDEPENDENT-ARTIFACT-VERIFICATION.json` for final commit-bound evidence.
Deploy these exact sealed bytes; rebuilding creates a new candidate requiring
review and resealing. Independent fresh-build byte identity is not claimed.

## Deployment prerequisites and limits

This application-only correction needs **no migrations, Nginx change, environment
change or commercial activation**. Bulk POST remains intentionally blocked.
The original owner's batch remains unverified and must not be retried or cleared.
Legacy batches have no invented denial history. Denied/interrupted batches without
a terminal receipt may need separately authorized reconciliation. Storage remains
tab-local; existing open clients retain their old UX until reload.

Before any separately approved staging, refresh the read-only deployment binding:
exact current release/pointer and inventory, environment/unit/hardening/retry policy,
schema/RLS identity, existing media mapping and disabled commerce/signup state.
Authenticate the accepted post-ADM-01 configuration using the preserved successful
APPLY evidence. The old pre-activation ingress plan is historical, not current
authority. Recorded target/environment hashes are not fresh production attestations.
No live refresh was performed in this task.

Preserve the exact old release, hashed client assets, current pointer and existing
backup/recovery evidence. Stage only to an exclusive new release directory after
authorization. Verify archive/extraction and run the exact candidate privately
under the target Linux Node runtime before a switch; any proposed loopback port
must first be free. Check EN/AR pages, assets/media, configuration, private/no-store
authorization denials and disabled commercial flows. A macOS build and synthetic
Auth do not establish hosted Linux or authenticated production acceptance.

Only a later reviewed activation may switch the existing pointer and restart the
existing unit once. Preserve its environment, hardening and Restart=no contract.
Do not use the generic demo-target deployment helper for this main deployment.
Failure or ambiguity means STOP and preserve evidence. No automatic retry, resume,
rollback or cleanup. Rollback requires separate approval and the exact retained
application pointer/output; no database, ingress or environment restoration.
It restores the old bulk UX and any previously unresolved Procurement behavior.

ADM-01 remains DEPLOYED / INFRASTRUCTURE_PASS. The previous database/public PASS
evidence and five owner-reported functional smoke observations remain separate.
Formal authenticated security acceptance stays DEFERRED/BLOCKED and is not waived.

## Commit scope and next action

The review commit changes exactly:

- `scripts/nginx/dashboard_read_policy.json`
- `scripts/product-bulk-browser.mjs`
- `tests/helpers/productBulkDenialBrowser.mjs`
- `docs/product-bulk-release.md`
- `docs/product-bulk-validation.md`
- `PROJECT_STATE.md`
- `CODEX_HANDOFF.md`

Application implementation is inherited from `c7480a0`; source-input verification
binds its exact bytes to this review commit. No unrelated work is staged.

Next owner action: approve a separate read-only production preflight for this
sealed candidate. No push, staging, root operation, deployment or rollback here.
