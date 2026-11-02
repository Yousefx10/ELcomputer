> E192: the exact SQL-only109approval was applied once and is CONSUMED_COMPLETE.
> Data API reads and scheduled workers recovered;8warnings/3gaps remain intact.
> [Actual execution receipt](p0-data-api-schema109-receipt-20261102.md).
> Do not replay any consumed operator or activate the old core108draft.

# P0 Data API pool recovery — E191, 2 November 2026

**SQL-ONLY FIX READY / UNAPPROVED. Production recovery remains pending.**

Production is still app81f6206b393714ae / database schema108, source7b33ed0.
The app and Caddy PIDs remain197689/26652. Payment-first and new methods stay OFF.
The owner supplied HTTP504/PGRST003 logs and confirmed stuck/retried product saves.
No production write, cancellation, restart, provider request or worker invocation
was made during this qualification.

## Root cause and impact

The current service-only `catalog_save_product` function raises SQLSTATE40001 when
its optimistic product revision is stale. This is a permanent business conflict.
Observed PostgREST14.18 interprets it as a retryable serialization failure and
repeats the transaction indefinitely. Concurrent stale requests occupy the Data
API pool and starve unrelated requests. The client explicitly sets retry0; the
server product handler calls the RPC once. Ordinary content edits exposed an
existing conflict-code defect; no payment development activation caused this path.
The function originates in historical migration72 and its current deployed body
was read directly, with exactly one matching40001statement.

Direct PostgreSQL remained available. Read-only samples showed rapid BEGIN/ABORT/
product-save loops, not long-aged idle transactions or a durable blocking chain.
At19:31UTC there were14connections against max_connections60, eight authenticator
API connections and2334transaction rollbacks over1.9seconds. Some snapshots show
brief normal row/advisory contention within the repeated saves. Do not terminate
sessions based on a single lock snapshot. Managed CPU/RAM/utilization graphs and
full PostgREST pool configuration are unavailable without management access; the
observed retry mechanism and local reproduction establish the actionable cause.
The exact first human Save click was not reconstructed or assigned to an employee.

Affected reads include products, categories, brands and public settings. CARD/COD
remain configured ON, but capabilities200does not prove checkout works while its
Data API is unavailable. Scheduled Email, PDC and MON requests are affected too.
A worker's unverified result is not proof of an email/provider action or cash
collection. All existing warnings, journal gaps, orders and uncertain attempts
remain retained. The31successful product audit events and23save receipts through
18:18:34UTC are preserved. Keep unsaved editor drafts and reconcile existing
request receipts before any later explicit retry; never overwrite a newer edit.

Supabase documents this error-code retry issue in its
[official knowledge-base article](https://supabase.com/kb/troubleshooting/high-cpu-and-infinite-transaction-retries-when-using-custom-error-codes-in-rpc-functions).
Its general recovery advice includes clearing existing backends. Our actual14.18
catalog reproduction recovered through function invalidation alone. This packet
therefore authorizes no session cancellation, termination or service restart.
If production does not recover, stop and qualify a separate, precisely identified
recovery; never broaden this approval automatically.

## Exact correction and qualification

Only the stale-revision statement changes:

```sql
raise exception 'catalog:conflict' using errcode='PT409';
```

The previous code was40001. The same safe409message already exists in the deployed
application. Revision checks, function OID/owner/ACL/security/search_path, request
fingerprints, receipts, RBAC, audits, inventory and all save logic remain identical.
No stale save can overwrite another edit. No application build/deployment is
needed because no application bytes change.

| Check | Result |
| --- | --- |
| Focused SQL/HTTP/validation/privacy/concurrent product-save tests |41PASS |
| Actual guarded migration, rollback, preserved rows and scope guards |5PASS |
| Actual official PostgREST14.18 + disposable nativePG17.11, eight slots |PGRST003 reproduced; all8stale calls exit409after patch, next read200in4ms |
| Local recovery side effects |0PostgREST/app restarts,0backend cancellation/termination; rows/receipts/audits unchanged |
| Function correction and failed precommit transaction |Exact before-image restored and no migration record retained |
| Existing reset allowlist assertion |Fails on baseline108without this patch too; retained/deferred, no reset-policy repair |
| Encrypted recovery backup |18:22:35UTC full authenticated DB pg_restore and17file byte readback PASS |
| Hosted preflight |Read-only schema108/function/17files/services preserved; known API outage explicitly bounded |

The earlier broad invocation had a wrong working directory for one HTTP fixture;
its corrected run passes. The broad destructive-reset assertion rejects existing
unrecognized tables even on baseline108without the patch. Neither failure was
hidden or repaired by widening this release. Old logs and optional native Storage
ownership acceptance remain preserved. This is focused qualification, not a claim
that every historical regression or hosted owner acceptance passed.

## Migration and approval boundary

Owned source: `7be3584f7700d31b684431a1976d032747e43bc2`.
New migration: `20261101220500_catalog_conflict_no_retry.sql`.
Actual deployed history ends at20261101220000/schema108. The unused220500slot
allows this urgent SQL-only patch to become109without modifying any deployed
migration or either preserved candidate. Unapplied manual-transfer221000then
becomes110; balance20261102210000becomes111. Those candidate files, branches and
local evidence remain untouched. No generic database push is permitted.

The sealed one-use operator permits only one function replacement and one
migration-history insert, with a3second lock timeout and45second statement bound.
It checks exact target, source commit,30reviewed inputs, current function body,
full schema/RLS/Auth/history access, protected file hashes/PIDs and same-snapshot
156protected table projections. It takes the existing reset advisory guard and
serializes migration history. No application tables are locked for a broad reset.
No business data, payment status, stock, credentials, sender, fees, runtime flags,
Caddy files, timer controls or emergency budgets are changed.

The original encrypted backup is bound and limited to4hours from verification.
It is recovery evidence, never authorization to restore over later customer data.
The exact function before-image is also retained privately. Precommit failures
roll back atomically. After a commit or uncertain transport result, the approval
is consumed; inspect actual history and do not rerun or restore40001. Precommit
qualification is explicitly distinct from an acknowledged commit.

Private packet: `/Users/imac/Documents/ELcomputer/p0-data-api-conflict-20261102/plan.json`.

```text
APPROVE P0 DATA API SCHEMA109 CATALOG CONFLICT SQL-ONLY FIX 213bf0c22686800f88cc1f21a3996d8165c97447f1e2550424b0205b99e4d3cf
```

Expires `2026-11-02T21:38:07.776Z` / 00:38:07 Riyadh, 03 November 2026.
The earlier local f79680b3seal was superseded unapproved before final receipt
clarification; it was never executed and is not an available approval.

## Targeted postflight after separate approval

Read the actual109history and exact corrected function. Recheck unchanged app/
Caddy PIDs and17protected files. Read-only HTTP checks must restore products,
categories, brands and settings; observe the loop/rollback rate falling. Do not
manufacture a product save, order, payment, shipment or email. Existing in-flight
stale requests should terminate as409; do not promise that their browser drafts
have been saved. Receipt recovery remains owner-scoped.

Let existing natural workers run. Verify MON completion and Email/PDC caller
recovery without invoking them manually. Preserve all old warnings and any new
journal gap. Never mark provider outcomes, payments, cash or emails successful
from the pool correction. If the pool remains unavailable, stop; identify exact
remaining backends/evidence and obtain a separate scoped recovery approval.

Then requalify the preserved payment-first core activation draft against actual
schema109and healthy hosted evidence; it currently has no valid activation seal.
Other business RPCs using40001remain a targeted follow-up before their respective
feature activation, not permission to change them in this patch. Apple Pay's new
merchant-specific owner report remains authoritative pending actual offered-method
verification; no generic certificate/domain blocker or repeat support inquiry.

**ONE next action:** approve the exact SQL-only correction above.
