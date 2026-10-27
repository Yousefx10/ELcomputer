# Schema95 deployment STOP receipt — E64

Recorded 2026-10-27 Riyadh. **PARTIAL: SQL installed; application not switched.**

The owner approved seal `a510a04dd2d55b0b39c22c1b88437008ecaefbc1cc94ca3872305209840febab`.
Fresh matching preflight passed. The one-shot operator created and verified fresh
execution backups, staged the exact unchanged archive and asset companion, and
committed migration95 once at 2026-10-26 23:48:34 Riyadh. Its transaction verified
all145 original protected table projections, Auth security, imported history,
original94 migration statements, access controls and the exact expected95 schema.
No business data or sales settings were rewritten; tracking defaults to true.

The temporary candidate started, then failed the retained-asset HTTP check. The
operator stopped and cleaned up its temporary service before any activation intent,
current-link switch or main application restart. No automatic retry or rollback ran.
Approval is **CONSUMED_STOP**; never rerun its apply, check, candidate or migration.

## Verified current state

| Item | Result |
|---|---|
| Current application | `5a38201292763325`, source `3001cd69b711240640fc523c9482c4f84b58c573` |
| Database | schema95; exact migration95 installed once |
| Main Nuxt process | Original PID retained; zero main restarts |
| Caddy | Original process/config retained; zero reloads/restarts |
| Staged candidate | `81becf54218a8e14`, source `b37be43ac6a24a663a12a5a56aaaa7e801827963`; not active |
| Signup / confirmation / Turnstile | OPEN / required / accepted runtime preserved |
| Public purchases / provider gates | OFF; no card charge or shipment |
| Auth, profiles, permissions, history, orders | Original projections/security preserved |
| EN/AR login / Cart / Checkout / anonymous history | 200 /403 /403 /401 |
| PDC | PAUSED; original incident/barriers preserved |

Read-only post-STOP checks confirmed these facts. The old application works with
additive95 at its preserved default. Do not down-migrate or restore the database.
The paused state is not a completed application deployment or hosted purchase PASS.

## Exact blocker and correction

I missed Nitro's compiled asset manifest in initial qualification. The separately
preserved files exist, but Nitro does not serve retained URLs absent from that
manifest. Exact-artifact local reproduction: retained `-61V145G.js` exists but returns
404; a current-build asset returns200. Original archive and SQL remain unchanged.

The [separate recovery review](schema95-asset-recovery-review.md) prepares a public
`/_nuxt/*` file-serving route in Caddy, including a verified retained fallback for
rollback. This keeps the frozen application bytes intact. It needs new approval
because the consumed a510 scope explicitly excluded Caddy changes.

Private execution/STOP/migration/read-only evidence:
`../schema95-beta-release-20261026/review-2/`.
Local cause/correction and new sealed recovery evidence:
`../schema95-asset-recovery-20261026/`.
Both source branches, detached context, commits and135 frozen dirty paths remain
preserved. All32 deferred rows are unchanged; none became passed or cancelled.
