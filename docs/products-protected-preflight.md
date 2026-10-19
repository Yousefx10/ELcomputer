# Products protected preflight — 2026-10-19

**BLOCKED for production deployment.** Application identity and scoped database/
commercial-boundary checks pass. Actual protected Nginx and candidate fingerprints
still require the owner-console result; no such result has been received.
No production staging, configuration edit, deployment, database mutation, reload,
rollback or Codex root execution occurred. No completed regression/build was rerun.

## Current production and application binding

One authenticated, pinned **non-root** SSH inspection confirms the current pointer
still resolves to `release-82-40b87a3a289ea999`. All **1,066 application entries**
and **5,865 Node entries** match the retained installation inventory. Node22.23.1,
Linux x86_64, existing unit/environment and process binding match. Main PID12065
remains active with NRestarts=0, Restart=no, no daemon reload needed. Pointer and
PID stayed unchanged during the read. Existing loopback3002 and candidate-port/
capacity gates were inspected without staging. No private environment was exported.

The retained live archive remains **2,894,556 bytes**, SHA-256
`1b92463cb61626f1322a09dd99ecc4629e83312f42f066539e3a671ee434cc48`.
Custody/inventory identity binds the application to source
`9a9c2d8dba76321694a1b1183c8634018ba5ec12`.

The existing candidate is reverified, unchanged:

| Identity | Verified value |
| --- | --- |
| Application commit | 3d5fe61c1109190c2ac3df12fb858987bc103aa5 |
| Archive SHA-256 | 7bfe6316a1f544d84b37366f447cdfdd7b11bd11d3473df632930c5ad6618846 |
| Archive bytes | 5,277,655 |
| Application inputs | 597; all local hashes match; no input changed since that commit |
| Input inventory SHA-256 | ea2531f1b45a8069f9028e6b266dd7819b8295459f8b5554765b745c3436b5fd |
| Previously independently verified output inventory | 1,167 entries; 3ebb47018ff542797f50272fab452e374c20aced53d1dc654c1d7e35ac128b34 |

Exactly six known inputs differ from the freshly matched live source: bulk
composable, Products listing, EN/AR, the previously reviewed Procurement projection
and lockfile correction. The latter adds17 lock records without changing/removing
existing records; package.json is unchanged. Previous exact source comparison is
reused because both source/artifact identities match. No new unrelated feature is
included. Procurement production acceptance stays separate. No rebuild is implied.

## Focused read-only database and Auth evidence

A new bounded collector used TLS and an explicit repeatable-read **read-only**
transaction. It did not rerun or modify the earlier failed sealed collector.
Only relevant catalog metadata and six specified settings booleans were queried;
no product, stock, order, actor or receipt business rows were selected.

- All **82 migration identities** match the certified Release82 history.
- Exact definitions/owners/security-definer configuration of the **five Products
  save/snapshot/bulk/status RPCs** match certificate903886ec...015eee7. Anonymous/
  authenticated direct execution stays denied; service execution stays allowed.
  These unchanged definitions retain current active-actor RBAC, command/actor
  idempotency, revisions, atomic audit and durable receipt guarantees.
- Both private receipt tables keep RLS, zero policies and no direct anonymous,
  authenticated or service-role table privileges. No receipt was read.
- The owner-approved stock flag is **true**. All **five payment flags are false**.
- One public Auth settings **GET**, using the existing protected anon-key binding,
  confirms **disable_signup=true**. No token/session/login/refresh was requested.

Result: **PASS_SCOPED**, not a complete schema/RLS/business-state comparison or
formal authenticated acceptance. The old post-deployment DB receipt and zero-write
comparison remain historical evidence. This collector requested zero DB mutations.

Five bounded anonymous GETs pass: checkout403, signup403, checkout API403, payment
intentions API403, and an inert bulk-receipt request401/private-no-store. The inert
UUID is not the owner's batch and no actor was authenticated. No redirect, cookie,
retry, mutation request or historical110-route reaudit was performed.

## Intentional stock-setting baseline

The owner explicitly confirmed enabling `allow_out_of_stock_purchases=true`
through the dashboard. That resolves the **unexplained-change classification**.
It does not retroactively turn the old false-only verifier into PASS. Its old
failure, receipts, inputs and historical snapshots stay intact.

The new [review baseline](operations/products-release-baseline.json) accepts
exactly that boolean as true, keeps all five payment flags false and Auth signup
disabled, and preserves customer ingress denials. It does not silently approve a
whole settings row/updated_at, unrelated drift or commercial activation. No live
setting, reusable default, database row or historical collector was changed.

Source-level business implications:

- Product/card/reorder/cart behavior permits backordering non-serialized legacy
  products. Normal serialized purchases still require physical stock; publishing,
  required fields, ERP ownership, preorder terms and allocation checks remain.
- Availability labels, cart affordances and structured data can change even while
  checkout is denied. The flag does not create stock or activate payments/signup.
- Existing AI availability copy can say Backorder for zero-stock serialized
  products when this flag is true, although serialized checkout still requires
  stock. This is a source-level presentation discrepancy, not evidence of an
  accepted order or an ingress bypass. No AI/storefront redesign was started.
- Future ecommerce activation must explicitly review the retained backorder
  choice. It remains deferred; Products administration is the current priority.

## Ingress evidence and deterministic seal

The protected vhost remains unreadable to the non-root account: PermissionError.
No escalation/retry was attempted. No raw private configuration was exported.
Historical accepted READS-v1 is **472,049 bytes**, SHA-256
`c859c080dcab025c6d7e614d77864905d034e8c50d6570eef95014d6f4574bb5`.
This is a required preimage, **not a fresh protected attestation**.

The exact approved implementation remains commit
`a1a1ce02992cdb00a2c2c185ab5885a912324ef7`. Only canonical-host, exact raw-path
POST create, PATCH UUID product and POST bulk may be added. All70 GETs/ten holds,
audit exception, commercial restrictions, private/no-store/proxy/security controls
and other servers remain bound. The source registry differs from the deployed
registry only in the two reviewed locale source hashes; route/method/decision
content is independently confirmed identical. It is not another ingress change.

A reproducible **definition-only archive** is prepared locally:

| Identity | Value |
| --- | --- |
| Definition archive | products-ingress-definition.tar.gz |
| SHA-256 | 175fabe351d2c5b39c8447e61980b4901e0d72c24a52199e839bbb3b12f746da |
| Bytes / regular members | 32,877 / 8 |
| Manifest SHA-256 | f121d0be540e30cab6b9bb7b3c24eea088252db73355f8aa3944df8fef73e8a2 |
| Approved transform source SHA-256 | 3b2588e21b3f3756737fe02f1a390d24a92986dad0fdb275b6f045ce4def312a |

It contains the five exact approved source dependencies, reviewed deployment
binding, scope and manifest. Two sorted, zero-time archives are byte-identical.
A separate reader checks names, regular-file-only modes/UID/GID/time, manifest
hashes and all five Git objects. No config contents, secret, native payload,
application archive or apply/reload operator is included.

**The definition seal is not an actual production Nginx candidate seal.** That
candidate's hash remains null until the owner receipt arrives. No synthetic hash
or definition hash may be substituted. Current matching/private shadow syntax and
final protected rollback-preimage verification remain prerequisites.

## Owner inspection and validation

The prepared [owner-console block](operations/products-protected-inspection.command)
uses existing root-frozen, hash-verified **read-only functions**, without invoking
an operator main. It authenticates the accepted APPLY receipt and all protected
files/peers, requires accepted master/worker lineage, and computes the proposed
candidate independently in memory. Only metadata/hash JSON is returned. It cannot
apply, reload, stage, back up, mutate SQL or export a configuration.

The first draft wrapper allowed `ss -lnt`, while the existing frozen verifier
uses `ss -lntp`. This mismatch was found and corrected locally. Revision2 permits
the actual read-only invocation; both outputs identify the revision. The old
draft and its hash are retained outside the checkout and must not be run.

New focused validation only: **2 tests PASS**, covering six independent
fingerprint comparisons across two stores/three existing retry configurations,
plus five permitted read commands and five rejected mutation/execution commands.
The console entry was syntax-compiled, never executed by Codex. Earlier Nginx,
Products, browser, typecheck and build PASS evidence is preserved without reruns.

The owner returned the **script text**, not a console receipt. Execution/outcome
is therefore not established. If the first draft already ran, retain its printed
JSON and stop; no automatic rerun is authorized. If it was only copied, use the
reviewed revision2 once. No root action by Codex is authorized in either case.

## Deployment decision and remaining gates

The [separate deployment/rollback procedure](operations/products-release-procedure.md)
binds the exact main systemd target, archive, old pointer/output, environment,
new exclusive release name, private Linux health port and accepted READS rollback
bytes. No generic demo PM2 deployment or frozen-guard bypass is proposed.

Remaining prerequisites are:

1. Owner-provided protected inspection result; authenticate current source,
   all23 files/22 peers, worker lineage and exact candidate hash/size.
2. A separately reviewed operator bound to that receipt and both exact artifacts.
3. Separately authorized protected candidate preparation/full private shadow syntax,
   fresh backup/security-metadata access and exact Linux application staging/health.
4. Explicit reviewed activation authority for the app pointer/unit and exact Nginx
   replacement/reload. No automatic retry, rollback, resume or cleanup.

The original batch remains **UNVERIFIED**, retained and untouched. No identifier
was manufactured, receipt lookup performed, mutation retried or publication
changed. Only an exact actor-owned authenticated receipt GET can reconcile it;
null/error cannot justify discard or a replacement command.

ADM-01 infrastructure/public and historical zero-write DB PASS evidence remains
intact. The five owner functional observations remain separately attributed.
Formal authenticated RBAC/held-route/restricted-role/browser-write-safety
acceptance stays DEFERRED/BLOCKED. Procurement, uploads/storage and ecommerce
remain separate. A scoped preflight PASS cannot silently waive those requirements.

Evidence:
`/Users/imac/Documents/ELcomputer/products-protected-preflight-20261019-g_6q0opw/`.
No Git push. **Immediate owner action:** return the existing console result, or
confirm that the first block was only copied before running reviewed revision2.
