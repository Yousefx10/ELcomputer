> E99: approval recorded and recovery consumed after application cutover.
> Production b4b502a03207713a/schema98; timer disabled. Never rerun recovery.
> See [the stopped-recovery receipt](mon01-journal-recovery-stop-receipt.md).
> Preparation/readiness statements below are historical.

# MON-01 — guarded stop and journal recovery review — E97

Prepared28October2026, Riyadh. **Recovery ready; not approved or executed.**

The approved Dashboard installation stopped before application cutover. The
original approval was recorded and consumed once. Its operator must never rerun.
Production remains **a402cf24a9685e0d / schema98 / PID55343**; no app restart ran.

## Proven stop and minimum correction

The first worker check reported JOURNAL_OR_SERVICE_UNAVAILABLE. Read-only checks
as the installed monitoring user proved that permissions, service access and time
arguments worked. Full journal JSON was5,838,505bytes for5,563 records, exceeding
its4MiB command-output bound. The same records projected to MESSAGE and PRIORITY
were2,199,632bytes. Neither raw journal nor credentials were exported.

Worker commit568c8ddbb68f06d5558b0d10e8c4211bc9fb7e47 adds only
`--output-fields=MESSAGE,PRIORITY` to journalctl. It preserves every message and
priority, the4MiB/10,000-record/6-second bounds, service permissions and sandbox.
22worker checks PASS, including a metadata-heavy journal regression retaining
all4,000 checkout-failure records and a projected-message overflow still stopping.
Five new recovery-guard checks PASS: exact fresh approval/expiry, bounded scope,
read-only inspection/emergency lifetime, parent immutability and first-check stop
without app/runtime/cutover mutation or a second attempt.

The unchanged application source remains feea512aab9a2c8bcdd5adc0514aaacd0133b63a.
Reuse staged **b4b502a03207713a** and archive SHA-256
b4b502a03207713aba0af2927e928af70054132e343e6d1026dd5f801c263e10.
The earlier7API/settings/UI and8installer checks, production build,2,268 local
served asset hashes and full archive qualification remain applicable. No app
code changed and none of those successful checks was repeated.

## Existing host state

The single approved attempt installed the locked monitoring user/group, worker,
service/timer, private config/commerce-read credential, state/report directories
and exact staged application. Its first check failed. Timer is inactive. The app
report-group drop-in was never published, runtime was not changed, current release
was not switched and no app restart occurred. Caddy PID26652 remains unchanged.
Original public activation's single-use emergency-close budget remains unused.

The original local/remote intent, runtime recovery copy and staged VERIFIED.json
remain immutable. The latter certifies the parent artifact/seal, not recovery
activation. Separate recovery receipts bind the fresh authority to that artifact.
Do not rerun approval-recording code or the original deployment. The parent
operator now also detects intentional local worker-input drift.

## Recovery scope and guards

Fresh private packet: `../mon01-journal-recovery-20261028/`.
Authoritative files: plan.json, seal.json, recovery-operator.mjs,
recovery-remote.py, preflight receipts and readiness.json.

Recovery replaces only the worker. It reuses existing user/group, units,
credentials, state, runtime backup and staged release. No credential file is
rewritten. It checks the original stopped state, all file hashes/metadata,
application/runtime/Caddy identities, staged inventory and remaining kill budget.
It starts the existing worker, requires a complete non-critical report, tests
actual app-reader privacy and the private candidate. Only then may it publish
the existing report-group drop-in/private runtime path, switch the application
and use the **one unused application restart**. It then enables the persistent
five-minute timer, checks publication, verifies all2,268 live asset hashes and
critical ledger invariants, and records completion. Owner Dashboard observation
remains separate acceptance after deployment.

No SQL write/migration, Caddy change, new key, Auth SMTP access, email/test
notification, provider inquiry, charge, callback replay, order/stock action,
public activation or Git push. No automatic rollback or retry. Each recovery
intent is exclusive; any stop requires inspection. The original emergency-close
budget remains shared and single-use, preserving callbacks and order access.
The original helper is loaded as validated definitions only; its installer is
never invoked and its sealed files/receipts are never changed.

Read-only recovery preflight **28October00:51:54Riyadh PASS**. Any eventual execution
must repeat fresh live guards before its exclusive recovery intent. Expiry remains
**28October2026,06:08:53Riyadh**; it was not extended. No recovery approval or
execution intent exists. The original exact approval cannot authorize changed
sealed input after its consumed guarded stop.

## Current operational evidence

Latest full ledger/runtime checkpoint **28October00:54:45Riyadh** covered since
00:37. New orders/attempts/transactions0; critical ownership, amount, duplicate and
success-ledger reconciliation exceptions0. CARD, signup and ManualEGP50 remain
available; PDC remains PAUSED. WOLF remains Paid/Processing/untracked/unpacked,
with no shipping job. Fulfillment still needs real staff action.

The friend EGP3149 order/attempt changed locally to Cancelled at00:44:01, with
paid0 and no provider transaction. A specific read-only00:56:44check confirms no
signed callback-ledger proof or independently queried provider result. This does
not establish provider nonpayment. No order, reservation or business write was
made by this work. Keep it UNVERIFIED until Paymob evidence; the worker already
flags terminal-provider-uncertain states. No retry, fulfillment or refund.

Available application journals show no identified checkout/callback failure.
Four generic markers are unclassified, not confirmed checkout errors. Caddy has
no per-request access logging; absence of journal errors does not prove absence
of rejected requests. Original browser DTR-33 stays open.

**Public Beta WARNING.** Automated monitoring is not active and email is off.
The00:15 checkpoint was missed; first worker failed before timer activation.
No complete timely00:15/00:30manual check is recorded. Catch-up completed00:37; next full00:54checkpoint was17m23s later.
Preserve the earlier15missing points; catch-up does not establish past staffing.
Next staffed checkpoint **01:09Riyadh**. Core Dashboard alerts still require
staff attendance and do not cover a total VPS/network outage from outside it.
Use the existing kill procedure only for an established critical issue or
unavailable monitoring/fulfillment coverage, as previously authorized.

Original32deferred rows, DTR-33, STOR-01, schema96 location work, storage audit
and all existing Git work remain open/preserved. No live payment test repeated.
Optional email setup remains separate in the prior Dashboard-core review; its
recipient remains Dashboard-editable and an address alone never enables sending.

## Exact next action

Review and approve the fresh, single-use recovery:

```text
APPROVE MON-01 JOURNAL RECOVERY 6e0c96c4a4c09b2562fb93534d79b2d9e328dfc913b9fd086f20c223f6fdcab4
```
