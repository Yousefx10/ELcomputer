> **CURRENT E186 — P0 RESTORATION COMPLETE / FEATURE WORK PAUSED:** Production81f6206b393714ae/schema108/source7b33ed0;6b762153 CONSUMED_COMPLETE. [P0 receipt](storefront-checkout-incident-20261102.md). Actual hosted browser/cart/PDP/sign-in and sealed postflight PASS; CARD/COD/Email/tracking/MON preserved, new payment-first/InstaPay OFF. Original e0/830/109 implementation preserved. Do not replay e47/8714/6b76, restart or activate features. Await owner post-restoration priorities before resuming new customer ingress/monitoring work. Earlier next-action entries below are historical.

> **CURRENT E184 — INACTIVE108 DEPLOYED:** Productioneb50f11c35c0bf62/schema108/sourcee0ece3a. Recovery8714cutover succeeded once; one app restart,0SQL/upload. Independent read-only technical closeout PASS; raw403-versus401 STOP preserved. Both e47/8714spent—never replay. New controls OFF,live CARD/COD/Email/tracking/MON preserved. [Current receipt/activation gates](payment-first-core108-release-review.md). ONE next action: qualify exact new customer API ingress; current session list403. Earlier recovery-ready checkpoints below are historical.

> **CURRENT E183:** Inactive108 is committed; app cutover remains pending. Parent e47 is CONSUMED_STOP. [App-only recovery](payment-first-core108-release-review.md) is SEALED READY/UNAPPROVED, seal8714d1d31eb6713b75003082b8fe3b5cc4b4391836552e2b1142965d3ecee090; expires2026-11-02T15:04:59.787Z, start by2026-11-02T14:49:59.787Z. Reuse stagedeb50,0SQL/0upload/1restart, new controls OFF. Never replay parent/migration. Read current handoffs and the recovery packet.

> **CURRENT E182:** e47 deployment approval is CONSUMED_STOP. Schema108 committed; live app remains5fa9 with no restart/cutover. All new controls OFF. Do not replay the parent installer or its migration. New existing-candidate app-only recovery is being prepared in `/Users/imac/Documents/ELcomputer/payment-first-core108-cutover-recovery-20261102`. Read current handoffs before acting. Earlier READY/UNAPPROVED checkpoint below is historical.

# CURRENT CHECKPOINT — resumed and release-qualified2November2026

The owner resumed the E179 pause. The saved830 implementation was complete.
Current clean HEAD is e0ece3a162f0c081b19f63a4fb33b44e4598d82d, tests-only on830.
The old OWNER_PAUSED snapshot below is historical, preserved evidence.

Inactive core108 packet READY / UNAPPROVED. Final sealed read-only preflight PASS
2026-11-02T10:24:11.767Z; production5fa9/schema107 unchanged. New initiation controls OFF.
[Current release review](/Users/imac/Documents/ELcomputer/ELcomputer/docs/payment-first-core108-release-review.md)
contains all gates, exact approval/expiry, tests and rollback/disable boundaries.
Private packet: `/Users/imac/Documents/ELcomputer/payment-first-core108-release-20261102`.
Read its OPERATOR.md, plan.json and seal.json before any operation; use pinned Node22.23.1.

Seal `e47ceaabe0c52fee7e79b21dd670e78e0ff055f5feb4dba0d0db80f50e651f2e` expires2026-11-02T14:22:46.328Z; start by2026-11-02T14:07:46.328Z.
No approval, stage, migration, restart, deployment, provider request or message was
performed. Do not infer authorization from this checkpoint or old consumed seals.
No repeat of successful expensive matrices/build is required unless inputs change.
Before future execution recheck exact target/state/inputs and time; stop on drift.

ONE next action: owner exact inactive108 approval in the current review. After
approved inactive installation, complete hosted qualification and separately seal
MON private-funds installation/complete checkout activation; addon109/bank settings,
provider methods/Pixel/catalog/metadata remain independent. Preserve all47trees/
35deferred IDs, six existing MON warnings and cancelled/quarantined records.

---

# PAY-FIRST-01 — owner-requested safe pause

**OWNER_PAUSED — 2 November 2026.** Stop requested for the Codex usage limit.
Do not continue implementation or operational work until the owner resumes.

## Exact resume point

- Main project: `/Users/imac/Documents/ELcomputer/ELcomputer`.
- Isolated workspace: `/Users/imac/Documents/ELcomputer/payment-first-checkout-20261101`.
- Code worktree: that workspace's `source` directory.
- Branch: `local/payment-first-checkout-20261101`.
- Clean committed code: `830558dc7b1655ddbb2a2d957e52863ef6036c39`.
- Parent checkout A–E reuse: `571a670`; deployed source base: `7b3706768206a8852483999e98b0b1b46d1a0b04`.
- Source is clean. Main handoff/documentation changes intentionally remain unstaged;
  they include preserved earlier work. Do not stage/reset or commit them blindly.
- Full local [review](payment-first-checkout-review.md) and
  [design](payment-first-checkout-design.md) are saved in this project and source.
- Private exact state/evidence manifest: `checkpoint-20261102.json` in the workspace.
  `RESUME.md` there repeats these instructions. No global memory was changed.

## Completed — do not redo

Payment-first core, private durable attempts/callback evidence, HMAC-only paid-order
creation, deduplication/concurrency, frozen terms, per-line paid cart clearing,
owner/staff privacy and legacy cancellation hold are implemented locally.
COD remains unpaid at confirmation with server-authoritative configurable fees.

Manual InstaPay has private submission/review, recipient settings, image/inert-PDF
proof storage, actual bank-credit assertions, unique references/audits and one paid
order after verified funds. It reuses packing/video/zero-COD PDC eligibility without
booking. Provider readiness uses the existing registry; unqualified methods stay OFF.
Optional GET-only MON private-session aggregates are locally qualified, default OFF.
Disabling new sessions preserves late callbacks and permanently blocks fallback to
new unpaid prepaid orders after the new lifecycle has been activated.

All107 historical migration files are unchanged. New candidates only:
`20261101220000_payment_first_checkout.sql` (108 core) and
`20261101221000_manual_instapay_checkout.sql` (109 addon after108).
The prior qualified cancellation function body is identical in core108.
Old catalog108/109 and cancellation110 labels are provisional: never blindly combine.

## Qualification saved

- `qualification-composed-current.log`:141 passing Node tests, zero failures/skips.
- `legacy-paymob-qualified.log`:41 passing Paymob/security/native race tests, zero skips.
- `core-alone-qualified.log`:23 passing native/HTTP tests without addon109.
- `monitor-final.log`:26 passing Python monitor tests; no provider/SMTP action.
- `qualification-browser-chromium.log` and `qualification-browser-webkit.log`:
  103 Node results each (102 actual scenarios/engine),204 scenarios total.
  Actual Vue, EN/AR/RTL,320/390/768/1440, light/dark, cart/privacy/review behavior.
- `build-qualified-results.json`: final830558d typecheck0/build0 using pinned
  Node22.23.1, empty dotenv and fixture origins. Build completed just before the
  pause cleanup check; no process needed termination. Generated output is local only.
- Migration rollback, owner RLS, exact old107 file bytes, inactive defaults,
  disable/late success, unknown signed mapping quarantine and actual fixture-stock
  release passed. Validated isolated packing video used no courier request.
- `source-preservation.json` records107 unchanged migration files and109 total;
  `preservation-before-final.json` records46 old worktrees/24,133 pending hashes/35 IDs.
- Twenty-six stale COD/location/source assertions were reproduced on untouched
  deployed7b; logs in `deployed-baseline-regressions.log`. No all-repository-green
  claim. Existing deferred tests/evidence remain. New Paymob test harness imports
  and Nuxt config evaluation were corrected without removing safety assertions.

Do not rerun successful matrices without new changes or a specific concern.
Earlier failed local attempts are preserved as diagnosis, not production defects.
Pre-existing orphan PostgreSQL processes were not touched. Owned fixtures closed.
No new worker, browser test or build needs to remain running for this checkpoint.

## Production boundary

Last read-only verification: 2026-11-01T21:25:21 UTC / 2 November00:25 Riyadh.
Production `5fa9ef1bf4b05359 / schema107`; app169602/Caddy26652;17 protected
hashes and150 table projections checked. CARD/COD/Email/tracking/MON remain live,
fee10 intentional, same six warnings/zero critical and original journal gaps.
Nine original orders/payment evidence unchanged; zero eligible genuine AWBs.
See private `production-final.json`, `production-final.private.json` and
`database-final.private.json`. These observations are time-bound, not a future seal.

`ORD-20261101-96B4660736` remains cancelled/provider-unverified. Never reopen,
retry, inquire, refund or reclassify it without evidence and a separate approval.
The old uncertain PDC booking stays quarantined. No synthetic production orders.
No production SQL/configuration, deployment, restart, provider request, charge,
refund, shipment or email was performed. Current app activation flags stay as-is.
New runtime/DB controls default OFF and are not installed in production.

No new deployment/activation approval or expiry exists. All old approvals remain
consumed, including visual940c/e613; never replay them. Auth SMTP remains untouched.

## First action when the owner resumes

Read this checkpoint, AGENTS.md and central handoffs; verify source830558d is clean
and inspect the saved qualification/build results. Continue from release preparation,
not implementation from scratch. Prepare the separately sealed **inactive core108**
packet after fresh managed-role/target/history/backup/rollback/operator preflight.
Do not deploy or activate without a new exact owner approval.

The core is qualified with and without addon109. Keep B109 installation/activation,
provider C methods and catalog D independently gated. No partial active checkout.
Fresh read-only evidence must use new filenames: existing capture helpers use
exclusive writes and must not overwrite old receipts. If live state drifts, stop
and document the exact drift; do not rebind/clear warnings or bypass guards.

Before activation qualify hosted privacy/callback readiness, the optional monitor
installation, real merchant hosted-return/3DS behavior under separate transaction
approval, and owner operational acceptance. Unknown signed provider mappings stay
quarantined; never correlate by amount/age/unsigned special_reference. No automatic
Pay Again or unknown-response retry. InstaPay still needs real verified bank
settings, staff roles, hosted private files/backups/retention and operating acceptance.

Emergency disable is revision-checked DB initiation OFF while retaining the new
writer/callback/finalizer and history. Never restore old DB/drop evidence or roll
back to an incompatible callback binary after private attempts exist. No automatic
rollback. COD and current live services must be preserved.

Pixel/Pay Again await the existing provider reply. Preserve metadata9b4107c,
visual acceptance TODOs, all worktrees/35 deferred IDs. PDC settlement/ERP remains LAST.
