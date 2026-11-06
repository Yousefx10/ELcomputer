# Meta115 — inactive installation ready; activation prerequisites open

MKT-META-01 is the next implementation/release priority, by owner instruction.
Final read-only sealed preflight passed **4 November 2026, 21:37:19 Riyadh**.
Status: **READY / UNAPPROVED for inactive installation only**.
Live tracking, dispatch and hosted Meta acceptance remain **OFF / NOT EXERCISED**.

Storefront114 remains `6fd67997c8feaeca`, source `ff037ddd`, physical schema114.
It was neither rebuilt nor redeployed. Its consumed approval remains spent.
Apple Pay is an independent provider escalation; every unresolved attempt remains
preserved. Image caching is preserved for the following release.

## Completed prerequisites

- Recovered the qualified Meta implementation at
  `fd655ce335d12c772aad78fb80e06d7431926da0`. Pixel ID **1680814460341996**
  is bound in deployment configuration, outside reusable application logic.
- Refreshed production bindings from actual schema114/source `ff037ddd`.
  All 14 checkout attempts, 15 Auth users, 11 orders, current Email/provider
  settings and all 17 protected host files are included. Funds, callbacks and
  transfer proofs remain zero; all four integrity counters remain zero.
  No provider-side payment outcome was inferred.
- Captured new encrypted database/runtime recovery. Full authenticated database
  and 17-file runtime readback passed at **21:25:15 Riyadh**. The restored private
  PostgreSQL 17.11 target committed the exact schema115 adapter/history row,
  preserved all **160 original projections** and all 14 attempts, and passed
  DDL rollback, Auth/Email/shipping/default-ACL checks. The disposable database
  was removed. Managed extension-service exclusions remain explicitly recorded.
- Reused passing application build/typecheck and corrected Meta/browser evidence.
  New focused qualification passes **29 Meta tests**, the existing **four worker
  tests**, **16 installer integration checks**, **55 JavaScript + 54 remote scope
  guards**, and **seven one-use/uncertain-outcome scenarios, 54 assertions**.
  Pending/abandoned/unverified payments cannot become Purchase; withdrawal,
  final-send consent checks and immutable retry identities remain enforced.
- The original Meta archive lacked **121 Storefront114 assets**. A separate
  local package adds their exact bytes and serving entries. Every existing
  compiled file is unchanged except the bounded serving registry. Full archive
  readback, secret scanning and **5,020 asset HTTP hashes** plus **17 compiled
  route/privacy checks** pass with external fetch blocked. **Rebuilds: zero**.
  The original Meta archive is preserved. The corrected earlier 58-result Meta
  qualification supersedes the preserved preliminary harness/fixture failures;
  neither those failures nor the old storefront snapshot exceptions were erased.
- Protected worker binding is qualified: one replacement secret, shared privately
  by server runtime and root-owned 0600 worker environment. Worker and unit bytes
  are bound; both new timers remain disabled/inactive. An initial local validation
  diagnostic printed the uninstalled original candidate. That candidate is
  retired and excluded. Its encrypted historical artifact is preserved; the new
  candidate was encrypted without printing its value. No production credential
  was exposed or changed.
- Capacity, unused release/stage/port and current host/runtime checks pass.
  Natural MON retains eight warnings, three gaps and zero critical findings.
  Existing Email/PDC/MON timers and their natural callers are healthy.

## Missing prerequisites and exact readiness

| Phase | Current readiness | Remaining gate |
| --- | --- | --- |
| Inactive schema115/app/worker installation | READY / UNAPPROVED | Fresh approval of the exact seal below; execution repeats all guards |
| Protected business configuration | Prepared, not installed | Owner saves Pixel ID/token after inactive installation, with both controls off |
| Hosted consent/Test Events | NOT EXERCISED | Valid dataset-scoped token, Test Events code, fresh revision/runtime bindings and separate bounded activation approval |
| Hosted Purchase acceptance | NOT EXERCISED | A later genuinely verified paid, consented order under separate financial authorization; never an old-order replay or synthetic paid rewrite |
| General live tracking/dispatch | OFF / UNAPPROVED | Hosted acceptance and a separately sealed general activation scope |

The exact secure token input is **Dashboard → Marketing → Conversions API token**,
at `/dashboard/marketing`, using existing `settings.edit` authorization.
Its same-origin handler encrypts the value into
`private.meta_settings.token_encrypted`; the stored token is never returned.
The existing credential-encryption key is preserved. Do not provide tokens in
chat, Git, runtime files, URLs, screenshots or release evidence.

The Pixel ID is ready; the CAPI token is still missing. Its dataset access and
provider validity have not been verified. Graph version `v26.0` is the qualified
default; the Test Events code belongs in its separate protected Dashboard field.
See the complete [hosted configuration, consent and deduplication preparation](../../storefront-master-20261104/meta115-preparation-20261104/HOSTED-ACCEPTANCE.md).
Its SDK field checks use Meta's official
[EventRequest](https://github.com/facebook/facebook-nodejs-business-sdk/blob/main/src/objects/serverside/event-request.js)
and [ServerEvent](https://github.com/facebook/facebook-nodejs-business-sdk/blob/main/src/objects/serverside/server-event.js).
The direct developer pages returned HTTP429; live account/UI acceptance is not claimed.

Purchase keeps one stable `Purchase` / `purchase:<order UUID>` identity across
callbacks, reloads and retries. Private payment-return pages deliberately use
CAPI only. Do not manufacture a browser Purchase to demonstrate a pair there.
Uncollected COD remains `CODOrderPlaced` / `uncollected`; no new charge, refund,
provider inquiry or payment correction is included.

## Exact one-use installation packet

| Binding | Value |
| --- | --- |
| Current release/source/schema | `6fd67997c8feaeca` / `ff037ddd` / 114 |
| Candidate release | `77b3d459886c9d2a` |
| Source commit | `fd655ce335d12c772aad78fb80e06d7431926da0` |
| Archive SHA256 | `77b3d459886c9d2a7ce3bc8d0b75be45d5953586fcab999f14980f56eb0cd32c` |
| Only migration | `20261104141000_meta_commerce_tracking.sql`, 114 → 115 |
| SQL SHA256 | `591c2c1aa5cf8b6d4377b4ab99a7093c09e4084775f6e5eeaf74ab888e72c500` |
| Seal | `430110d54d3e06b8491fff21cc4e825089a961f4715446f5572da170602c0759` |
| Sealed inputs | 1,933 |
| Start deadline | **5 November 2026, 01:10:15 Riyadh** |
| Expiry | **5 November 2026, 01:25:15 Riyadh** |

Scope: one exact additive SQL/history transaction, one archive/app cutover/restart,
one bounded pause/resume each existing MON/Email/PDC timer within 180 seconds.
Bind the replacement worker secret in `/etc/storefront/runtime.env` and
`/etc/storefront-marketing/worker.env`. Only explicit false Meta runtime gates
are added; all other runtime values and provider credentials remain unchanged.
Install `/opt/storefront-marketing/worker.py` and three reviewed marketing units;
one `daemon-reload`, **zero new marketing timer starts/enables or manual calls**.
Database defaults remain inactive, without token, Pixel ID, consent or outbox backfill.

This does not authorize CAPI token entry by the operator, runtime tracking/dispatch
activation, Meta transmission, hosted Test Events, image caching, Apple guard
deployment, any provider/financial action, automatic rollback or Git push.
CARD/COD, EGP10, all current financial fences, late authenticated callbacks,
Auth/order/Email/shipping data and consumed-operator boundaries remain preserved.

The operator consumes its attempt before mutation and stops on exact drift,
lock/permission failure or an uncertain acknowledgement. Never replay a migration,
credential install, restart or provider request after a stop. Only already-fenced
existing timers may resume once. Preserve additive schema and newer commerce
activity; a forward correction requires its own exact scope.

The [operator](../../storefront-master-20261104/meta115-preparation-20261104/operator.mjs),
[seal](../../storefront-master-20261104/meta115-preparation-20261104/seal.json),
[restored-target receipt](../../storefront-master-20261104/meta115-preparation-20261104/migration-qualification.json),
[compiled artifact receipt](../../storefront-master-20261104/meta115-preparation-20261104/artifact-current/release-review.json)
and private plan/recovery files are together in
`../storefront-master-20261104/meta115-preparation-20261104`.
Use Node 22.23.1. No approval, apply or execution marker exists.

[AGENTS.md](../AGENTS.md) states: “Documentation and historical approvals do not
authorize production changes, provider transactions or Git pushes.” The current
request prepares this packet. It does not spend a production installation or
activation approval.

ONE next action: approve only this inactive installation by replying exactly:

```text
APPROVE META PIXEL CAPI SCHEMA115 INACTIVE INSTALLATION 430110d54d3e06b8491fff21cc4e825089a961f4715446f5572da170602c0759
```

The approval cannot be reused after expiry, target drift or consumption.
Image candidate `d6b0934` / original archive `c7c6a37e…` remains unchanged and
independent. Its later packet must retain the newly installed Meta/current
storefront assets and bind an actual compatible schema115 receipt. Apple Pay
support/finality and all unfinished historical requirements remain open separately.
