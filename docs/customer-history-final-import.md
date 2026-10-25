# Final guarded WordPress history import

**PRODUCTION IMPORT PASS — 2026-10-25,23:07:33.882 Riyadh.**
Owner approval3c9f5764 executed once; [authoritative public receipt](customer-history-import-receipt.md).
All41 batches/full immutable reconciliation/140 original projections PASS;516
customers,591 orders,6 refunds,1789 items,702 events imported.513 conditionally
eligible/3 held; actual claims0. Three exact routes loaded with one Caddy signal,
no app restart/schema deployment. Independent read-only verification PASS.
This approval is consumed. Never rerun apply/check expecting empty history.
No new accounts, passwords, current commerce writes, emails or public activation.
The packet below is preserved preparation evidence; its pending statuses are historical.

## Preserved sealed preparation packet

2026-10-25, Asia/Riyadh. **HISTORICAL IMPORT READY — OWNER APPROVAL PENDING.**
No production import, routing change, account creation or email has run.
Release `bc05eef266eeb7de` / schema94 is already deployed. Never repeat its
consumed deployment. Source approval70e929ee is complete; no source reapproval.

## One exact next approval

```text
APPROVE HISTORY IMPORT 3c9f5764901005600c8a3c22900975bdeed9199f277bb8299d2d8b0a771b70ad
```

This approves the final eligibility rules and immutable payload **before import**,
41 history-only batches, and the three required customer-history API routes below.
It permits at most one Caddy SIGUSR1 reload after verified import, with no app
restart or schema deployment. Signup, purchasing and provider initiation stay closed.
It authorizes no Auth creation, password import, current-profile/order/inventory
write, notification, payment, shipment or Git push.

The false template is not approval. Record an exact owner receipt before apply.
Do not reuse the source or consumed inactive-deployment approvals for this action.

## Exact counts and claim eligibility

| Historical records | Import | Eligible customer history | Held customer history | Unlinked history |
| --- | ---: | ---: | ---: | ---: |
| Customers | 516 | 513 | 3 | — |
| Orders | 591 | 459 | 1 | 131 |
| Separate refunds | 6 | 6 | 0 | 0 |
| Order/refund records | 597 | 465 | 1 | 131 |
| Items, including shipping/fee/tax/coupon rows | 1,789 | 1,373 | 3 | 413 |
| Fulfillment observations | 702 | 696 | 2 | 4 |

The513 eligible identities have unique, stable registered emails across both
authenticated snapshots. One matches a current verified ordinary customer;
512 require normal verified signup later. Of513,395 have orders and118 have none.
The current verified match has **zero historical orders**; it can accept archived
profile ownership and an empty order list, not hosted order-detail rendering.
These are **conditional claim eligibility counts**, not verified customers or
existing ownership links. No account is created or automatically linked by import.

Three imported customers remain ineligible: two primary-only identities and one
changed registered email. Their one order remains private. Resolve them through
separate evidence review; do not rewrite immutable imported flags by replay.
Two comparison-only identities are not added to the approved primary source.

The131 unlinked orders comprise110 guest and21 excluded/missing-customer cases.
They stay private even when billing email matches a verified account. Two
privileged legacy users are excluded. Duplicate registered emails:0 legacy /0
current. One completion-date conflict retains both original observations.
No totals, dates, addresses, payment references or fulfillment facts were guessed.

## Source, payload and operator bindings

| Artifact | Exact binding |
| --- | --- |
| Source approval, complete | `70e929ee9934b1e04d149266819ef2e3403be2a3cd27c03491803ebf837608d8` |
| Source key | `wordpress-primary-20261020` |
| Raw archive SHA256 | `4c62f42b156e40cc45ccdf7ba43ef682ea7ab234362ecb53963f7e9a8ec7aefd` |
| Selected normalized encrypted source SHA256 | `cf7fab6170b76e5d72f536ce31e7f244d1d7e839e2e3dd79c3ac73ff58b74d64` |
| Final payload SHA256 | `a34838d6034f9d1cc5104a13d1960bff70b439b3d65000436f4a1f7abe6899bf` |
| Final encrypted review SHA256 | `1045be1efdb23df046f675cc238fc91a194a07a4c3fd2969ef044eae42319ea1` |
| Source-bound eligibility digest | `4b4483965ab4077d0586d4e6c46fe572329c1929b5eb180d5fa7fcbc957991a3` |
| Stable41-batch index digest | `57853837777358eb104bfacfbbf44bf7a26779944ae96e3834e0c19b21550f4d` |
| Installed source ID | `b89ee96a-9964-5f7f-adb5-dece550d929f` |
| Operator commit | `de5c4142057c86f29a812af06cec9b9b566297ad` |
| Deployed application | `1924ca06b2bf97426aba108f6da36cb7b7bd1287`; archive `bc05eef266eeb7de890d48ca30be562136474ddc90a8ebb91d71dcec9ea462c6` |

Private workspace: `../customer-history-final-import-20261025/`.
Its isolated `source/` branch is `local/customer-history-final-import-20261025`.
All663 frozen application inputs byte-match the deployed source. Only the guarded
operator and seven focused tests were added; no application rebuild is needed.
The original zero-claim v3 preview and41-batch evidence remain unchanged.

`final-import-plan.json` binds the above artifacts, target, current identity
authority, exact94 schema/catalogs, encrypted recovery, operator/tool hashes,
batch index and private eligibility report. Personal data and credentials stay
outside Git. `IMPORT-APPROVAL.template.json` remains false. No approval receipt
or execution intent exists. `READINESS.json` records the successful read-only seal.

## Ordinary customer access and required routing

The deployed My Account → My Orders → Previous orders view has EN/AR list/detail
and **Connect previous orders / ربط الطلبات السابقة**. It submits only
`{confirmed:true}`. The server derives the customer UUID and registered email
from the session; customers cannot select an identity or legacy owner.

Claims require a confirmed, active, permanent ordinary account, unique normalized
registered email, approved source-bound legacy identity and explicit confirmation.
Current profiles, credentials and order records remain unchanged. Changed,
duplicate, privileged, anonymous, banned, inactive, unverified and other-account
requests stay denied or held. No provider-specific email alias collapsing occurs.
Historical payment/refund/fulfillment data is display-only.

Read-only inspection found a concrete Caddy hold before Nuxt. Even invalid-Bearer
history requests receive403. The proposal extends only the existing
`customer_access` matcher with these methods and paths:

| Method | Route |
| --- | --- |
| GET | `/api/account/history` |
| GET | `^/api/account/history/b89ee96a-9964-5f7f-adb5-dece550d929f/[1-9][0-9]{0,17}$` |
| POST | `/api/account/history/claim` |

No broad account/API wildcard is opened. Other sources, methods and paths retain
their existing guards. This source UUID is deployment-specific routing input;
reusable application code contains no deployment special case. Existing JWT,
confirmation, profile authorization and private RLS/service-only RPCs remain.
See Caddy's [official request-matcher contract](https://caddyserver.com/docs/caddyfile/matchers).

Exact proposed bytes passed the installed VPS Caddy parser without reload.
Only one matcher line changes; both adapted HTTP/HTTPS expression copies reflect
that line. All other adapted configuration is equal.154 offline method/path
predicate checks passed; these are not154 live Caddy requests.

Before Caddy SHA256: `a23719140d8d6e8e2e159287d6b7bb5cefcc044299e1f8b27522c94b1a93e256`.
Proposed SHA256: `90d9181a396ef69c46f2df1f69ca3991ac6eb2bb601fc6cb3aeb08cb7418511f`.
Routing is installed only after all imported records and receipts verify.
No routing write or signal has run. Hosted authenticated acceptance remains pending.

## Recovery and qualification evidence

Fresh production read-only exported snapshot:2026-10-25 **22:23:51.699 Riyadh**.
The complete encrypted database and140 original data projections share that
snapshot. Authentication/full byte readback passed; DB plaintext11,042,840 bytes,
runtime recovery10 files. Encrypted DB SHA256:
`a078f8923fd8e9436d8acb849e2b899550f491c6c949ed9e5491e22ffb39ab86`.
Six-hour proof freshness ends2026-10-26 **04:23:51.699 Riyadh**.
Execution also requires a new authenticated encrypted pre-import backup.
No catalog pause is required: exported snapshots and transaction comparisons
preserve concurrent edits without binding approval to an old catalog row count.

Actual native PostgreSQL17.11 restore and final41-batch rehearsal passed at
22:47:06.087 Riyadh. No migration was reapplied. All516 customers,597 order/refund
records and1,789 items matched exactly, including totals/currency, original dates,
refund relationships, delivery/billing addresses and702 fulfillment observations.
Each batch used the same helper as production and preserved all140 original
Auth/profile/commerce/Storage projections within its repeatable-read transaction.
Maximum local batch615ms; total23.6s. These are local timings, not production SLAs.

The full encrypted backup includes Vault; ten managed Vault TOC entries were
excluded only from the disposable local restore, with zero secret rows verified.
Twenty-five owner-only ACL representations were reconstituted locally. No live
role, privilege, Vault object, account or profile was changed.

Local tests exercised the actual deployed EN/AR component's claim/list/detail
code, current verified-owner matching, held/guest/cross-account/unverified/inactive
denials, source-hide read denial, same-receipt replay and changed immutable-record
rejection. Cloned identity/profile fixtures were rolled back; final Auth links0.
Seven operator tests passed, including absent/wrong/consumed approval rejection,
stale recovery rejection, constrained routing and original-data rollback guards.
Existing passing69 Beta/20 history/build/typecheck/archive evidence is reused.
Local tests do not establish hosted customer acceptance or send real emails.

## Bounded execution and recovery sequence

1. Record the exact owner phrase in a separate approval receipt. Verify the seal,
   tool/evidence hashes, six-hour proof, current94 lineage, empty history, ownership
   authority, unchanged runtime/Caddy and closed signup/commerce/provider gates.
   Harmless current password, address and catalog changes do not invalidate
   ownership review; every current column is still protected inside each batch.
2. Write one exclusive local intent and capture fresh authenticated execution
   recovery. No automatic retry or duplicate operator run is permitted.
3. Apply41 deterministic service-only RPC transactions: at most50 customers,
   20 order/refund records,300 items and1MB per batch. Statement timeout60s;
   lock timeout5s. Compare all140 original projections before/after each batch
   in the same transaction. Any difference rolls that batch back.
4. Keep private local per-batch intents/receipts and durable database command
   receipts. Reconcile every immutable JSON record, ownership flag/evidence,
   source/hash, relationship, count and zero automatic Auth links.
5. Install the exact three-route Caddy correction. Save original bytes and remote
   intent; validate parser, use at most one SIGUSR1, verify reload journal and
   unchanged service PIDs. Verify anonymous history401, Cart/Checkout403 and
   login200. No app restart or payment/shipping configuration change.
6. Save final completion receipt. The existing eligible ordinary customer can
   explicitly connect its archived profile and verify the EN/AR empty-history view.
   Hosted order/detail/address/refund acceptance needs an eligible order-bearing
   customer: separately authorize one owner-controlled ordinary signup, if available,
   or verify the first eligible customer after approved public signup. Do not create
   accounts or send mail under this import approval. Hosted acceptance is pending.

On uncertainty, stop and preserve receipts. An uncommitted batch rolls back;
earlier committed batches remain private behind the original history ingress hold.
Inspect database command receipts before any separately reviewed identical-command
continuation. Never retry an ambiguous batch, signal, delete/reimport, change an
immutable customer flag or restore the old database over newer users/orders.

If committed history must be withdrawn, separately approve source hide through
`customer_history_hide_source(source_id, snapshot_sha256)`. Local read-denial proof
passed. This preserves records/receipts/current data and cannot retract views
already seen. A routing reversal also needs a scoped reviewed action; no automatic
rollback is authorized. The encrypted backup is recovery evidence, not permission
to replace the live database.

## Remaining route to public Beta

Approve this packet → import/profile-claim acceptance → small EN/AR returning
notice release → separate public signup approval → order-bearing customer history
acceptance and final catalog/PDC delivery,
EGP50, manual merchant refund/reconciliation, unpaid-expiry and normal paid-order
acceptance → separate public purchasing approval.512 eligible customers can then
register with their original email, verify it and connect their history themselves.
Current customers retain login/recovery. PDC booking stays administrator-controlled
after confirmed orders; payment success never automatically creates shipments.
