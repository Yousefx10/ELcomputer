> E128: recovery17c CONSUMED_COMPLETE; next automatic MON passed23:20Riyadh with original3 warnings/critical0. Appa7fa8e8e/schema102 technical closeout PASS, owner acceptance pending. [Completion receipt](checkout-address-book-monitor-recovery-receipt.md). Parentc86 stays CONSUMED_STOP; do not replay parent, recovery or102. Earlier review below is historical.

> E127: schema102 COMMITTED and appa7fa8e8e/routes LIVE; parent approval CONSUMED_STOP, never replay. [Actual stop receipt](checkout-address-book-deployment-stop-receipt.md) and [separate one-field MON recovery](checkout-address-book-monitor-recovery-review.md). Historical readiness below does not authorize another deployment or migration.

# Saved-address summary and multiple addresses — guarded release — E126

28 October 2026. **ADDRESS SUMMARY READY / MIGRATION REVIEW READY / NOT DEPLOYED.**
No owner deployment approval, apply attempt, migration or cutover receipt exists.
Owner explicitly includes multiple addresses; nothing is deferred from that requirement.

## Customer behavior and reused work

Codex1's4a3cd25 summary, edit/focus, neutral loading, validation expansion and account
clearing were first carried onto deployed e47e9a7 asfb824d4. The full feature extends
that preserved implementation on additive31st worktree `../checkout-address-book-20261028/source`,
branch `local/checkout-address-book-20261028`, source **2236497a6b69acb680eb074ff23d472d91282e3b**.
The original30 HEAD/status inventories and5623 pending-file hashes are preserved,
except authorized main continuity documentation. No merge/reset/rebase/cleanup/push.

Complete current-profile or selected saved addresses collapse into the recipient,
phone and readable full address. Edit expands/focuses the form. New/incomplete
addresses expand with required fields. Customers can select owned addresses, create
an optional named address, explicitly save edits or confirm removal. Up to20 book
entries plus the current profile address are available. Drafts survive normal
selection/payment-step interactions in memory. They are cleared on account changes
and never persisted as an address book in browser storage.

Failed loads remain errors with Reload. Failed/uncertain saves retain drafts and
reuse the same creation ID only on explicit retry. Conflicts keep edits; customers
can reload, deliberately replace edits with the saved version, or keep a new draft.
Removal retains the current checkout details. Save is optional for checkout.
Existing profile addresses and order snapshots stay intact. A governorate change
invalidates stale delivery selection through the existing quote/coverage logic.

Only checkout address controls, a private composable, four own-account endpoints,
their validation helper, concise EN/AR labels, the separate102 SQL and focused tests
change. Existing checkout/order/payment/provider/MON implementations and reusable
configuration remain unchanged. No new deployment identity in application logic.
[Separate migration review](checkout-address-book-migration-review.md).

## Why four ingress rules are included

The current VPS intentionally blocks unknown `/api/account/*` routes. Read-only
qualification confirms the new collection currently returns403. This release needs
only GET/POST `/api/account/addresses` and PUT/DELETE its validated UUID item paths.
The candidate app independently denies all four without authentication (401/private
no-store), verified through the actual packaged Nitro server.

The proposed Caddyfile changes ONE existing `customer_access` expression. The real
installed adapter confirms only that expression in its two generated listener copies
changes; every other adapted configuration field is identical. Unsupported methods,
invalid UUIDs, other account/commerce/provider routes and existing callback guards
stay held. No new wildcard or Caddy restart. Actual command/binary/PID26652,
adminOFF and **CanReload=no** were verified; the proposed action is ONE SIGUSR1.
Read-only adaptation PASS; no configuration write or signal has run. Initial local
verifier receipts are retained; the listener-copy expectation was corrected before
sealing. No production operator/approval was consumed during qualification.

## Qualification

- **34 focused actual browser checks PASS /0 skipped**: EN/AR, RTL/LTR,
  desktop1440/mobile390, light/dark, summary/edit, multiple selection/draft retention,
  explicit saves, incomplete/new input, load error, lost acknowledgement, revision
  conflict, removal, governorate/delivery reset and account switches during pending
  list/save requests. CARD-only and Manual50 flow preserved. Browser business/auth/
  transport are local fixtures; all non-fixture network writes are blocked.
- **12 native SQL/API checks PASS /0 skipped** including direct RLS/privileges,
  foreign/disabled/anonymous rejection, ownership forgery, Arabic, independent
  concurrent connections, idempotence/revisions,20-row limit and original data.
- Native101→102 migration/rollback PASS;144 original projections and all old
  schema/security/Auth/history/data retained; no backfill. Two database-operator
  guards and six application/ingress guards PASS. Wrong exact approval is rejected.
- Node22.23.1 typecheck/build/diff PASS. Exact **3783 entry** archive
  readback/inventory/secret scan PASS; **2697 retained immutable
  assets** preserve bytes and all **2804 browser assets** pass
  local real-serving HTTP200/SHA256. Four compiled private routes deny unauthenticated
  requests. The established seven retained-URL registry entries were repaired locally;
  original entries/other output bytes are retained. Earlier artifacts are preserved.
- Fresh encrypted101 DB full pg_restore and11 runtime/configuration file readbacks
  PASS. No DB restore or recovery replay. No Merchant API Key access/copy.
- **22:03:52.283 Riyadh sealed read-only preflight PASS**: production
  **615506cd7c047ca8/schema101**, sourcee47e9a7/PID68874; exact inventory/certificate/
  runtime/Caddy/units/configuration and original unused emergency budget1 match.
  Signup/CARD/Manual EGP50 remain available; COD/PDC remain OFF/PAUSED.
  MON enabled/active/waiting;22:00:06 automatic report WARNING3, critical payment/
  ownership mismatches0, overdue-unverified2. No provider result is inferred.

No broad accepted Auth/payment/PDC tests were repeated. Hosted authenticated address
acceptance and actual migration/signal/cutover remain NOT EXERCISED. All DTR-33,
STOR-01 and original deferred tests stay open; no deferral was closed or waived.

## Exact candidate and action limits

- Release **a7fa8e8e3b7870d4**; source `2236497a6b69acb680eb074ff23d472d91282e3b`.
- Archive SHA256 `a7fa8e8e3b7870d4cd3436f8d55f3713be3182e546fd4e73d97ec2daf50c4676`; bytes23230640.
- Migration only `20261028210000_customer_delivery_addresses.sql`,101→102;
  SHA256 `bdca673587a172b23299f1e9a20423d5f3ea9138406968eccc7647790a6d0281`.
- Caddy candidate SHA256 `1c12f6f7aa3dac4827edeb3a0c80006ed4b66ccd91014a4a2bf949fba6827ae7`;
  exactly four method/path rules, one file write, one SIGUSR1, zero Caddy restarts.
- Exactly one ordinary application restart, zero runtime/unit/credential/MON lifecycle/
  stock/settings/provider/payment/email changes. No order, charge, refund, PDC request,
  booking, pickup, cash receipt or Treasury posting. No Git push.
- Seal `c86b92dced4747116223b0dba50ecea9a255a328130aaf5f9e8dc0db9c80ac2b`. Private packet `../checkout-address-book-20261028/plan.json`,
  `seal.json`, `release-operator.mjs`, `release-remote.py`, `OPERATOR.md` and archive.

## One exact next approval

Review the separate SQL and the limits above. The takeover instructions require
separate exact deployment approval; preparation is not that approval.

```text
APPROVE CX-ADDR-01 SCHEMA102 ADDRESS BOOK AND ROUTES DEPLOYMENT c86b92dced4747116223b0dba50ecea9a255a328130aaf5f9e8dc0db9c80ac2b
```

Expires **29 October 2026, 02:00:25 Riyadh** (`2026-10-28T23:00:25.349Z`).
No owner approval, apply attempt, execution intent or remote stage exists.
The earlier single-address seal6922b6d is **REJECTED_SCOPE_CHANGED** and its recorded
rejection prevents approve/apply, even before expiry. Consumed COD/MON/Inquiry/
CX-CART and all historical approvals must never be replayed.

Mandatory execution: fresh sealed target/input/schema/CARD/MON/route guards; one
single-use local attempt; approved migration preservation checks before commit;
loopback candidate; one application cutover/restart; one exact Caddy change/signal;
public private-route/held-route guards; every public asset HTTP/hash once; then a
fresh automatically updated MON report after cutover/ingress. Reuse the asset receipt
while waiting for that report. Owner hosted acceptance follows separately.

Stop on drift, expiry, partial checkpoint or transport uncertainty. No retry, second
signal/restart, automatic app/config/schema rollback or migration replay. Preserve
committed checkpoints and obtain a new exact recovery seal. Keep/rebind the ORIGINAL
emergency purchasing-close budget1 and callbacks; no new allowance is created.

Material risks: brief app interruption; a short profile-lock wait for the new FK;
after-commit or after-cutover stop requires separately approved recovery. Actual
Caddy signal/hosted authenticated access are unexercised until approval. If this new
release deploys, the old held COD activation's615506/schema101 bindings must be
requalified on the new actual baseline before any separate activation approval.

Next feature remains LOC-01 checkout AND profile dropdowns, then CX-NAV-01. No
location or navbar implementation is bundled. Preserve the old mapping branch and
reconcile its historical96 numbering against actual then-current history.
