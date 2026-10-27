# Schema95 asset recovery receipt — E66

**SCHEMA95 DEPLOYMENT: PASS.** Completed 2026-10-27 01:18:48.829 Riyadh.
Public frontend HTTP postflight passed at 01:19:14.017 Riyadh.

The owner approved exactly:

```text
APPROVE SCHEMA95 ASSET RECOVERY 60b1fee08340d437a88dcb66093cdd18aa0b8544ae6d16c067a2cf505168d48f
```

The [review](schema95-asset-recovery-review.md), sealed packet, original deployment
STOP and committed95 receipt matched. Fresh read-only preflight passed at
01:16:41 Riyadh. Encrypted recovery hashes and authenticated decryption matched
their full-readback proofs. Recovery expires at 05:46:05.866 Riyadh; execution
finished within that window. All 22 scope and 10 remote/adapter guards passed,
with zero skipped. The original archive was reused without rebuilding.

## Production result

| Item | Verified result |
| --- | --- |
| Active release | `81becf54218a8e14` |
| Source | `b37be43ac6a24a663a12a5a56aaaa7e801827963` |
| Application archive SHA256 | `81becf54218a8e144137f2bdce7df1eed6bcc07745924c0167fcd7435aae37ff` |
| Database | Schema95; latest migration `20261026170000`, `unrecorded_normal_sales` |
| Migration replays / database writes | 0 / 0 |
| Main application | One restart; PID `40775` → `45853` |
| Caddy | One SIGUSR1; PID `26652` retained; no restart |
| Caddy configuration SHA256 | `4cf2829e60d71316991c8c29a12e382508bdaea31bc083caa58d964d15902d87` |
| Signup | OPEN; email confirmation required; accepted Turnstile runtime preserved |
| Public Cart / Checkout | 403 / 403; purchasing disabled |
| Paymob | Existing credentials/callback routes preserved; new initiation disabled |
| PDC | PAUSED; outbound gates disabled |
| Runtime / Auth / business settings | Unchanged |
| Protected data | All145 sealed projections, Auth security, history, migration ledger and exact95 schema preserved |
| Media / private files | Hashes unchanged |
| Provider calls / payments | 0 / 0 |

The private loopback application/static candidate passed before activation and
was stopped. The new-only asset passed direct loopback HTTPS after Caddy loaded,
before switching the main application. Current and retained public assets use
the approved current-release root and retained95 fallback.

## Frontend checks

- All1,639 previous asset entries remain byte-identical in the active inventory.
  The active inventory has1,744 asset entries, excluding `builds/latest.json`.
- Three retained and three new JavaScript bodies returned200 with exact hashes.
  All six HEAD checks also passed immutable caching and JavaScript content type.
- EN/AR homepages returned200. All33 distinct referenced frontend assets returned
  200 and matched the active inventory hashes.
- Latest build metadata returned200 with short caching. Missing and hidden asset
  paths returned404. EN/AR login returned200; anonymous history remained401.

These are deployed HTTP/integrity checks. Existing accepted Auth/payment results
were preserved; no new account, Auth submission or customer purchase was tested.

## Preservation and consumed approval

The recovery approval is **CONSUMED_COMPLETE**. Do not replay this operator, the
original consumed deployment operator or migration95. No automatic retry,
rollback, down-migration or database restore occurred. Retain the asset fallback
and old release for separately reviewed recovery.

All135 frozen paths and the separate clean schema96 worktree passed preservation
checks. The32 deferred-test register remains byte-identical; pending tests remain
pending. No merge, reset, branch deletion, Git push or unrelated code change occurred.
Main remains schema91 continuity/tooling; it is not the deployed application source.

Private evidence: `../schema95-asset-recovery-20261026/`, including
`codex1-fresh-preflight-20261027.log`, `execution-intent.json`, `execution/`,
`codex1-approved-execution-20261027.log`, both guard logs and
`codex1-public-frontend-postflight.json`. Original failed evidence remains intact.

## Exact next step — BETA-11

Prepare separate authorization for ONE owner-operated genuine new-customer
normal storefront CARD purchase. Bind an eligible published product/model,
quantity, real address, separate Manual delivery at EGP50, explicit unrecorded-stock
configuration, exact total, fixed durable command and one-charge budget. Keep PDC
paused and public purchasing closed outside the bounded controlled window.
Preserve the server QA-address rejection and signed-callback payment authority.

That approval must cover the required configuration and bounded purchase window;
this recovery approval permits neither. After the purchase passes, request separate
public-purchasing activation with monitoring, manual remedy and a kill switch.
