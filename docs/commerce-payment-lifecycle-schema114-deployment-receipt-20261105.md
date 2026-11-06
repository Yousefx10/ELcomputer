# E258 — Release A deployed and independently verified — 5 November 2026

**DEPLOYED / TECHNICAL POSTFLIGHT PASS / CONSUMED_COMPLETE.**
Owner checkout, physical Apple/3DS/OTP and provider finality remain separate.
Never replay this approval, approve/apply command, archive stage or restart.

## Installed state

- Origin: `https://elcomputer.net`; reviewed root `/srv/storefront`, unit `storefront.service`.
- Application `4f32e3bee6f2f137`; source `e9361ea16e6e8c6bab08ce41ce34701c46097a63`.
- Physical schema114; latest migration `20261104140000_storefront_discovery`.
- App PID 295093; Caddy PID 26652 unchanged.
- Cutover acknowledged at 03:03:00 Riyadh, 5 November 2026. Exactly one app restart.
- Original operator CONSUMED_COMPLETE at 03:05:52; independent audit PASS at 03:06:36.

## Approval and execution scope

Exact owner authorization was supplied in this conversation and recorded by the
unchanged operator at 03:00:39 Riyadh after fresh read-only preflight. Seal:
`bdbb3d386f2bc552bc8b25a8f5f7f1d143e72a20d971407506f2942707b58c98`.
The one-use attempt began at 03:00:59, within the sealed start window. The archive
and existing builds/tests were reused without rebuilding. No other seal was used.

The only production mutations were one sealed archive stage, one application
cutover/restart and one bounded pause/resume of each existing MON/Email/PDC timer.
All timers are active/enabled and natural callers show successful results.
Pause durations were 10.96s MON, 10.90s Email and10.84s PDC, within 180 seconds.
No SQL/history/business/financial write, runtime/flag/Caddy/unit/credential edit,
manual worker call, provider inquiry/transaction, policy activation or Git push.
No recovery, rollback, database restore or replay was needed.

## Independent evidence

All 14 original attempts and all nine original financial table projections match
their protected baseline exactly. There remain 14 sessions/attempts, 11 orders,
zero checkout funds, callbacks and proofs. Schema/history remain114. Amount,
reconciliation, duplicate-success and ownership integrity counters are all zero.
Every one of 17 protected configuration/worker files retains its original bytes,
mode and ownership. Loaded process runtime and monitor/Caddy binding match.

All5, 019 new/retained static assets returned 200 from canonical public HTTPS
through unchanged live Caddy. Each complete body matched its expected length
and SHA256. The previously qualified pinned-VPS verifier was reused; this is
serving-path evidence, not filesystem-only evidence or global client performance
acceptance. No sealed operator or production timeout was changed.

Twelve additional hosted method checks passed: EN/AR home and cart 200; ordinary
and Apple checkout anonymous redirects 302; private payment list/detail GET and
interface/proof POST return 401 with private no-store/no-referrer headers. No
customer session or credentials were used. The unauthenticated POST requests
were rejected before payment processing. These checks are not signed-in acceptance.

The next natural MON run succeeded at 03:05:05 Riyadh: eight existing warnings,
three journal gaps and zero critical findings. No monitor was manually invoked.
The surrounding app journal audit found zero error-priority or unhandled-error
entries; raw logs were not exported. Existing Email/PDC natural callers passed.

## Behavior and unresolved evidence

The deployed correction selects retained checkout commands by current account,
cart and revision. Relevant conflicts remain inline with their private reference.
New independent purchases no longer replay an unrelated retained command.
Unsubmitted forms retain immediate safe retry through the existing server gate.
SQL113 financial protection, authenticated callbacks, quote authority and ownership
remain unchanged. Opening UI alone is distinct from arming a payment submission.

Both original references remain separately preserved and financially uncertain:
`CHK-724EDD15767942B3` is historical interface-unknown; `CHK-5AB39404CFB747A4`
has a submission fence before native Apple authorization. No local funds or
callbacks do not prove no provider charge. Neither was cleared, cancelled, merged
or declared uncharged. Their affected obligations remain protected.

The Apple document-preservation guard is deployed. Pixel1.2.8 bytes are unchanged.
Native sheet dismissal after arming remains unknown; a UI cancellation callback
cannot release a financial fence. Paymob evidence and physical merchant/device
acceptance remain open. No real provider operation or financial test was run.

## Other candidates and continuation

Only A is deployed. B cart/delivery/coupons (`e3ba3b7`), C inactive preorder/COD
capability (`e39dfa6`) and D visuals/public-image caching (`79775a1`) remain local.
B now has an actual installed A predecessor, but still needs fresh target/ledger,
proxy/monitor bindings and its own qualified one-use execution packet. No live
migration positions are reserved. Never reapply schema114 or predecessor SQL.

Coupon policy remains unchanged and gated; preorder CARD/Apple capability is not
installed/activated by A; COD stays fixed EGP10. The narrow cart Caddy change,
monitor candidates and bounded inquiry library remain uninstalled. Meta remains
uninstalled/OFF; its old unspent packet now needs source/asset/target refresh
against deployed A. Daftra/SMS remains owner-paused at `b782b13`, with its existing
builds, failures and unfinished guards preserved. All source worktrees are retained.

Machine evidence is in `../commerce-reliability-20261104/release-a-final-ready-execution/`:
`owner-approved.json`, `apply-attempt.json`, `execution-intent.json`, `staged.json`,
`database-readonly-before-cutover.json`, `timers-paused.json`, `cutover-complete.json`,
`hosted-asset-verification-ssh.json`, `postflight-assets.json`,
`hosted-method-postflight.json`, `consumed-complete.json`,
`independent-closeout.json` and `app-journal-audit.json`.
Encrypted database/runtime backup and readback receipts remain protected there.

**ONE next action: prepare B's fresh guarded packet against deployed A.**
Owner signed-in/device/provider acceptance remains open and must not be inferred
from these technical checks. No B/C/D deployment or activation is authorized.

---

## Earlier execution notes

> **CURRENT E257: INSTALLED / POSTFLIGHT ACTIVE.** Release `4f32e3bee6f2f137`, source `e9361ea`, schema114, PID295093. Cutover acknowledged at03:03:00 Riyadh, one restart; existing timers resumed. No SQL/runtime/Caddy/provider/financial change. Never replay apply.

# E256 — Release A execution receipt — 5 November 2026

OWNER AUTHORIZATION RECEIVED. Guarded fresh preflight/approval recording active.
No completed deployment is claimed yet.

Exact seal: `bdbb3d386f2bc552bc8b25a8f5f7f1d143e72a20d971407506f2942707b58c98`.
Operator directory: `../commerce-reliability-20261104/release-a-final-ready-execution/`.
Candidate: `4f32e3bee6f2f137`; source `e9361ea16e6e8c6bab08ce41ce34701c46097a63`.
Schema114 stays unchanged. One archive, one app restart/cutover, bounded pause/
resume of the existing MON/Email/PDC timers only. All other scopes stay protected.
The exact owner statement is retained by the operator only after fresh preflight.
Never replay apply, reuse consumed approval, auto rollback or retry an uncertain
staging/cutover/restart. Independently inspect actual state after any STOP.

The existing source/build/archive/tests and encrypted backups are reused. No
rebuild, SQL, provider/financial action, activation or Git push is authorized.
Postflight must verify preserved financial/schema/configuration state, all5,019
new/retained asset hashes, public/private method contracts and next natural MON.
Physical Apple/3DS/OTP and authoritative finality for both real references remain
separate. B/C/D, Meta and owner-paused Daftra/SMS are not deployed by this approval.

Approval was recorded by the unchanged operator at `2026-11-05T00:00:39.870Z` after fresh
preflight. The one-use apply marker exists. Staging/execution is active; do not
invoke approve/apply again. No completed cutover is claimed by this note.
