> E128: recovery17c CONSUMED_COMPLETE; next automatic MON passed23:20Riyadh with original3 warnings/critical0. Appa7fa8e8e/schema102 technical closeout PASS, owner acceptance pending. [Completion receipt](checkout-address-book-monitor-recovery-receipt.md). Parentc86 stays CONSUMED_STOP; do not replay parent, recovery or102. Earlier review below is historical.

# One-field MON-01 hash recovery — E127

28 October 2026. **RECOVERY PREFLIGHT PASS / NOT APPROVED / NOT EXECUTED.**
Parent c86 deployment is CONSUMED_STOP. Current **a7fa8e8e3b7870d4/schema102** is
installed and serving. [Consumed deployment receipt](checkout-address-book-deployment-stop-receipt.md).

## Exact correction

Change only `/etc/commerce-monitor/config.json` → `caddy_sha256`:

- From `af9720fe07ffd367f1e5636ba13f58f59e46181aa09281e78d77aff0f6e7ebd1`.
- To **the already approved/current routing**:
  `1c12f6f7aa3dac4827edeb3a0c80006ed4b66ccd91014a4a2bf949fba6827ae7`.
- Before config SHA256:
  `e8653ce24b61f04ab757ceae2ca3c6154623958d09cb40c22ea2968ec8dbdab6`.
- Proposed config SHA256:
  `93f34393966b79e9910d372a688796d3814e4cfce53c4b1aa5dc6b44a89b6c29`.
- Both files470 bytes, mode0600/root:root. One exact64-character replacement;
  every other byte and JSON value remains unchanged. No recipients/secrets exported.

This cannot accept an arbitrary current Caddyfile. Actual Caddy bytes must match
that separately reviewed parent ingress hash, with the same app archive/certificate,
unchanged runtime/units/configuration and stable existing app/Caddy PIDs.
The full callback-config hash check remains active and detects future drift.

## Actions after the NEW approval only

**One monitor config write. ZERO app restarts, Caddy writes/signals/restarts,
SQL/migrations/business writes, service/timer actions, provider/payment/email calls.**
No app archive upload, cutover, migration102 replay, Caddy re-signal or parent retry.
Copy/read back the exact root-private config before the one atomic replacement.
Then wait for the next automatically completed MON report after that write; it must
return to non-critical complete coverage. Do not manually run/restart MON, clear
history/deduplication or rewrite the stopped parent receipts.

The parent approval did not include monitor-config changes and is consumed.
Preparation is not permission to make this correction. Original emergency-close
budget1 is preserved/rebound to the final exact bytes under its existing financial/
privacy/coverage conditions; no new budget or automatic purchasing closure.

## Qualification

- Three focused tests PASS: exact one-field/byte preservation and invalid-baseline
  rejection; wrong scope/approval/expiry rejection; unchanged MON worker detects old
  mismatch, accepts the separately approved hash and still rejects subsequent drift.
  Monitor tests use local fixtures; no hosted worker invocation.
- Fresh **22:51:45.206Riyadh** recovery preflight PASS: exact app/current inventory/
  certificate/schema102 and current Caddy1c12f6…; existing appPID70394/CaddyPID26652,
  unchanged Caddy start/NRestarts0, active/enabled five-minute MON. Latest22:50:05
  automatic check complete/CRITICAL4, solely the known hash alert plus original
  three warnings. Financial/ownership/signed-success/duplicate counts0; CARD/Manual50
  available, COD/PDC OFF. No new recovery approval/attempt/config write.
- All2804 public HTTP/hash asset checks and address/held-route privacy guards already
  pass on these exact installed bytes. Recovery reuses that receipt while verifying
  the unchanged app inventory/Caddy file, rather than repeating asset sweeps while
  waiting for MON. No hosted customer acceptance claimed or deferred tests closed.
- The old encrypted runtime recovery already includes the exact unchanged original
  monitor config. The new operation also makes a fresh root-private before-copy
  with hash readback. No database restore or older-schema backup replay is allowed.

## Exact next recovery approval

```text
APPROVE CX-ADDR-01 MONITOR HASH RECOVERY 17c438d8ad889431bcf92f53daf4496a3a8e0aa04c516154022b239cf90f67ab
```

Seal: `17c438d8ad889431bcf92f53daf4496a3a8e0aa04c516154022b239cf90f67ab`.
Expiry: **29 October 2026, 02:50:14 Riyadh** (`2026-10-28T23:50:14.813Z`).
Private packet: `../checkout-address-book-monitor-recovery-20261028/plan.json`,
`seal.json`, `operator.mjs`, `recovery-remote.py` and `OPERATOR.md`.
No recovery owner approval, apply attempt or execution intent exists.

Fresh mandatory guards, one local attempt and one new VPS stage remain required.
Any drift, guard failure, partial checkpoint or uncertain transport consumes the
attempt: stop, inspect read-only and obtain new authority; no retry/rollback or
extra config write. Parent c86 remains CONSUMED_STOP even after a successful new
recovery; closeout must reference both receipts without rewriting history.

After a successful automatic non-critical MON report, owner checkout acceptance is
still separate. Then resume LOC-01 checkout/profile selectors with fresh numbering
from actual102/repository history; preserve the old96 work and all deferred tasks.
