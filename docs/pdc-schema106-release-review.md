> **E159,31October2026: DEPLOYED INACTIVE.** Current ce4142a02ffd7afb/schema106/source063. Recovery91cc CONSUMED_COMPLETE; original84e0 consumed-stop retained. One total restart; CARD/COD/Email/MON/emergency controls preserved,3,237 public assets and next automatic03:30 MON PASS. No provider request or booking. All approval sections below are historical; never replay them.

> **E158,31October2026: PARTIAL DEPLOYMENT.**106 SQL COMMITTED;84e0 CONSUMED_STOP before cutover. Original1e app/PID and active CARD/COD/Email/MON unchanged,0 restart. Use ONLY the NEW recovery approval in the latest section below; earlier84e0 is consumed and cannot be retried.

# Schema106 — inactive PDC booking readiness

31 October2026. **Prepared locally; NOT deployed.** Production remains
`1e931d20d19bde5a` / schema105. Separate exact owner deployment approval is required.
The final seal, expiry and read-only preflight receipt are recorded below.

## Scope

Reuse the completed source `0631cbe972bf9e86ae9572c632e115da685f4e50`,
descended from the installed105 correction `083fc20a91542efd1b10872a18b6cebeb36d734d`.
Main is not the deployed lineage and is not released. No implementation redesign.

One migration: `20261031020000_measured_staff_pdc_booking.sql` (105→106).
It adds nullable measured `actual_weight_kg`, its range check, immutable-dispatch
trigger and service-only measured preparation. Two existing eligibility/dispatch
functions receive the qualified staff CARD/COD and measured-weight guards.
All105 historical migrations remain unchanged; no default/backfill or old-order update.

One exact application archive and **one ordinary application restart** if approved.
Staff must enter actual weight and explicitly confirm. CARD requires verified live
payment and requests COD0. COD requests its full saved outstanding balance in major
EGP units. RBAC, actual packing, one-time dispatch/AWB and uncertain quarantine remain.
No automatic booking, tracking schedule, pickup development or webhook cutover.
The existing narrow staff gate remains as configured; global PDC requests stay OFF.
This deployment approval authorizes no shipment or artificial order.

**Current customer fee observation:** live delivery is50, CARD fee0 and customer COD
fee10. Earlier owner instructions/receipts said COD50. Read-only evidence shows the
current settings were saved29October17:36:50UTC, with Dashboard payment-settings audit
events. They remained unchanged throughout this preparation. No fee change is included;
shipping uses the order's saved total/balance. **OD-20261031-COD-FEE-01:** the owner
confirmed EGP10 is intentional on31October2026. Earlier COD50 instructions are
superseded for future customer charges; existing order snapshots remain unchanged.
No pricing correction is needed. This confirmation grants no deployment, shipment
or provider-action approval. Detailed PDC merchant fees/settlement remain deferred.

Preserve CARD/COD/fees, live customer Email, MON, all orders and original emergency
fences. No Caddy/runtime/key/SMTP/unit changes. Briefly pause the **existing** Email
timer during restart, let any running caller finish naturally, then restore the timer
once in finally. Capture/provider settings stay active; no manual worker request,
Email event, backfill, private delivery test or provider transaction.

## Qualification

- Reused exact-source **90 tests and82 booking browser assertions** (eight EN/AR,
  RTL/LTR, desktop/mobile CARD/COD scenarios); no skipped acceptance invented.
- Fresh PostgreSQL17.11 migration/ROLLBACK:144 original projections preserved,
  exact105 catalog restored. Both changed function baselines match live105 exactly.
- Fresh Node22.23.1 typecheck and release build PASS.
- **22 release guards**:18 root workflow/scope/emergency tests plus4 database guards.
  Includes caller pause/resume on uncertain restart, original budget consumption,
  stable live/saved Email timestamp identity and pre-connection approval/expiry checks.
- Archive unpack/inventory/secrets scan and **3,237 actual HTTP/SHA asset checks PASS**;
  retain3,128 previous versioned assets. Eight missing retained Nitro registry entries
  restored locally; only the compiled serving registry changed in that packaging step.
- Fresh encrypted105 database and14 protected runtime/config/caller/unit files:
  authenticated full decryption, pg_restore readback and exact file-hash checks PASS.
- No production migration/restart, provider request, shipment, manual Email action,
  financial write, order change or Git push during preparation.

Prior pre-COD native fixture and older account tracking-browser failures are retained,
not counted as newly passed. Genuine provider booking/PDF/tracking/callback acceptance
remains unexercised. Commercial fees/settlement/ERP are LAST and never booking blockers.

## Deployment and emergency procedure

Private packet: `../pdc-schema106-release-20261031/`. Its `OPERATOR.md` contains the
exact single-use approve/apply/read-only verify sequence and emergency commands.
Start before its execution deadline. Stage/GET-qualify candidate on105 before SQL,
compare original projections/Auth/history/config inside the migration transaction,
cut over once, poll loopback first, then check public health/assets and the next
**automatic** MON report. Do not force a monitor scan, clear warnings or probe booking.

Stop on drift/expiry/lock/checkpoint/uncertain transport or new MON warnings.
No retry, automatic rollback, repeat migration/restart, blind switch or database restore.
If106 commits before cutover fails, prepare a new sealed recovery. Native ROLLBACK
is pre-commit proof; production recovery must preserve orders arriving after backup.

Stop staff booking immediately on a concern. Original COD-only disable and emergency
purchasing kill are rebound to this archive; each consumes its original budget1.
Original96da Email disable fence is also rebound: halt schedule first, wait without
killing an in-flight caller, then canonical capture/provider disable. No new budgets,
key/sender/history loss or promise to recall already accepted Email. Emergency paths
remain available after seal expiry and do not require a healthy MON report.

## Subsequent independent work

1. SHIP-06: protected Dashboard View/Download/Print, actual PDF and AWB/REF validation,
   duplicate/cross-order denial using existing ExportPDF/private VPS storage.
2. SHIP-08: bounded tracking-only scheduler/limits and verified stored timelines in
   Dashboard/My Account; EN/AR/RTL/owner isolation. Shipment status never proves cash.
3. SHIP-10: documented secret authentication/dedup/replay tests. Live callbacks wait
   for verified provider registration/authentication; polling works independently.
4. SHIP-07/DTR-34: when a genuine eligible order exists, staff approval/actual packing/
   measured weight/recipient/full balance and ONE separate booking approval. Historical
   uncertain dispatch and the cancelled COD order stay excluded. No synthetic tests.

**OD-20261031-PDC-NOWAIT-02:** after independently testable PDC features are complete,
move directly to Google SEO/legacy redirects even with zero eligible genuine orders.
Then historical WooCommerce customers/orders/addresses, then UI/UX. Paymob awaits its
technical reply; detailed settlement/ERP/Daftra remains LAST. No pickup development.

## Fresh sealed approval

**SCHEMA106 RELEASE READY / NOT DEPLOYED.** Read-only preflight PASS at 2026-10-31 02:58:56.932 Riyadh.
Same MON five warnings/zero critical; active CARD/COD/customer Email retained.
No customer-fee write included; current saved COD fee10 remains unchanged.

```text
APPROVE PDC SCHEMA106 INACTIVE BOOKING READINESS DEPLOYMENT 84e0b8cfcc814be128d6afc16be0b204c3f673795badea6fcf648ceb9d50eab5
```

Expires **2026-10-31 06:54:51.714 Riyadh** (2026-10-31T03:54:51.714Z).
Start before **2026-10-31 06:39:51.714 Riyadh** (2026-10-31T03:39:51.714Z).
Approval is single-use; no owner approval or execution recorded during preparation.
Candidate `ce4142a02ffd7afb`; baseline1e/schema105 remains current.
The earlier unapproved b564 preparation seal failed a stale fee50 assertion and is
WITHDRAWN, not an alternative approval. Its archive/evidence remain preserved.

ONE next action: give the exact deployment approval above. Labels, tracking and
webhook qualification follow separately; SEO does not wait for a genuine order.

The unapproved a436 preparation seal is also WITHDRAWN. Final84e0 extends only
the SSH transport window to300s so bounded caller-idle/restart/readiness/cleanup
can finish before transport expiry. Archive/migration/production budgets are unchanged;
final84e0 live preflight PASS02:58:56Riyadh. Never use either superseded seal.

Owner fee confirmation arrived after sealing. The private packet's prep-time pending
wording is historical; `owner-cod-fee-confirmation.json` records the reply separately.
Plan, archive, migration, sealed inputs, approval phrase and expiry are unchanged.
No deployment approval or production action was inferred from this confirmation.

## E158 — committed106 and unused cutover recovery

**Schema106 SQL installed; application cutover BLOCKED pending new approval.**
Original84e0 committed at03:08:10Riyadh and preserved150 original projections, Auth,
history, paid orders, Email settings and quarantine. Candidate ce4142a02ffd7afb
is staged; current1e/source444/PID84134 remains unchanged. No timer pause, switch
or restart intent exists; no booking, PDC request, manual Email or financial action.

My original dispatcher assigned a local `cutover` timestamp in its verify branch.
Python treated that name as local throughout main(), raising UnboundLocalError before
entering cutover. Prior tests called the function directly and missed dispatcher entry.
The original failure is reproduced offline; new recovery uses explicit namespace lookup.
No sealed parent source, application artifact or migration is edited.

**Recovery READY / UNAPPROVED.**15 checks PASS:2 dispatcher regression,9 runtime,
4 schema/Email/COD/quarantine guards. Fresh encrypted106 DB and14 protected files
pass full authenticated readback. New sealed preflight PASS at 2026-10-31 03:18:46.327 Riyadh.
CARD/COD capabilities and payment integrity PASS; next automatic MON after commit
retains five unverified warnings/zero critical/gaps2. Customer COD10 is confirmed.

Exact remaining scope: same existing staged archive, ZERO migrations/SQL/builds/
uploads/config/credential/Caddy changes, ONE remaining ordinary app restart. Briefly
pause existing Email timer, let any in-flight caller finish without killing it and
restore timer once in finally. Capture/provider remain ON. No manual worker or
provider request, automatic PDC activation, old-order backfill or new emergency budget.

```text
APPROVE PDC SCHEMA106 EXISTING CANDIDATE CUTOVER RECOVERY 91cc05acdb536c868a445236bdccdc7451ca855425be116f29e0dc6082ec9bfc
```

Expires **2026-10-31 07:18:02.615 Riyadh** (2026-10-31T04:18:02.615Z).
Execution must start before **2026-10-31 07:03:02.615 Riyadh** (2026-10-31T04:03:02.615Z).

Private packet `../pdc-schema106-cutover-recovery-20261031/OPERATOR.md` contains
approve/apply-once/read-only-verify. It demands exact live106, unchanged old app and
staged inventory/certificate, original stage EXACTLY three files and no prior
cutover/pause/restart intent. A new recovery fence then finalizes only that unused
phase. Original84e0 failure fences remain consumed; never rerun parent apply.
Any drift/expiry/uncertainty stops; no automatic rollback, repeat restart or restore.

Read-only postflight reuses original106 catalog/privacy/CARD/COD/Email/3,237 public
asset checks and next AUTOMATIC MON report. Do not force MON or invoke booking/Email.
The certificate remains bound to84e0, preserving original emergency command bindings
and purchasing/COD/Email disable budgets. No emergency controls were consumed.

ONE next action: approve the new cutover-only recovery above. Labels/tracking/offline
webhook work follows separately, then SEO without waiting for a real order.

## E159 — final deployment receipt

**Schema106 booking-readiness deployment and hosted postflight COMPLETE.**
Current release ce4142a02ffd7afb; source0631cbe972bf9e86ae9572c632e115da685f4e50;
app PID106963, running from the exact candidate inventory/certificate. Original
84e0 SQL commit/failure retained; newly approved91cc finalized only the never-entered
cutover phase at03:25:58Riyadh. Parent certificate84e0 plus recovery91cc provide lineage.

Total: one original106 migration and one app restart. Recovery repeated no SQL,
upload, extraction, build, migration or old apply. Existing Email timer paused
about1.096seconds, in-flight caller never killed, original timer restored once.
Runtime SHA remains unchanged; no Caddy/unit/credential/key/sender/SMTP modification.

Hosted106 catalog/security/owner privacy, CARD/COD/payment integrity and all3,237
public asset HTTP hashes PASS. Existing scheduled Email caller completed after
cutover (last observed Sat 2026-10-31 00:29:13 UTC,exit0); provider/capture/timer remain ON.
Messages/attempts/order-events0; no manual worker or Email test/backfill.
Next AUTOMATIC MON at 2026-10-31T00:30:05.788486+00:00: same five TERMINAL_PAYMENT_UNVERIFIED warnings,
zero critical, gaps2, MON Email false. No scan forced or warning/evidence cleared.

All150 original table projections protected; only live analytics fingerprints differed
across read-only observation windows. CARD/COD/Email/config/quarantine unchanged.
Customer delivery50/COD10(owner-confirmed)/CARD0 retained; historic order totals untouched.
Original emergency fences/budgets remain unspent. No booking, provider request,
pickup, payment/collection/Treasury write, real-order notification probe or Git push.

The original packet's emergency close/cod-disable/email-disable commands now match
the installed candidate certificate and consume only their original fences; see
its unchanged OPERATOR.md. Do not run emergency controls as tests. No automatic
rollback, database restore, repeated restart, queue replay or recall promise.
Both deployment approvals are consumed; future releases/actions need their own scope.

Technical deployment is not owner acceptance of a real shipment. Staff approval,
actual packing/weight/recipient/full EGP balance and ONE real booking seal still
required.0 eligible new candidates; historical uncertain dispatch quarantined and
cancelled COD excluded. Real PDF/tracking/callback acceptance remains deferred.

ONE next action: local SHIP-06 protected labels View/Download/Print and PDF/AWB/REF
qualification, reusing existing ExportPDF/private storage. Then bounded tracking
and offline documented webhook checks. SEO follows independent readiness even
without a real order. No pickup development; Paymob pending; settlement/ERP LAST.
