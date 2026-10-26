# ELcomputer master roadmap

## E62 — offline locations complete locally; safe commits; Beta95 remains next — 2026-10-26

- Owner requested offline workbook review, minimal location selectors/server checks,
 safe local commits and a consolidated deferred-test register. No PDC API/booking/
 activation, production deployment/settings/data change, provider/money action or
 Git push is authorized/performed. Signup OPEN remains E61/current owner report;
 purchasing held. No fresh hosted acceptance or Auth/owner-payment retest here.
- [Location review](pdc-location-reference-review.md): all sheets inspected,
 2×382 same unique cityIDs,27 governorates after aliases, no governorate/zone/area
 IDs or price/coverage evidence. Sheet1 matches381 retained-cache names; cache411
 has30 extras383–412 without parent evidence and lacks366 Others. ID21 English
 conflict resolved from Sheet1/cache; Arabic collision137/146 uses honest English
 fallback while original cells retained. Others366 inactive; do not guess extra IDs.
- Separate16th worktree local/location-reference-20261026 ata9a5c6f148507ffd273937413d2f9704aeadb7ed; source96
 from frozen95b37. Neutral UUIDs and provider mappings separate; OFF by default,
 no seed/activation. Reviewed metadata import/update under existing settings.view/
 settings.edit, preview/hash/revision/idempotent receipt and bounded locks; unknown
 replies retain command, confirmed stale rollback returns to review. Missing rows
 preserved, no parent/provider rebind. No legacy PDC cache/map/tariff mutation.
- EN/AR searchable dependent Gov/City in Profile/Checkout when enabled. Both address
 lines stay editable. Server canonicalization +transactional ID/parent/active checks,
 selected IDs bound in durable intent/new immutable snapshots; old committed
 commands recover after cutover/deactivation, old addresses unchanged. No hardcoded
 checkout city list. Actual UI4 theme/locale/320px/1280 scenarios PASS, native8
 location+7 default transaction regression PASS, typecheck/build PASS. All LOCAL,
 no96 hosted import/customer/provider acceptance. Initial retry failure retained
 and fixed; qualified logs govern. No actual recorded stock or provider request.
- [Status/template review](pdc-status-template-reference-review.md):33 rows/
 32 distinct statusIDs, duplicate97 conflicting descriptions, no transitions applied.
 Templates1/5/6 print layouts understood,3 reverse-only; account binding/units/output
 unaccepted, implementation deferred. Original XLSX bytes/hashes retained outsideGit.
- [Deferred-test register](DEFERRED_TEST_REGISTER.md):32 explicit rows include
 all owner-listed cases plus remaining roadmap acceptance. Each has deferral/risk,
 owner scope, criteria, milestone/status. Deferral is NOT waiver; no unexecuted
 hosted test is PASS. Completed E50/E57/E61/owner payment stay accepted, not repeated.
- [Safe Git review](git-local-commit-review-20261026.md) inventories all161
 opening dirty files across15 original worktrees, zero staged.3b7070d commits the
 2 untouched legacy Auth fixtures on main (syntax-only validation). Location feature
 has its own25-file code commit; current docs committed separately, no merge/rebase/
 reset/deletion/push.135 frozen/consumed historical paths deliberately excluded and
 preserved byte-for-byte, including40 Beta paths,4 failure-replay fixtures,91 other
 continuity files. Source raw XLSX/cache/incident/secrets/build artifacts excluded.
 Main remains91; original95source/17 dirty docs and exact artifacts remain frozen.
- New96 artifact/reference/migration is PRIVATE and requires its OWN future sealed
 release; never swap it into95. Original95 archive81becf54… and migrationfd9c0284…
 unchanged. Reference JSON is reviewed source data; original binaries not committed.
 Current master now90 tasks (89 retained+LOC-01); both handoffs/main/new source sync.
- NEXT P0 returns directly to the original95 guarded deployment/recovery packet
 and ONE scoped new-customer real Paymob acceptance, preserving signup OPEN.
 Do not reopen account housekeeping/history/CAPTCHA tests, PDC incident or STOR-01.
 No executable95 deployment/real-payment/public-purchase approval exists yet: its
 new target-bound operator/recovery and transaction budget still need qualification.
 No new owner approval phrase is issued for an unqualified action.96 remains separate.
 Private evidence ../pdc-location-reference-20261026/; consumed helpers remain consumed.


## E61 — PUBLIC CUSTOMER SIGNUP OPEN; purchasing held — 2026-10-26 21:18:33 Riyadh

- [Activation receipt](public-signup-activation-receipt.md): exactf5e08021
 signup-only approval received, plan hash/target matched, fresh21:16 preflight PASS.
 Owner reports signup ENABLED only. Fresh21:18:33.481 postflight PASS: signupenabled,
 emailconfirmationrequired/emailproviderenabled, same5a/schema94/runtime/process/
 output; EN/ARlogin200,CartCheckout403,anonymoushistory401. PDC paused.
- Approval CONSUMED_COMPLETE. PUBLIC SIGNUP REMAINS OPEN. Do not request this
 approval again, close signup for old disabled-baseline guards, or replay old
 controlled-signup/Turnstile operators. New95 Beta preparation must preserve OPEN
 signup. No new account/email/login/CAPTCHA test; earlier acceptance remains valid.
- Agent0 production/config writes/deploys/restarts/migrations/payments/provider/
 shipment/refund/push; owner1 reported Auth toggle only. Other Auth settings were
 owner-retained; accepted frontend config independently unchanged. New customer
 activity/profiles not enumerated; no claim that fresh customers registered now.
- Owner monitors existing Auth/Brevo quotas/delivery/abuse; emergency close signup
 only on an actual issue, retaining login/recovery and CAPTCHA. Purchases stay
 held. Next P0: guarded95 unrecorded-stock/Manual50 release and one scoped actual
 new-customer order/payment before public purchasing. No authority for those
 operations here. Optional notice/housekeeping/history/UX remain deferred.
- STOR-01 remains AFTER Beta, not started. PDC incident/call pause unchanged.
 Private evidence ../public-signup-activation-20261026-f5e08021/; code b37be43/full95
 still local, production94/main91. Both handoffs/master/current source mirrored,
 Git refs/app/source unchanged; preserve all unique and dirty work, no push.


## E60 — storage architecture audit queued; Beta remains first

STOR-01 / OD-20261026-STORAGE-01 is a targeted READ-ONLY follow-up AFTER the current
public Beta milestone. [Audit scope and conditional migration plan](vps-storage-audit-plan.md).
Supabase PostgreSQL retains records/metadata; actual file bytes belong on VPS.
Six buckets require fresh counts/bytes/activity and code/workflow evidence before
ACTIVE/LEGACY/EMPTY classification. NOT AUDITED now; no production/file/provider
operation. Unused legacy configuration is B/deferable. Any actual private-access
or active-upload defect is isolated separately. No bucket deletion, migration,
permissions change or deployment is authorized. PDC remains paused.

The registry now has89 stable tasks: all prior88 plus STOR-01. E59's88-task
classification is retained, with this new task separately classed B. E59 remains
the launch priority and no existing approval token or consumed operator is changed.

## E59 — minimum public Beta priority; signup can open separately — 2026-10-26

This entry supersedes E58's housekeeping/history/notice launch blockers below.
[Single focused Beta plan and all88 task classifications](public-beta-minimum-launch.md).
[Separate exact signup approval](public-signup-activation-review.md).

- Owner confirms ALL catalog products physically available/can ship without counts;
 owner-managed delivery, all cities/governorates, EGP50. No SKU census/fake inventory
 required. Preserve drafts/unpriced/inactive/coming-soon/test-product exclusions.
 PDC webhook tracking requested and owner reports labels/daily pickups; these are
 not new acceptance or authority for calls, booking or uncertain-incident changes.
 PDC remains technically paused; keep all incident evidence/consumed operators.
- Accepted signup, Turnstile, customer/staff login/recovery, A/B profile/session/logout,
 deployed cart isolation, real Paymob/signed callback and order packing retained.
 DO NOT repeat. Both private browser windows timed out0 Auth/writes and closed;
 no more housekeeping login requests. A marker cleanup/historical empty browser/
 notice deployment and cosmetic success UX are C/DEFERRED, no signup gate.
- Fresh19:34 Riyadh readonly same5a/schema94/runtime/process/output, signupdisabled/
 confirmationrequired/CartCheckout403/history401.0 Auth/emails/writes/providers.
 Public signup is READY for independent owner-operated Auth toggle approval; exact
 hash in review doc. Keep CAPTCHA/Brevo/origins/quotas/users/permissions and purchasing
 holds unchanged. Notice display/private cleanup are not prerequisites. Not activated.
- Critical gap fixed LOCALLY: prior zero-stock payment was awaiting allocation and
 could not pack without recorded units. New95 explicit inventory_tracking_required
 defaulttrue preserves existing contracts; approvedfalse normal CARD orders snapshot
 untracked, no quantity/receipt/unit/movement creation or stock hold. No old order
 rewrite. Normal Add to cart pages omit quantity/backorder labels in this mode.
 Matching SKU/count, paid order, named operator, active session and private video
 still required for packing. Tracked orders keep exact-unit checks. Settings control
 is bilingual/portable; no per-product override/ERP/Dashboard redesign. Missing
 North Sinai added; legacy North Coast retained, no PDC mappings.
- A QA marker now rejected server-side in both address lines at quote/commit. Must
 deploy before real purchase window; no need to edit the profile now. Use a real
 address within the one authorized actual transaction, not another housekeeping test.
- Native15 tests PASS/no skips: public-mode two owners, amount/50fee/ownership and
 foreign404/read/payment-initiation, one order/command, one synthetic intention and
 replayed signed paid confirmation, SKU packing without units, unpaid/wrong actor/
 wrong code/duplicate/video denials, mode snapshot persistence, manual commercial
 closure preserving capture/no phantom stock, plus existing tracked flow preservation.
 Zero external calls/actual money/recording. Initial fixture-only metadata/cast errors
 retained; qualified -3 log governs. Typecheck PASS; build/artifact receipts separate.
- Refund automation/PAY-03 deferred B per owner. Minimum remedy A remains: owner
 proposes direct transfer, which is separate reimbursement, not a Paymob card refund.
 Require verified original transaction/customer agreement/destination/private unique
 operation/evidence/remaining-value and duplicate-compensation review before money;
 preserve captured-payment history and reconcile later reversals/disputes. Native
 commercial status/audit closure verified; NO real reimbursement/refund/void executed
 and NO automatic refund ledger claimed. Full workflow/limits in current Beta plan.
- PUBLIC BETA still BLOCKED on guarded95 deployment/recovery qualification, approved
 exact Manual/mode/delivery config and ONE scoped genuine new-customer order/payment
 acceptance. Existing local A/B plus accepted session isolation avoid a second paid
 order/repeated browser/provider audit. No executable Beta token before sealed
 artifact/target/operator and exact payment budget; one conditional activation plan
 includes emergency close preserving callbacks/owned receipts. Manual15min exception
 monitoring initial, scheduler automation deferred. No public purchasing activation.
- Source b37be43ac6a24a663a12a5a56aaaa7e801827963, local/signup-commerce-next-20261026, full95 from9b; main91/ea113e9
 unchanged.15 worktrees/12 branches retained; no merge/rebase/reset/delete/push.
 Only this unsealed working branch moves for the authorized feature; other heads/
 unique source and both accounts' work remain. Both handoffs/master synchronized.
 Private evidence ../public-beta-minimum-20261026/, no customer secrets in Git.

**Prior dated current-step text below is historical; E59 governs.**

Current private-access step: a FRESH dedicated guarded Chrome window is ready for
owner A's private sign-in, followed automatically by B's private sign-in for the
readonly empty view. The first window expired BEFORE Auth (all counts0), not a
failed login or CAPTCHA test. New live status: ../signup-commerce-next-20261026/
owner-browser-live-status.json; runner session59171, result2/stop2 files. No password
in chat, one A-only restoration, no history claim or other write. Authorization
already exists; owner entry is the only access prerequisite. The prepared script
cleans up its own browser profile after success/timeout. Do not rerun old operators.

## Current focused milestone — 2026-10-26, E58

**Remaining signup gates BLOCKED; hosted A/B purchase readiness BLOCKED.**
[Focused report](signup-commerce-next-milestone.md), [activation review](public-signup-activation-review.md),
[manual purchase/recovery plan](manual-delivery-purchase-acceptance.md). Prior E50/E57
Auth/signup/profile/session/logout acceptance remains COMPLETE; no repeat tests.

OD-20261026-SIGNUP-02: owner clarified imported history requires verified connection;
never say not migrated. Exact owner EN copy +professional AR implemented locally in
existing notice, two app JSON inputs only. Four actual notice/CSS scenes pass
EN/AR/RTL/Light/Dark/320px. Production5a/schema94 notice flagfalse/old copy; no deploy.
A marker still present; dedicated guarded private-signin window timed out0 logins/
profile writes and closed. Owner private sign-in needed for authorized self-edit and
B read-only Orders view. Correct B historical binding has1 eligible UNLINKED profile,
0 current/matching orders. Readonly history payload0 orders/0 profiles/total0, immutable
records/links preserved; browser/order-detail/claim acceptance not inferred. No claim.

OD-20261026-MANUAL-01: next delivery path is a legitimate non-PDC Manual company or
owner driver. PDC entirely PAUSED; no files/lookups/uncertain booking/mapping work.
Only old PDC company currently exists; do not convert/reassign it. Manual provider
already deployed; no new adapter registry/ERP/Dashboard rewrite. Real name/coverage
pending. Existing configurable EGP50 customer-fee policy retained as draft default.
PDC official-mapping work remains under SHIP-02, not a manual-checkout prerequisite.

OD-20261026-STOCK-02: recorded quantity NOT required for CARD payment through the
deployed zero-stock foundation. Live allow_out_of_stock_purchases=true; EN/AR
fulfillment messages BLANK, so approve truthful terms before zero-stock checkout.
Do not invent units/balances/receipts. Only recorded stock is TESTproduct2026 (49),
excluded from genuine acceptance.225 published positive-price products; selected
real SKU/price/sourcing plan pending. Current awaiting-stock/consent/fulfillment
contract retained; full no-hold/no-label normal selling remains separate PROD-05.

12 new automated checks PASS (4 scoped-browser guards,8 native manual CARD checks),
plus4 local notice renders. Native two customers/positive owned orders/foreign404,
ready and zero recorded stock, missing-term refusal, lost-ack/idempotency, one
uncertain payment attempt/no second intention, no phantom cancellation stock/PDC
jobs; no external provider calls. Hosted cart/order/payment/stock business acceptance
NOT claimed. Smallest next purchase milestone: two sequential NO-CHARGE scoped A/B
checkout windows, after carrier/product/terms/private inputs and separate approval.

New source local/signup-commerce-next-20261026 at9b7564f (full94 base51cbeef),15
worktrees/12 branches; all14 opening worktrees/bytes/heads retained except authorized
main continuity edits. Main91 unchanged; no merge/reset/delete/push. Fresh16:47
runtime/source5a/schema94/gates preserved;16:52 readonly history/profile/security/
orders/payment/dispatch preservation PASS. Signup/purchasing disabled/PDC paused.
0 production Auth submissions/emails/profile edits/claims/provider calls/deploys.
No exact activation/purchase approval packet issued while required scopes/inputs
remain unqualified. Auth success screen stays deferred next functional Auth UI;
coupons/broad Dashboard work stay subsequent, no repeated CAPTCHA investigation.

## Completed registration/profile acceptance — E57; preserved

**Scoped registration and hosted profile/session/logout acceptance COMPLETE.**
Owner confirms before-click marker clearing YES and final logout/protected refresh
PASS. Fresh final15:49:45 Riyadh read-only PASS: A/B session0, exact4 verified
ordinary identities/no duplicates, A exact marker ONLY field change. B/all original
profiles/nonactivity credentials/email identities/permissions/business/history
preserved. Same5a/schema94/759 inputs/runtime/process/output. Signup disabled/
confirmation required, CartCheckout403/history401; purchasing held/PDC paused.
008c consumed complete, no test/email/cleanup repeats.0 agent Auth/email/writes.

Genuine new A signup/confirmation/sign-in accepted, one new +one pre-existing B.
Owner browser acceptance and independent SQL/gate proof distinguished. Full positive
hosted cart/checkout/order/recovery cases still HELD; do not infer them from empty
lists or403. Historical owner archived-profile/zero-order view still pending; actual
order-bearing detail requires legitimate authorized customer, no impersonation.

Next: smallest guarded returning-notice visibility/runtime release, then separately
approved public signup activation; no purchasing. Notice flag remainsfalse. Auth
success screen OD-20261026-AUTH-UX-01 deferred next Auth UI update, not a gate.
Preserve accepted CAPTCHA and all current Auth/stock/callback authority.

## Interim qualification history — E56; superseded by E57

**Profile/security preservation PASS. Finish the original final B/logout case.**
Owner's initial5 PASS is qualified by detailed A→B→A description: data updates
correctly on interaction, no mix reported. Before-click clearing/final B logout
not established. Read-only validates same5a/schema94/759 inputs/runtime/process,
4 identities, exact A marker ONLY field change; B/original profiles and nonactivity
credentials/identities/permissions/business/history unchanged. Local optional-
timestamp assertion corrected; original STOP retained. Remaining A session1/B0,
A signin14:33:55 after B14:33:02, consistent with ending A; full postflight not PASS.

[Precise remaining owner step](customer-isolation-continuation.md), already approved:
current A logout→B login ONCE, tab1 observe3sec WITHOUT click/manual refresh, then
B logout and protected Profile refresh in both normal tabs. Report clearing
AUTOMATIC/ONLY AFTER CLICK/NOT CLEARED and final logout PASS/FAIL. No repeat
approval, earlier switching replay, Save/cleanup, email/signup or extra action.
Fresh14:47 closed signup/confirmation-required/CartCheckout403/history401; purchasing
held/PDC paused.0 agent Auth submissions/email/writes. Genuine A signup accepted.
UX success screen remains deferred next Auth update, not an acceptance prerequisite.

## Approved preflight history — E55; superseded by E56

**Exact008c A/B continuation approval RECEIVED; fresh14:15 Riyadh preflight PASS.**
[Current owner test schedule](customer-isolation-continuation.md). Same5a/schema94/
759 app inputs/runtime/process/output, exact4 identities and bound owner A/B verified
active ordinary profiles. Original identity/security/profile/permissions/business/
history intact; A marker not yet saved. Signup disabled/confirmation required,
CartCheckout403/history401; purchasing held/PDC paused.0 agent Auth/email/writes.

Owner NEXT: one dedicated Chrome profile/two normal tabs, A marker save once,
A→B→A→B switching/refresh and final logout. Initial A session reused or one A
login if needed; first A signout doubles as signup-context logout.3 or4 logins/
4 logouts within approved maximums, no extra preparatory logout. No B profile/
credential edits, email/settings/deploy/provider change or repeat approval. Owner
cases NOT EXERCISED yet; read-only postflight after generic results. One genuine
A signup/confirmation/sign-in remains accepted, no second new signup needed.
OD-20261026-AUTH-UX-01 remains next Auth UI update, not an acceptance prerequisite.

## Reconciliation and prepared-continuation history — E54; superseded by E55

**One genuine new signup/confirmation/sign-in ACCEPTED. A/B isolation pending.**
Owner confirms new A is theirs and they already confirmed/signed in; B's email was
already present, now identified as their verified ordinary customer account.
Fresh13:56 Riyadh read-only4 users/profiles/no duplicates, bound A/B verified active
nonstaff own profiles, original3 security/identity/profiles preserved. Signup closed/
confirmation required, CartCheckout403/history401; purchasing held/PDC paused.
0 agent Auth/email/settings/production writes. No second new identity/delivery claimed.

[Concrete A/B continuation](customer-isolation-continuation.md): no signup/email/
settings/deploy needed. Original a2ca allowed only NEW-customer password logins;
existing B substitution is a separate reviewed scope. Proposed maximum4 bound A/B
logins, one new-A-only synthetic address marker, no B profile/credential/permission
edit. Same-profile/two-normal-tab switch/refresh/logout with read-only postflight.
Prepared, NOT APPROVED/EXECUTED. Exact next approval: `APPROVE CUSTOMER A-B ISOLATION CONTINUATION 008cdaecd43b4bcafb47b65ff83a92083d408067a2f8706d7042808098e49007`.
No repeat original approval/window/confirmation, no broader commerce access.
OD-20261026-AUTH-UX-01 stays deferred next Auth UI update, not an acceptance blocker.

## Closure-stop history — E53; superseded by E54

**Signup closure VERIFIED; two-customer acceptance BLOCKED on a real mismatch.**
Owner reports A/B CHECK EMAIL and signupOFF. Fresh13:43 Riyadh settings confirm
signup disabled/email confirmation required. Guard expected5 identities/profiles
(3 old +2 new), found4 (3 old +1 new), with1 new-customer session. Masked read-only
13:44 diagnostic shows the sole new ordinary active nonstaff profile already
confirmed/signed in, wallet0. No duplicate identities or mismatched profile email.
Source/runtime/schema94/history/business/permissions/original3 security+profiles
checks passed before count STOP.0 agent Auth/email/settings/deploy/provider writes.

[Current owner reconciliation steps](customer-registration-acceptance.md). Confirm
whether the sole new masked account is an intended inbox and whether its link/login
was already used; privately inspect the other email's existing-user status/browser.
No links, passwords or full addresses needed. Confirmation/login continuation HELD;
do not submit/resend/reopen/delete/auto-confirm or rerun failed helper. Owner2/2
submissions consumed, global signup closed. Purchasing held/PDC paused. Existing
accepted CAPTCHA unchanged; no cause inferred or provider investigation reopened.

**OD-20261026-AUTH-UX-01** (BETA-03, next Auth UI update): after successful signup
or Forgot Password, hide fields/CAPTCHA; show compact confirmation only. Preserve
EN/AR/RTL/themes/mobile/accessibility and generic messages; zero extra sends/retries.
Deferred; not a prerequisite and no UI implementation/deployment during acceptance.

## Approved preflight history — E52; superseded by E53

Exact owner approval a2ca5a3b RECEIVED; fresh preflight PASS at13:28 Riyadh.
[Current owner-operated steps](customer-registration-acceptance.md). Same5a/schema94/
759 app inputs/runtime/process/output,3 matching old accounts/profiles, business/
history preserved. Signup disabled/confirmation required; purchasing held/PDC paused.
No new Auth/email/settings/deployment/provider action. Signup acceptance NOT EXERCISED.

The two unused owner-controlled inboxes are available. NEXT: owner opens the one
approved global signup window, submits A and B once in separate browser contexts,
then closes signup immediately after both submissions or any failure (max20min).
Report generic results/signupOFF; closure read-only check precedes confirmations.
No new approval needed for this received scope. Permanent public signup/purchasing,
notice visibility, held positive checkout/recovery and real paid orders stay separate.
Preserve accepted CAPTCHA and all prior consumed operators. Private approval,
fresh baseline and receipt in customer-signup-acceptance-preparation-20261026.

## Preparation and inbox-availability history — E51; superseded by E52

Owner requirement **OD-20261026-SIGNUP-01**: genuine registration is next; use two
unused authorized test inboxes, never require the client's info mailbox. Preserve
accepted CAPTCHA and deployed Phase1 isolation; purchasing closed/PDC paused.

[Controlled registration packet](customer-registration-acceptance.md): source
implementation COMPLETE/DEPLOYED; full hosted cart/checkout acceptance HELD/BLOCKED.
Fresh40 local/browser/native checks PASS (29 session,6 provisioning/RLS,5 signup/
redirect); no accepted CAPTCHA/login/recovery test repeated. Fresh13:15:58 Riyadh
production read-only PASS: same5a38201292763325/schema94/759 inputs/runtime/process,
3 matching accounts/profiles/no duplicate identities. Original business/profiles/
history preserved;2 appended dashboard.login audit records plus telemetry qualified
separately. No Auth submission/email, settings/write/restart/deploy/provider/push.

**BETA-03 remains BLOCKED for launch; controlled packet prepared, not approved.**
No application deployment is required for the two-customer signup acceptance.
One owner-operated global signup window (maximum20min, closes immediately after
2 submissions),2 confirmation emails,2 redemptions and at most4 new-customer logins;
no resend/recovery/order/payment/claim. The switch is global, not an email allowlist.
Owner confirms two unused controlled inboxes are available; no addresses shared.
Separate window approval remains pending. Signup closes before email
redemption and remains closed after acceptance. Fresh preflight is required.
Permanent signup/notice visibility and purchasing need separate approval.

Next exact approval: `APPROVE CONTROLLED CUSTOMER SIGNUP ACCEPTANCE a2ca5a3bbc5edf5b63f710ce0f5b9c20446c53e645d7e5e055ee090f2dcb1c39`.
Approval authorizes only this sealed manual test window, not deployment or launch.
Full plan and remaining held cases are in the linked report. Keep all older
operators/approvals consumed; no retries, CAPTCHA investigation or PDC booking.
New isolated branch local/customer-signup-acceptance-20261026, base31ecdd2 (schema94),
test-only commit51cbeef. Main still91. All13 original worktrees/HEADs/dirty bytes
preserved before documentation updates; new14th worktree only. No merges/rebases/
resets/deletions/push. DONE-03 stays DEPLOYED; BETA-05/CX-04 remain BLOCKED.

Authoritative development and continuity index for both Codex accounts.
Last evidence review: **2026-10-26, Asia/Riyadh**.
Latest production evidence: **2026-10-26**, E45 approved frontend runtime
configuration PASS/one app restart, mandatory preservation/postflight and qualified
anonymous EN/AR/Dashboard widgets. E47 owner confirmed Supabase Turnstile enabled;
invalid-token400/captcha_failed/no session verified. E49 customer/staff/recovery
owner acceptance PASS/RECEIVED. E50 missing-token400/captcha_failed closes the
last Auth evidence gap; tested existing-account Auth scope ACCEPTED. Recovery/confirmation acceptance
retains its2026-10-25 date; no email or Management API investigation was repeated.
Other release/acceptance evidence retains its original date and scope.

**Priority: public paid Beta. Production purchasing and registration remain closed.**
Latest recorded production: **`5a38201292763325`, schema94**, code-only notice/
optional Turnstile deployment completed **2026-10-26 02:02:04.416 Riyadh** under consumed
approvale9d1d4bb. [Production receipt](public-signup-deployment-receipt.md).
E41 was one app restart/no SQL/runtime/Caddy/Auth changes. E45 later installed
only2 public CAPTCHA runtime values/one restart. E47 owner enabled Supabase
Turnstile; public signup and purchasing remain closed. Priorbc05eef266eeb7de is retained; its schema94 deployment
and subsequent2026-10-25 23:07:33.882 historical import remain completed evidence.
**AUTH-RECOVER-B-01: ACCEPTED, owner-verified production PASS.** Delivery,
production redirect, password change and subsequent login passed; Site URL and
all four Redirect URLs are saved. Do not repeat this accepted test.
**AUTH-CONFIRM-01: ACCEPTED.** Owner receipt/redemption/account access and
read-only exact-identity confirmation/profile checks pass. No further Auth test
email or configuration investigation is needed. Auth click-tracking suppression
is retained under BETA-03; no SMTP/provider change is authorized.
**Migration source/cutoff/exceptions: APPROVED**, exact seal70e929ee9934b1e04d149266819ef2e3403be2a3cd27c03491803ebf837608d8.
The original packet is preserved; a separate receipt records owner approval.
**BETA-10: DEPLOYED — INACTIVE RELEASE PASS.** Exact replacement approval
4c332350ae6fea14f9dabf1cc0b10d87750f5c2950fcff84b8538b570e1e9650 is consumed.
Migrations92–94 committed atomically; all140 original projections/Auth preserved.
One application restart; Caddy/runtime/media/private files and three current
customers/orders/catalog/signed callback authority preserved. Execution backup,
candidate and post-deploy checks pass. [Deployment receipt](inactive-history-release.md#production-result-and-consumed-approval).
The temporary catalog pause can end. Source/deployment approvals are complete;
never rerun the consumed operator. **HISTORICAL IMPORT PASS:** exact owner approval
3c9f5764901005600c8a3c22900975bdeed9199f277bb8299d2d8b0a771b70ad executed once.
[Import receipt](customer-history-import-receipt.md):41 batches,516 customers,
591 orders/6 refunds/1789 items/702 events.513 conditionally eligible identities,
3 held; actual claims0. All140 original projections and three current users/profiles
preserved. Three required history routes loaded with one Caddy signal; no app
restart/schema deployment. Independent read-only verification and11 live route
checks PASS. Hosted ordinary-owner acceptance remains pending. No new accounts,
passwords, current commerce writes, email, providers, public activation or push.

**BETA-03 latest — E45/E46, 2026-10-26:** exact7b approval executed once,
frontend configuration **DEPLOY PASS** at03:48:38.214862 Riyadh. Public provider/
Site Key installed/root0600/one app restart; same5a38201292763325/source3001cd6/
schema94. No app deployment/SQL/Caddy/Supabase setting change. Fresh execution
12841108-byte DB/10-file runtime encrypted full readback, private candidate,
mandatory preservation/public postflight PASS.30 focused checks retained; all759
app inputs/session isolation unchanged. Qualified real configured widgets PASS:
EN login, AR320px RTL/Dark recovery, actual Dashboard password form. Translated
labels/no overflow/page errors, token boolean only, no Auth submissions/credentials/
server overrides. Inspection locale/selector omissions corrected locally; raw
incomplete proof retained, qualified component proof governs. No production fix.
[Execution receipt](turnstile-runtime-deployment-receipt.md). Both7b PASS/a8 STOP
approvals consumed; never rerun apply or old-baseline checks.
**E50: Turnstile authentication ACCEPTED for the tested scope. BETA-03 launch remains BLOCKED.**
E47 owner enabled Supabase Turnstile; E49 owner customer login PASS, staff Dashboard
login PASS, recovery email RECEIVED, each once/fresh private/no password changes.
E47 invalid-token400/structuredcaptcha_failed/no session qualified. E50 exact7c
approval executed once at11:51:32.836 Riyadh: missing-token400/structuredcaptcha_failed/
no session,1/1 request/no email/settings/key entry/deploy/restart/schema change.
[Completed acceptance receipt](turnstile-auth-acceptance-receipt.md). All five
bounded cases accepted, with owner observations and HTTP evidence distinguished.
Original2f2/2 and separate7c1/1 allowances consumed; no retries/test/email repeats.
Original diagnostic STOP/unqualified400 retained; new qualified response closes gap.
Fresh signup-disabled/confirmation-required/current Site Key and postflight
Cart/Checkout403/history401 checks pass. Same5a/source3001cd6/schema94 and759 app
inputs; no public activation. Genuine new signup/confirmation remains unexercised
while registration is closed; signup SDK wiring has local qualification only.
NEXT separate milestone is the guarded public-signup launch readiness plan and
its bounded owner-controlled registration and historical empty-profile acceptance.
Public signup/purchasing remain disabled until separately approved launch; PDC
paused. No executable activation phrase or historical order-detail acceptance.
All88 task IDs/statuses and13 worktrees/10 branches retained; no push.

**BETA-03 earlier code update — 2026-10-26:** one replacement application-only notice plus
optional Turnstile release is **DEPLOYED INACTIVE**, approved once under E41.
[Release and readiness](public-signup-release.md)
records28 focused tests,33 current session/checkout/Paymob checks (including local
A/B browsers), unchanged native94 concurrency proof, six release guards and
exact-archive15 scenarios/36 screenshots/1640 asset checks. Official Cloudflare
dummy widgets feed tokens through the actual SDK for customer signup/login/reset
and Dashboard login; zero hosted Supabase/email/payment/shipping calls. Runtime
notice/CAPTCHA defaults remain off; schema94 and all current Beta contracts stay.
Deployment approvale9d1d4bb is consumed; public signup activation remains BLOCKED
on real widget/key binding and hosted acceptance. The superseded notice-only
packet is held, unapproved and unexecuted. Existing verified historical match is
the owner's accepted-recovery ordinary account, with zero orders; owner profile/
empty-history result is pending. No real customer may be used or impersonated
without authorization. Management API403 is no longer a readiness dependency.
Owner-verified limits:30 Auth emails/hour,60 seconds/address,30 signup/sign-in and
30 verification requests/5 minutes/IP; CAPTCHA none/disabled, leaked-password
protection disabled. Retain30/hour initially; verify real demand and Brevo headroom
before any separately reviewed increase. **OD-20261026-AUTH-01** preserves accepted
Brevo/confirmation/recovery and requires frontend support before CAPTCHA enablement.
This milestone deployed only the approved application. No public activation,
account creation/password/claim/email/provider transaction or Git push ran.
Preparation E40 is historical; execution/consumption is E41 and the current
configuration completed at E45; next manual Auth acceptance is E46.

Current owner priority: **A inactive deployment → B historical import/verified
ownership → C public signup/login → D PDC/paid-checkout acceptance → E public
purchasing.** Existing customer login/recovery stays available. The small EN/AR returning notice/optional Turnstile release is deployed
inactive beforeC; the consumed91→94 archive remains unchanged. [Requirements, copy and pending-work inventory](customer-access-release-plan.md)
extend existing tasks. Email acceptance is complete; no repeated investigation.

**Latest owner decisions:** all ten additional workstreams are **POST-BETA**.
They do not gate public signup or paid checkout. Stock-selling controls are first
among post-Beta work; unrestricted selling is independent of backorders. Zero
recorded stock must not itself produce stock quantities, availability claims or
special-order labels under the new policy. Current code/settings remain unchanged.
See [the ten requirements](#l1-ten-owner-requirements--post-beta) and
[Git handover audit](GIT_WORKTREE_SYNC_AUDIT.md). The2026-10-25 requirements/audit milestone was documentation and local read-only
inspection only. The dated E40 entry records the subsequent bounded signup work.

**88 tracked tasks: all original79 retained, plus9 new stable IDs.**
Priority: P0 29; P1 40; P2 18; PARKED 1.
Status: PLANNED 39; IN PROGRESS 0; LOCAL PASS 6; DEPLOYED 23;
ACCEPTED 4; BLOCKED 12; ON HOLD 4. Count each task row once;
dependent tasks can cover different acceptance stages of the same feature.

Navigate: [overview](#a-project-overview), [production](#b-current-production-baseline),
[deployed](#c-completed-and-deployed-features), [local](#d-implemented-locally-but-not-deployed),
[Beta](#e-current-top-priority--public-paid-beta-launch),
[migration](#f-wordpress--woocommerce-migration), [payments](#g-payment-gateways),
[products](#h-products-inventory-and-backorders), [shipping](#i-shipping-companies-and-pdc),
[orders](#j-orders-and-fulfillment), [checkout](#k-checkout-and-customer-experience),
[future](#l-future-features-and-retained-unfinished-commitments),
[ten owner requirements](#l1-ten-owner-requirements--post-beta),
[blockers](#m-risks-and-blockers), [next action](#n-next-exact-action),
[history](#o-change-history-and-evidence-preservation).


### E59 priority requirements — current

- OD-20261026-BETA-01: smallest safe Beta; classify88 tasks A/B/C. Accepted tests
 stay accepted. Defer housekeeping/empty-history/cosmetics, preserve QA marker guard.
- OD-20261026-STOCK-03: owner confirms all catalog physically available. Promote
 global normal sell-without-recorded-stock/labels/holds to current95 release. Full
 per-product policy remains subsequent; no invented counts or automatic publishing.
- OD-20261026-DELIVERY-02: owner-managed all cities/governorates, temporary50 EGP;
 no PDC dependency. Final delivery copy approved with exact release configuration.
- OD-20261026-REFUND-02: owner defers automated refunds, offers direct transfers.
 Record separate manual reimbursement/consent/evidence/reconciliation; never claim
 Paymob reversal or automatic refund. Basic repayment/remedy cannot be omitted.
- OD-20261026-TRACK-01: PDC webhook tracking requested; owner reports labels/daily
 pickups. Preserve incident and call pause; no provider authority inferred.

## How to use and maintain this roadmap

- Read this file, [AGENTS](../AGENTS.md), [PROJECT_STATE](../PROJECT_STATE.md)
  and [CODEX_HANDOFF](../CODEX_HANDOFF.md) before substantial development.
- Record new requirements immediately. Assign stable IDs; never reuse deleted IDs.
- Reprioritize without removing unfinished requirements. Preserve superseded decisions.
- Update status, evidence, blockers and next action explicitly after work.
- At each completed milestone, update this file and both handoffs together.
- Preserve both accounts' branches, worktrees, uncommitted files and incident evidence.
- Resolve contradictory statements by dated execution evidence and actual source.
  A plan, approval or local test does not establish deployment or acceptance.
- Keep detailed technical logs in their existing documents or private evidence.
  Never include credentials, personal customer data or sensitive incident payloads.
- Production SQL, settings, external sends, provider transactions and deployments
  require their separately reviewed scope and approval. This roadmap authorizes none.
- Do not push Git or rerun consumed operators from historical documentation.
- This file does not update itself. Every future Codex handoff must update it.

Task fields below are mandatory. The **Verified** column dates the file/source
review, not a fresh production or provider test. Every date here uses YYYY-MM-DD.
Section M references existing IDs; it does not create duplicate tasks.

| Status | Meaning |
| --- | --- |
| PLANNED | Requirement retained; qualified implementation not established. |
| IN PROGRESS | Work started; its required checks remain incomplete. |
| LOCAL PASS | Specified local checks passed; no production acceptance implied. |
| DEPLOYED | Retained execution evidence establishes deployment; acceptance may remain. |
| ACCEPTED | Explicitly identified owner/provider acceptance exists for that bounded scope. |
| BLOCKED | Named prerequisite prevents this task's acceptance or execution. |
| ON HOLD | Deliberately deferred; requirement and resumption condition remain. |

P0 blocks paid public Beta. P1 follows Beta or supplies an agreed near-term
capability. P2 is later improvement. PARKED requires a new scope decision.

### Evidence locators and cross-account reconciliation

The original checkout is `main` at `ae2f6df9d059a07b7aa24aa67f10a315d3bb721e`.
It was clean before this documentation task. Its opening handoffs and README
describe an older deployment. They must not override the later receipts below.

**R** means retained Git commit
`644066973cc6eea43cc18e1307f861e0c57eccc2` on
`local/owner-checkout-city-followup-20261023`.
Recover a referenced document with `git show <R>:docs/<name>.md`.
R contains later work from both accounts; it is not a claim that every R byte
was deployed. The exact release archive and source bindings govern deployment.

**W** means the existing, dirty isolated worktree
`../beta-launch-preparation-20261024/source`, relative to repository root.
**P** means the private sibling evidence directories, also relative to root.
W files are not committed in main or R. Preserve them; review consolidation
explicitly rather than merging, replacing files or rebuilding incidentally.

**H** is `local/customer-history-launch-20261025`, qualified implementation
`1924ca06b2bf97426aba108f6da36cb7b7bd1287`, isolated under
`../customer-migration-launch-20261025/source`. Its2cd5418 baseline preserves W
exactly; the new history source extends it. H has94 migration files and local
qualification. Its application bytes are now deployed through E35; main application is unchanged.
Requirements and qualified results are summarized here so they survive a handoff.
Private receipts are evidence locators, not portable release inputs or approval.

| Key | Evidence source and bounded meaning |
| --- | --- |
| REQ | Owner's master-roadmap requirements, recorded in this file on 2026-10-25. New requirements are requirements, not completion evidence. |
| E01 | R:`docs/customer-session-consolidated-release.md`; P:`customer-session-consolidated-20261024/DEPLOYMENT-RECEIPT.json`, `hosted-public-acceptance.json`. Final deployment notice supersedes the older preparation text in that document. |
| E02 | R:`docs/first-real-payment-pdc-readiness.md`, `docs/owner-checkout-egp2-active-receipt.md`; signed-callback code and durable ledger evidence. Owner-reported 3DS; no independent raw-signature replay or bank-settlement proof. |
| E03 | R:`docs/pdc-http-client-compatibility.md`, `docs/pdc-http-client-release.md`, `docs/pdc-static-booking-acceptance.md`; P:`pdc-client-fix-release-20261024/DEPLOYMENT-RECEIPT.json`. Static booking and client deployment are separate events. |
| E04 | R:`docs/pdc-webhook-readiness.md`, `docs/pdc-webhook-ingress-recovery.md`, `docs/pdc-webhook-status-comparison.csv`; P:`pdc-webhook-readiness-20261024/SIGNAL-EXECUTION-RECEIPT.json`. Ingress security only; no authenticated provider cutover. |
| E05 | R:`docs/customer-session-isolation.md`, `docs/customer-session-hosted-acceptance.md`; W:`docs/beta-launch-candidate.md` has the later two-account observation. Earlier one-account statements are historical. |
| E06 | W:`docs/beta-launch-candidate.md`, `docs/beta-refund-operations.md`; P:`beta-launch-preparation-20261024/validation.json`, `REVIEW-MANIFEST.json`, `source-review-inputs.json`, `CURRENT-CANDIDATE.json`. Local candidate only. |
| E07 | W:`supabase/migrations/20261024150000_card_backorders.sql` (92), `20261024160000_unpaid_card_stock_release.sql` (93), `server/utils/betaPurchase.js`, `app/utils/backorder.js`. Actual local source inspected. |
| E08 | R:`docs/public-commerce-readiness.md`, `docs/pdc-dynamic-dashboard-test.md`, `docs/pdc-v6-integration-review.md`. Historical assessments; later E03/E05/E06 supersede their old blockers selectively. |
| E09 | [Tariff deployment](shipping-tariff-deployment-receipt.md), [tariff contract](shipping-tariffs.md), [owner draft package](operations/shipping-tariffs/README.md). Manager deployed; business draft remains unverified/inactive. |
| E10 | [Modular payment/shipping](modular-payment-shipping-plan.md), [Paymob](paymob.md), [provider configuration](provider-configuration.md). Future architecture and current boundaries; old baseline paragraphs are historical. |
| E11 | [WordPress customer migration](wordpress-customer-migration.md); E06 updates Beta sequencing only. Archive remains read-only. |
| E12 | [Product save](product-save-safety.md), [editor](product-editor-safety.md), [listing](product-listing.md), [bulk](product-bulk-operations.md), [transfer](catalog-transfer.md), [import](catalog-import.md), [media](media-safety.md). Preserve these contracts. |
| E13 | [Commerce foundation receipt](commerce-foundation-release-receipt.md), [packing videos](private-packing-videos.md), [packing authorization](packing-scan-authorization.md), [COD collections](cod-collections.md), [camera](packing-camera.md). Implementation/deployment and authentic workflow acceptance differ. |
| E14 | [SEO](seo.md), [AI discovery](ai-readiness.md), [localization](ui-localization.md), [brand report](brand-pages-report.md), [navigation report](navigation-localization-report.md), historical handoffs. |
| E15 | [Account entry receipt](customer-account-entry-release-receipt.md), [profile access receipt](account-profile-access-receipt.md), E01/E05 and source account components. |
| E16 | [Premium PDP release](premium-product-release.md), [finishing receipt](premium-product-finishing-deployment-receipt.md), [Modern Footer refinement](modern-footer-refinement-release.md). Hosted owner acceptance remains separate. |
| E17 | [After-sales audit](after-sales-final-audit.md), [warranty](warranty.md), [reverse logistics](after-sales-reverse-logistics.md), [communications](after-sales-communications.md). Dormant controls and partial acceptance are preserved. |
| E18 | [Email foundation](email-foundation.md), [SMS report](sms-report.md), [order SMS](order-sms.md), [PDC SMS](pdc-sms.md), E06's later email inspection. Auth SMTP is separate. |
| E19 | [Quick Setup](quick-setup.md), [publisher validation](application-publication-validation.md), [release82 validation](installation-release82-validation.md), [reproducible builds](dependency-reproducibility.md). Local installation certification is not portable hosted acceptance. |
| E20 | [ERP report](erp-ownership-report.md), [Daftra](daftra-erp.md), [procurement options](procurement-product-options.md), [Dashboard navigation](dashboard-navigation.md), [read ingress](dashboard-read-ingress.md). |
| E21 | [Dashboard production check](dashboard-read-production-check.md), historical PROJECT_STATE/CODEX_HANDOFF ADM-01 entries, [product bulk release](product-bulk-release.md). Functional smoke does not establish full RBAC/browser-write-safety acceptance. |
| E22 | [Auth email acceptance](auth-email-acceptance.md), 2026-10-25. Historical read-only/configuration receipts and first failed localhost redirect. E25 supersedes pending-save/recovery status. Earlier403 never proved SMTP failure; no new SMTP investigation is required. |
| E23 | [Customer migration release](customer-migration-release.md); branch `local/customer-history-launch-20261025`, qualified Beta baseline2cd5418; P:`customer-migration-launch-20261025/` encrypted sources/target/dry-run/exception records, SQL rehearsal and20 focused checks. History source is local only; no production import. |
| E24 | [Auth redirect/PKCE review](auth-email-acceptance.md#current-redirect-correction--2026-10-25); R:`tests/auth-redirect-flow.test.mjs`, `tests/auth-page.test.mjs`:7 focused checks PASS using the actual login SFC and installed SDK against closed synthetic Auth transport. EN/AR callbacks, automatic exchange and recovery form verified locally; no application change or hosted acceptance. |
| E25 | Owner's2026-10-25 production PASS: Test B recovery email from verified sender, correct production reset redirect, password changed and new-password login succeeded. Site URL/four Redirect URLs saved. AUTH-RECOVER-B-01 ACCEPTED; scoped owner evidence, not an independent log review. P:`auth-email-acceptance-20261025/recovery-b-owner-acceptance-20261025.json`. |
| E26 | [Current confirmation plan](auth-email-acceptance.md#auth-confirm-01--one-controlled-confirmation-test); P:`auth-email-acceptance-20261025/confirmation-01-plan.private.json`, disabled browser artifact. Exact new mailbox selected; no identity/send approval yet. R:`scripts/auth-email-acceptance/confirmation-browser.mjs`; ten focused local checks PASS, including installed SDK resend/PKCE/duplicate guards. No hosted confirmation, account creation or app deployment. |
| E27 | [Approved confirmation request](auth-email-acceptance.md#current-confirmation-request--one-send-accepted-owner-pending--2026-10-25). Owner approved one identity/one signup email. Auth/profile and both offline sources had zero mailbox conflicts. Supported Admin API created one unconfirmed ordinary identity; separate signed-out headed Chrome made one genuine signup-confirmation/PKCE request, accepted with confirmation timestamp/no invitation. Existing identity/profile/settings/transaction fingerprints unchanged. Private receipts in `auth-email-acceptance-20261025/`; scopes consumed, owner receipt/redemption pending. |
| E28 | [Confirmation ACCEPTED](auth-email-acceptance.md#confirmation-accepted--read-only-verified--2026-10-25). Owner receipt/redemption/access; fresh read-only exact UUID confirmed, email identity/profile match, active permanent non-admin and sign-in timestamp. Other settings/admin/commerce fingerprints unchanged. P:`auth-email-acceptance-20261025/confirmation-01-acceptance.private.json`. Owner observed sendibt3.com/tr/cl wrapping; Auth-only tracking/OTP follow-up retained, not implemented. |
| E29 | [Migration approval packet](customer-migration-approval.md); P:`customer-migration-launch-20261025/migration-source-approval-packet-20261025.json`, refreshed encrypted target/reviewv3. Three confirmed current users, schema91/history absent; payload/counts unchanged. Reverified12 source hashes,31 evidence files and91 old migrations; reuse20 passing checks/build. Source approval seal70e929ee9934b1e04d149266819ef2e3403be2a3cd27c03491803ebf837608d8; no deployment/import authorization. |
| E30 | Exact owner `APPROVE MIGRATION SOURCE` message recorded in P:`customer-migration-launch-20261025/migration-source-approval.receipt.json`; original E29 packet/template unchanged. P:`migration-inactive-release-inputs-20261025.json` freezes663 application inputs/all94 migration hashes and pending92–94. INPUTS_FROZEN_NOT_DEPLOYABLE; claims0, no deployment/import authority, no production operation. |
| E31 | [Inactive91→94 release packet](inactive-history-release.md); P:`customer-migration-inactive-release-20261025/plan.json`, seal6474587b004ab0a5ac9d55e04e55f1e57a73760ced15b4dd26f3314a353a801d. Archivebc05eef266eeb7de; operator724720a; app1924ca0 unchanged. Eight new operator checks/build/exact archive15 HTTP/1534 assets/8 browser checks pass; reuse69 Beta/20 history/typecheck. Fresh encrypted backup authenticated/read back; native application/Auth/Storage restore and actual91→94/rollback/replay refusal pass; zero-row managed Vault excluded locally only. Saved-plan READ_ONLY_CHECK_PASS, production writes0. No deployment/import/push or public activation. |
| E32 | [Owner customer-access requirements and release inventory](customer-access-release-plan.md): original registered email via verified signup/recovery, no incompatible hash import/current-identity overwrite, ordinary My Orders ownership claim, EN/AR returning notice/generic failed-login guidance. Notice is PLANNED as the next small release before public signup; sealed E31 archive unchanged. All seven worktrees/five local branches inventoried;40 original Beta paths byte-match2cd5418, four historical diagnostic paths excluded. P:`owner-requirements-inventory-before.json` and `owner-requirements-read-only-check.log` in inactive release workspace. No production mutation. |
| E33 | Exact owner deployment approval6474587 recorded in E31 private `DEPLOYMENT-APPROVAL.receipt.json`; final read-only comparison STOP on new catalog/audit data, before intent/apply. `DEPLOYMENT-HELD.receipt.json` and diagnostics preserve the boundary. P:`customer-migration-inactive-refresh-20261025/`: same archive/app/operator, first refreshed backup/native proof passed; its then-unsealed status is retained under `pre-pause-evidence/REFRESH-STATUS.json`. Six catalog/audit tables changed; schema/runtime/Auth/other business projections matched. Eighth detached worktree is a replacement packet, not new feature work. E34 supersedes the pending-pause status; source approval unchanged. |
| E34 | Owner pause confirmed in P:`customer-migration-inactive-refresh-20261025/CATALOG-PAUSE.receipt.json`; final paused observation found45 fewer spec rows/45 more audit rows since E33 backup, other protected state unchanged. New encrypted DB/runtime backup authenticated/full-readback PASS; native restore/91→94/rollback/replay refusal PASS, history/claims0. Same archive/app/operator, replacement `plan.json` sealed4c332350ae6fea14f9dabf1cc0b10d87750f5c2950fcff84b8538b570e1e9650; checked() read-only PASS and saved local integrity PASS. Current freshness ends2026-10-26 02:16:59.697 Riyadh. Old unsealed refresh retained under `pre-pause-evidence/`; approval template false/no intent/apply. E33 pause/qualification hold resolved; exact replacement approval next. |
| E35 | [Inactive deployment result](inactive-history-release.md#production-result-and-consumed-approval); P:`customer-migration-inactive-refresh-20261025/DEPLOYMENT-RECEIPT.json`, consumed4c332350. Deployedbc05eef266eeb7de/schema94 at21:31:49.255 Riyadh: atomic92–94,140 original projections/Auth PASS, three current customers and original commerce/catalog preserved, history/claims0, one restart. Fresh execution backup authenticated/full readback (10935391 DB bytes/10 runtime files), candidate/RLS/service RPC/gates PASS. Public9 HTTP/6 exact asset checks PASS; anonymous history/capabilities403 is denial only, owned access NOT EXERCISED. Current-schema prepared41-batch import check PASS read-only. No historical import, signup/purchase/provider activation, email or push; catalog pause may end. |
| E36 | [Final guarded history import](customer-history-final-import.md); P:`customer-history-final-import-20261025/final-import-plan.json`, seal3c9f5764901005600c8a3c22900975bdeed9199f277bb8299d2d8b0a771b70ad; operator de5c414. Final516 customers/591 orders/6 refunds/1789 items/702 events,513 conditionally eligible (1 current verified/512 later signup),3 held;465 eligible/1 held/131 unlinked order-refund records. Fresh exported-snapshot backup/full readback and actual native94 restore/final41 batches PASS,140 original projections preserved; EN/AR ordinary component/ownership/receipt/immutability/source-hide checks PASS; seven operator tests PASS;663 application inputs unchanged. Three exact history routes needed: one-line Caddy proposal/parser/diff and154 offline predicates PASS, not applied. Seal live read-only check PASS; false template/no approval receipt/intent/import/routing writes. Recovery expires2026-10-26 04:23:51.699 Riyadh. Hosted owned access pending. |
| E37 | [Production history import receipt](customer-history-import-receipt.md); P:`customer-history-final-import-20261025/IMPORT-RECEIPT.json`, `execution/completed.json`, `POST-IMPORT-VERIFICATION.json`. Exact owner3c9f5764 approval executed once23:07:33.882 Riyadh;41 durable batches,516 customers/591 orders/6 refunds/1789 items/702 events,513 conditional identities/3 held, claims0. Fresh execution encrypted backup/full readback PASS (11043268 DB bytes/10 runtime files); all140 original projections preserved per batch and unchanged independently after import; three confirmed users/profiles intact. Every immutable record/eligibility flag matches. Exact three-route Caddy change loaded with one journal-confirmed SIGUSR1/same PIDs/0 app restart; other runtime files and signed callbacks unchanged. Independent11 live route checks/Auth settings PASS, signup/purchasing/provider initiation closed. No Auth/password/current-commerce/notification/provider/push action. Seal consumed; hosted ordinary-owner acceptance pending. |
| E38 | Owner's ten post-Beta requirements, recorded in section L1 on2026-10-25. New decision OD-20261025-STOCK-01 separates stock-independent selling from special orders/backorders, superseding automatic zero-stock labels as future policy. Source inspection only: deployed-source table listing, legacy Supabase chat/Documents file adapters, private VPS packing paths, navigation/Overview and ERP/SEO foundations. No feature test, provider/Google access, implementation or activation claimed. Nine new task IDs; ORDER-02/MIG-04 and relevant umbrella tasks updated; original79 retained. |
| E39 | [Complete Git/worktree handover audit](GIT_WORKTREE_SYNC_AUDIT.md); P:`roadmap-git-audit-20261025/git-inventory-before.private.json`, lineage checks and final completion receipt. Nine worktrees/six local branches; cached origin only/no fetch. Main has91 migration files; deployed source has94. Four feature commits absent cached remotes plus one unique detached context; Beta40 paths equal2cd5418/all663 frozen app inputs match. Documentation-only commit records current release/import/requirements/audit; two unrelated main Auth source files remain untracked, other dirty worktrees preserved. No merge/rebase/cherry-pick/switch/cleanup/push or production access. |
| E40 | [Public signup release/readiness](public-signup-release.md); P:`public-signup-turnstile-preparation-20261026/`. Source3001cd6 descends34167fe/574bb86/de5c414; eight app inputs, default-off returning notice/Turnstile on customer and Dashboard Auth, no schema/commerce changes.28 focused/33 current security-session checks/6 release guards/native94 retained PASS; exact archive5a38201292763325,15 scenarios/36 screenshots/1640 asset bytes;44 official public dummy-widget requests,0 hosted Supabase/emails/payment/shipping. Owner verified30 Auth emails/hour/60s and30-per5min/IP limits; CAPTCHA/leaked-password protection disabled. Verified existing ordinary match equals accepted owner recovery identity, zero orders; no claim/customer impersonation. Fresh encrypted recovery/full readback (12818743 DB bytes/10 files), seale9d1d4bb798919e79aa5a70641801f1f99a1e3cd4623e35a4f923df7598988b0 and independent read-only check PASS; recovery expires2026-10-26 07:05:19 Riyadh. Initial analytics/internal-ledger drift preparation stopped before sealing; fresh review-2 uses established telemetry/Auth activity rules while binding ledgers/identity/commerce/history. First notice-only packet held/unapproved; both new worktrees preserve originals,11 total. Deployment and activation remain separately approved; no production/Git push. |
| E41 | [Signup notice/optional Turnstile deployment receipt](public-signup-deployment-receipt.md); P:`public-signup-turnstile-preparation-20261026/review-2/DEPLOYMENT-RECEIPT.json`, `APPROVAL-STATUS.json`, `execution/completed.json`. Exact ownere9d1d4bb approval executed once, completed2026-10-26 02:02:04.416 Riyadh; release5a38201292763325/source3001cd6/schema94,0 SQL/1 app restart. Fresh exact read-only preflight, execution encrypted DB12822782 bytes/10 runtime full readback, private candidate, installed output/1533 retained assets, schema/Auth/business/history/ownership and5 public route postflights PASS. Caddy/runtime/media/private files/credentials/signed callbacks unchanged; signup/notice/CAPTCHA config/purchasing/provider initiation closed. No Auth/password/claim/email/provider/worker/import or push. Scope consumed; real configuration and hosted acceptance still separately approved. |
| E42 | [Turnstile frontend configuration](turnstile-runtime-configuration.md); P:`turnstile-runtime-preparation-20261026/plan.json`, `validation.json`, `live-tab-preview.json`, `application-identity.json`, encrypted recovery/full readback. Owner public key/Managed/canonical hostname confirmed; actual deployed-origin anonymous widget PASS (6 Cloudflare requests/token boolean/0 Auth submissions),29 fresh focused checks PASS,759 app inputs identical to consumed3001cd6 incl session isolation. Local owner-observed failed preview/screenshot timeout retained; no error cause established. New operator9d6508c, frontend-only2 public env values/1 restart; seala8aec16a72d59972812a459c00b3e7b1029c6ebe8257e60e3ef642b03ce66c67, approval pending/no intent. Sealing and independent read-only checks PASS; encrypted12835600-byte DB/10 runtime files full readback, verified03:24:22.724 Riyadh/expires09:24:22.724. No production mutation, Secret Key, Supabase setting, Auth submission/account/email/claim/provider or push. Enforcement/hosted Auth/signup remain separate. Original11 worktrees/79 opening dirty paths preserved; one isolated addition gives12 worktrees/9 branches; main91/source94. |
| E43 | [Turnstile STOP receipt](turnstile-runtime-stop-receipt.md); P:`turnstile-runtime-preparation-20261026/OWNER-FRONTEND-CONFIG-APPROVAL.json`, `execution-intent.json`, `execution/STOP.json`, `FRONTEND-CONFIG-STOP-RECEIPT.json`, `STOP-READONLY-VERIFICATION.json`. Exact ownera8 approval executed once/exit1/CONSUMED_STOPPED; initial preflight PASS, intent03:32:23.528 Riyadh, encrypted12839012-byte DB full readback PASS, runtime recovery source returned KeyError before tar output (archive_bytes omitted in sealed apply). No staging/candidate/runtime write/restart; independent03:36:32.931 pinned read-only proof: same release/process/runtime/Caddy/output/media/private files/schema94/protected DB/Auth/history/ownership,0 production mutations. Public CAPTCHA values empty; signup/purchasing/provider holds retained. Preserve all sealed inputs/failed artifacts; never rerun apply/check or auto rollback. |
| E44 | [Replacement frontend packet](turnstile-runtime-configuration.md); P:`turnstile-runtime-recovery-fix-20261026/plan.json`, `validation.json`, `application-identity.json`, encrypted recovery/full readback. Isolated31ecdd2 corrects shared read-only backup input archive_bytes:0; actual shared Python capacity regression plus focused23 JS/7 Python PASS.759 deployed app inputs unchanged incl session isolation,94 migrations, old widget/artifact evidence reused. New seal7b9038186919a03ca16138845e90642dffdc53a49cd0eaa303654fdc9a413f15 ready/pending/no intent; same2 public values/1 restart scope, no enforcement/signup/purchasing/PDC/schema/Caddy/app deployment. Sealing and independent read-only checks PASS; fresh12839997-byte DB/10 runtime files full readback verified03:40:02.140 Riyadh/expires09:40:02.140. Original12 worktrees/source preserved;13 worktrees/10 branches, no push. Not a retry or activation. |
| E45 | [Frontend runtime deployment](turnstile-runtime-deployment-receipt.md); P:`turnstile-runtime-recovery-fix-20261026/FRONTEND-CONFIG-RECEIPT.json`, `APPROVAL-STATUS.json`, `execution/completed.json`, `configured-frontend-acceptance.json`. Exact owner7b approval executed once/exit0/CONSUMED_COMPLETE, receipt03:48:38.214862 Riyadh; ONLY2 public runtime values/root0600/1 app restart, same5a/source3001cd6/schema94. Fresh encrypted12841108-byte DB/10-file runtime full readback, private candidate, mandatory runtime/schema/Auth/business/history/ownership/public postflight PASS.30 focused checks/reused qualification;759 app inputs unchanged incl session isolation. EN login/AR320 RTL Dark recovery/Dashboard password form qualified real-widget tokens/translated labels/no overflow/errors; initial helper locale/selector omissions retained and excluded from full acceptance.0 Auth submissions/emails/secret/Supabase settings/account/password/claim/payment/shipping/push. Public signup/purchases/providers/notice held; CAPTCHA frontend active/backend enforcement off. Do not rerun consumed apply/check. |
| E46 | [Manual Supabase enforcement acceptance plan](turnstile-auth-acceptance-plan.md); P:`turnstile-runtime-recovery-fix-20261026/auth-enforcement-acceptance-plan.json`, `AUTH-ENFORCEMENT-APPROVAL-STATUS.json`. Prepared only, seal2f716d6351e8dc638817af08f2776792796fd79fef66b8c933174d074ed67f34 binds completed E45 frontend/qualified proofs. Owner enters secret/provider/enables directly in Supabase only after separate exact approval and fresh closed-gate recheck; no automation/Management API403. Max2 anonymous no-email negative password Auth requests after owner confirmation, existing owner customer/staff positive logins/max1 recovery email/no redemption/password change. Owner may disable newly enabled CAPTCHA once on legitimate lockout, stop/review; no automatic retry/rollback. Signup/purchases/PDC/new users/claims/runtime/schema/SMTP/quota/providers/push excluded. No settings, secret or Auth request performed. |
| E47 | [Auth acceptance progress](turnstile-auth-acceptance-receipt.md); P:`turnstile-runtime-recovery-fix-20261026/OWNER-AUTH-ENFORCEMENT-APPROVAL.json`, `OWNER-CAPTCHA-CONFIGURATION-CONFIRMATION.json`, fresh read-only preflights, `AUTH-ENFORCEMENT-NEGATIVE-RECEIPT.json`. Owner exact2f approval received/CAPTCHA enabled confirmation. Same app/runtime/schema94/759 inputs/protected schema/Auth/history/ownership and closed gates preflight PASS.2/2 anonymous negative password requests: missing400/no session/reason not retained; invalid400/captcha_failed/no session qualified. Diagnostic omitted API-version header that installed SDK sends; original helper STOP preserved, local native-SDK/error/public-key tests PASS, unused distinct invalid case executed once after review, no first retry/helper rerun.3 guard+4 contract tests PASS. Agent sessions/emails/settings/ManagementAPI0, Secret never received. Positive owner customer/staff/recovery results PENDING; missing-token cause unqualified/recheck requires separate request authorization. Signup/purchases/PDC held. |
| E48 | [One missing-token recheck proposal](turnstile-missing-token-recheck.md); P:`turnstile-runtime-recovery-fix-20261026/auth-missing-recheck-plan.json`, `AUTH-MISSING-RECHECK-APPROVAL-STATUS.json`. Prepared only/not approved/not exercised, seal7c232640a8433b84a167e0bfea6a59cd5ad0cb21337e2d9441417a31f7087017. Max1 new anonymous missing-token password request with installed SDK API-version/payload, expected400/captcha_failed/no session.1 mocked SDK missing-contract test PASS/0 live calls, alongside E47 seven local diagnostic checks. Requires owner customer/staff PASS/recovery RECEIVED first and separate exact approval; original2f2/2 budget remains exhausted. No Secret/settings/deploy/restart/new user/password/claim/email/signup/purchasing/PDC/push, no third request or automatic retry. |
| E49 | [Owner Auth acceptance results](turnstile-auth-acceptance-receipt.md); P:`turnstile-runtime-recovery-fix-20261026/OWNER-AUTH-POSITIVE-RESULTS.json`, `AUTH-ENFORCEMENT-OWNER-ACCEPTANCE-RECEIPT.json`, `auth-owner-results-readonly.json`. Owner reports customer PASS/Dashboard PASS/recovery email RECEIVED, each once/fresh private/no password or credential change. Functional hosted flows ACCEPTED (owner-observed, no sessions inspected); E47 invalid-token structured denial retained. Full Turnstile closure pending missing-token-specific reason; E48 positive prerequisite met, separate one-request approval now next. Fresh read-only same5a/runtime/process/output/759 inputs and signup disabled/confirmation required/CartCheckout403/history401.0 new password requests/emails/settings/deploy/restarts, Secret not received.2f budget2/2 consumed with evidence gap; no repeats/waiver/third request. Public signup/purchases remain disabled pending separate launch, PDC paused per owner. |
| E50 | [Completed scoped Turnstile Auth acceptance](turnstile-auth-acceptance-receipt.md); P:`turnstile-runtime-recovery-fix-20261026/TURNSTILE-AUTH-ACCEPTANCE-COMPLETE.json`, `OWNER-MISSING-RECHECK-APPROVAL.json`, `auth-missing-recheck-intent.json`, `auth-missing-recheck-result.json`, `auth-missing-recheck-postflight.json`, approval statuses. Exact owner7c executed once/exit0/PASS at11:51:32.836 Riyadh:1/1 missing-token request400/structuredcaptcha_failed/no session;0 email/settings/deploy/restart/schema/Secret. E49 owner customer/staff/recovery and E47 invalid denial combine to accept all five bounded existing-account Auth cases. Original2f2/2 and separate7c1/1 consumed, original STOP/unqualified receipt retained, no rerun/retry. Fresh signup-disabled/confirmation-required/configured key, CartCheckout403/history401 pass. Same5a/source3001cd6/schema94/759 app inputs. Genuine new signup/confirmation and history/profile/order-detail remain separate; signup/purchases disabled until approved launch/PDC paused. |
| E51 | [Controlled customer registration preparation](customer-registration-acceptance.md); P:`customer-signup-acceptance-preparation-20261026/`. Phase1 implementation complete/deployed,40 fresh local checks PASS (29 session/browser,6 native schema94 provisioning/RLS,5 signup/redirect); test-only51cbeef/759 app inputs unchanged. Read-only13:15:58 Riyadh same5a/schema94/runtime/process,3 matched profiles/no duplicates, business/history preserved; old audit prefix plus2 dashboard.login appends and telemetry qualified.0 Auth/email/settings/deploy/restarts/providers/push. Genuine registration and hosted positive cart/checkout/recovery remain unexercised/held. Sealed owner-operated2-inbox global signup window prepared, not approved; owner confirms two unused controlled inboxes available, addresses not shared or independently checked; closes after2 submissions/max20min, purchasing held/PDC paused. No app release required; permanent activation separate. |
| E52 | [Controlled signup approval/preflight](customer-registration-acceptance.md); P:`customer-signup-acceptance-preparation-20261026/OWNER-CONTROLLED-SIGNUP-APPROVAL.json`, `accepted-preflight.json/log`, `accepted-preflight-baseline.private.json`, `APPROVED-PREFLIGHT-RECEIPT.json`. Exact ownera2ca approval received, all sealed hashes verified; fresh13:28 Riyadh read-only PASS, same5a/schema94/759 inputs/runtime/process/output and3 matching old accounts/profiles/no duplicates/business-history preserved. Signup disabled, confirmation required, CartCheckout403/history401;0 Auth/email/settings/deploy/restarts/providers/push. One manual global2-inbox window authorized/max20min/close after2 submissions; NOT STARTED/NOT EXERCISED. Owner action and closure verification next, confirmation then owned profile/login/logout acceptance. No repeat approval/CAPTCHA changes/permanent signup/purchasing; PDC paused. |
| E53 | [Signup closure and acceptance STOP](customer-registration-acceptance.md); P:`customer-signup-acceptance-preparation-20261026/OWNER-SIGNUP-SUBMISSION-RESULTS.json`, `signup-closed-settings.json`, `signup-closure-readonly.log`, `signup-mismatch.private.json`, `SIGNUP-CLOSURE-STOP-RECEIPT.json`. Owner2 CHECK EMAIL/signupOFF.13:43 readonly closure PASS/confirmation required; expected5 Auth/profiles, found4 (3 old +1 new), new session1; guarded acceptance STOP.13:44 masked diagnostic ordinary active nonstaff wallet0/new user already confirmed+signed in; no normalized duplicates. Original security/profiles/business/history/runtime/schema94/759 input checks passed before STOP.0 agent Auth/emails/settings/writes/providers/push. Owner identity/link/other-email reconciliation pending; no continuation/retry/reopen or assumed cause. OD-20261026-AUTH-UX-01 deferred next Auth UI update. |
| E54 | [One genuine registration accepted](customer-registration-acceptance.md); [reviewed A/B continuation](customer-isolation-continuation.md). P:`customer-signup-acceptance-preparation-20261026/OWNER-SIGNUP-RECONCILIATION.json`, `OWNER-EXISTING-B-BINDING.private.json`, `reconciliation-readonly.private.json/log`, `existing-b-continuation-plan.private.json`. Owner confirms new A confirmation/sign-in and identifies pre-existing owned ordinary B.13:56 read-only4 users/profiles/no duplicates, both verified active nonstaff, original3 security/profiles intact; signup closed/confirmation required/CartCheckout403/history401. One genuine flow ACCEPTED, not two new identities; old STOP retained. New bound A/B continuation prepared/not approved because original login budget new-customers-only; max4 logins/one A marker/no B edits, zero signup/email/settings/deploy/providers.0 agent mutations. |
| E55 | [A/B continuation approved/preflight](customer-isolation-continuation.md); P:`customer-signup-acceptance-preparation-20261026/OWNER-EXISTING-B-CONTINUATION-APPROVAL.json`, `existing-b-preflight.json/log`, `existing-b-preflight-baseline.private.json`, `EXISTING-B-APPROVED-PREFLIGHT-RECEIPT.json`. Exact008c received/all sealed evidence verified; fresh14:15 read-only same5a/schema94/759 inputs/runtime/process,4 exact identities/bound A/B confirmed ordinary profiles, original security/profiles/permissions/business/history intact, A marker blank/per-column hashes captured. Signup disabled/confirmation required/CartCheckout403/history401;0 agent Auth/email/writes. Owner one-marker/two-tab switching/logout pending;3 or4 logins/4 logouts, first A logout serves signup logout, no extra action. Purchasing held/PDC paused, no repeat approval/deploy/settings/providers. |
| E56 | [Postflight preservation and remaining qualification](customer-isolation-continuation.md); P:`customer-signup-acceptance-preparation-20261026/OWNER-EXISTING-B-ISOLATION-RESULTS.json`, `OWNER-ISOLATION-CONTEXT-CLARIFICATION.json`, `EXISTING-B-PRESERVATION-PARTIAL-RECEIPT.json`, initial/qualified postflight logs, `remaining-session-readonly.json`, closed-gates proof. Owner initial5 PASS, detailed sequence A→B→A/click then data update; before-interaction clearing/final B logout pending. Only A marker field changed; B/original profiles and nonactivity credentials/identities/permissions/business/history/source/runtime/schema94/759 inputs preserved. Initial timestamp assertion corrected to approved optional change; full checker then STOP A session1/B0, consistent with ending A.14:47 signup closed/confirmation required/purchasing held;0 agent submissions/email/writes. Finish original remaining B login/logout/precise no-click observation; no new approval, no global cleanup or Auth retry. |
| E57 | [Scoped registration/profile/session acceptance COMPLETE](customer-registration-acceptance.md); P:`customer-signup-acceptance-preparation-20261026/CUSTOMER-REGISTRATION-ISOLATION-ACCEPTANCE-COMPLETE.json`, `OWNER-EXISTING-B-FINAL-CASE-RESULTS.json`, `existing-b-final-postflight.json/log/private baseline`. Owner before-click marker clearing YES/final logout+protected refresh PASS; fresh15:49:45 readonly same5a/schema94/759 inputs/runtime, exact4 ordinary identities/no duplicates, A/B session0, only A marker field changed. B/all original profiles/nonactivity credentials/identities/permissions/business/history preserved.0 agent submissions/email/writes; signup disabled/purchasing held/PDC paused.008c consumed complete, original timestamp guard/interim STOP/owner clarification retained. One genuine new signup/confirmation/sign-in accepted; two-new identity/positive hosted basket/order/recovery/history detail NOT accepted. Next notice-runtime and separate signup activation; no repeated acceptance. |
| E58 | [Signup/manual-purchase focused milestone](signup-commerce-next-milestone.md); [signup activation review](public-signup-activation-review.md); [manual CARD/recovery plan](manual-delivery-purchase-acceptance.md). P:`signup-commerce-next-20261026/` fresh baseline/qualified owner binding/history postread/stock policy/published candidates/production gates, scoped browser timeout, guard tests/native qualified log/notice previews. Candidate9b7564f changes2 EN/AR inputs only, owner-approved truthful imported-history copy;4 renders pass.4 guard+8 native tests pass, ready/zero-stock manual CARD two-account ownership/foreign404/idempotency/unknown-payment freeze/no fake cancellation stock/PDC jobs, zero external calls. Live only PDC company/test stock49; manual carrier/product/sourcing inputs pending; allow_out_of_stock=true but bilingual termsblank. Correct owner empty owned history payload verifiedreadonly, browser/auth self-edit pending: private window0 login/write, marker remains.16:47 gates/runtime5a/schema94 preserved;16:52 history/security/profile/payment/dispatch unchanged. Public activation/purchases closed, PDC paused, no exact packet yet. New OD-SIGNUP-02/MANUAL-01/STOCK-02; coupons/Dashboard deferred. |
| E59 | [Minimum public Beta](public-beta-minimum-launch.md); [separate signup-only approval](public-signup-activation-review.md). Owner confirms all catalog physically in store/no counts, Manual all areas50; PDC tracking requested but calls/incident paused. Localb37be43/95 implements explicit default-safe untracked normal CARD sale and SKU packing; QA marker server denied. Native15 PASS, typecheck PASS, build/private artifact receipts retained. All88 tasks A/B/C classified; housekeeping/empty-history/notice/UX deferred. Manual reimbursement preserves original card capture/private evidence, no automatic refund claim. Fresh19:34 same5a/schema94/gates closed/no mutations. Signup-only approval ready; purchasing blocked on guarded95 release and one scoped new-customer transaction/conditional activation. No deployment/payment/shipment/provider/push. |
| E60 | Owner requests targeted Supabase Storage/VPS READ-ONLY audit AFTER the current public Beta milestone. New STOR-01/B with all six buckets/counts/bytes/recency, active SDK/REST file paths, VPS workflow/access evidence and conditional integrity/backup/private parity/rollback plan. No audit executed, classifications unverified, no production/file/provider/permission change. Original88 tasks retained plus1; both handoffs/current source updated. |
| E61 | [Public signup activation PASS](public-signup-activation-receipt.md). Exactf5e08021 approved/plan hash+target matched;21:16 read-only baseline PASS, owner signup ENABLED only,21:18:33.481 Riyadh postflight signupenabled/emailconfirmationrequired/emailproviderenabled/same5a schema94 runtime/process/output/ENARlogin200/CartCheckout403/history401. Approval CONSUMED_COMPLETE; public signup stays OPEN, purchasing/PDC held.0 agent Auth/email/prod/config/deploy/migration/payment/provider/shipment/push; owner1 toggle. No new-customer activity inspected or accepted tests repeated. E59/old disabled-signup guards superseded; preserve enabled signup in95 preparation. Both handoffs/master updated,89 tasks retained. |
| E62 | [Offline location review](pdc-location-reference-review.md), [status/template purposes](pdc-status-template-reference-review.md), [32-row deferred register](DEFERRED_TEST_REGISTER.md), [per-file Git review](git-local-commit-review-20261026.md). Owner3 XLSX preserved;2×382 cityIDs/27 gov aliases/no gov-zone IDs, ID21/Arabic137146/Others366/cache411 gaps explicit. Separate sourcea9a5c6f/96 default-off neutral locations, dependent ENAR selectors/server checks/immutable snapshots, reviewed idempotent administration. Native8+7 regression/4 browser scenarios/typecheck/build LOCAL PASS, no real provider/Auth/payment/production test. Main3b7070d Auth fixtures syntax only; reviewed documentation committed separately;135 frozen paths preserved/excluded. Original95b37/artifacts unchanged,16 worktrees/13 branches,90 task IDs. Return to95 guard/recovery qualification +one new-customer transaction; no executable approval for unqualified95/96 operations. SignupOPEN/purchasesheld/PDCpaused/STORafterBeta. |

### A. Project overview

ELcomputer is an independent deployment of a reusable ecommerce platform.
Nuxt4/Vue3 provide storefront, account and Dashboard surfaces. Supabase provides
PostgreSQL, Authentication and structured metadata. **VPS-only file ownership is
the required policy.** Private packing videos/shipping labels have VPS adapters.
Read-only source inspection found legacy chat and general Documents byte paths
still using Supabase Storage; CHAT-01/DOC-01 record that unresolved implementation
gap. Do not claim all file providers already satisfy the VPS policy. Current infrastructure uses Ubuntu, Caddy and systemd's
`storefront` service. Older CloudPanel/Nginx/PM2 procedures are historical for
this target; do not execute them as the current release procedure.

Reuse site settings, runtime configuration, RBAC, RLS and provider adapters.
Store identity, origins, account IDs, prices and deployment paths belong in
reviewed deployment configuration. Paymob, PDC, Brevo, Vodafone and Daftra are
integrations, not mandatory assumptions for every business. Keep EN/AR, RTL,
Light/Dark/System, compact Dashboard components and responsive layouts.

### B. Current production baseline

| Area | Latest reliable retained evidence |
| --- | --- |
| Application | E45 runtime-only configuration retains E41: `5a38201292763325`, completed2026-10-26 02:02:04.416 Riyadh, source3001cd6; one app restart, application-only/schema94 unchanged. Exacte9d1d4bb approval consumed. Priorbc05eef266eeb7de retained for separately reviewed recovery. |
| Schema | E35:94 exact migration identities verified; only92–94 applied atomically, original91 ledger preserved. History schema/RLS/service-only RPCs installed. E37 imported516 customers/597 order-refund records/1789 items/41 batches; claims0. Main retains91 files; deployed source3001cd6 descends1924ca0 and contains94; E41 applied0 SQL. |
| Storefront | E45 EN/AR/Dashboard200, Cart/Checkout403, anonymous history401; private candidate/Purchase-CARD holds PASS. Configured anonymous EN/AR320 RTL Dark recovery/Dashboard password-form tokens and translated labels PASS, no Auth submission. Hosted authenticated acceptance remains separate. |
| Dashboard/accounts | E41 preserves all three current confirmed customer profiles/Auth security and existing order data. Existing Dashboard/product/profile and owner switch acceptance retained; independent hosted order-isolation/RBAC/owned-history acceptance remains pending. |
| Public gates | E50 same-dispatch public Auth settings: signup disabled/confirmation required; Supabase Turnstile enabled by owner, existing customer/staff/recovery accepted, missing+invalid400/captcha_failed/no session. E45 key configured/notice runtime off; public/restricted purchasing/Paymob/PDC held. Cart/Checkout403/history401, signed callbacks preserved. |
| Paymob | Existing LIVE card credentials retained privately. One EGP2 sale succeeded through normal checkout and signed-callback reconciliation. Keep exact signed POST ingress, original keys and owned receipt/status reads available for late events. No new initiation authorized. Refund/void readiness unverified. |
| PDC | Product40 preferred; provider configuration may be enabled while outbound runtime gates remain closed. Generic User-Agent and dated status lookup correction deployed in `2573cdf1504bf559`, preserved by E01. One production static API booking succeeded; normal dynamic Dashboard booking remains unaccepted. Original uncertain dispatch remains guarded. |
| PDC inbound security | E04: exact POST ingress loaded at15:00:56.337 Riyadh on 2026-10-24. Missing-secret probe401; no authenticated callback or registration change. Earlier pending-reload STOP is resolved. Provider mapping/timezone/cutover remains blocked. |
| Delivery/tariffs | PDC configured checkout company; current EGP1 fee unchanged. Configurable EGP50 support is deployed inactive; owner-approved50 setting remains unapplied. No business tariff import/checkout tariff activation. Shipment initiation remains closed and booking administrator-controlled. |
| Notifications / recovery | Central Brevo adapter/SMS remain dormant per prior evidence. Auth/Brevo recovery and controlled confirmation ACCEPTED; production redirect/account access passed. Site URL/four redirects saved. E40 records owner-verified30/hour/60s/30-per5min-IP limits; real CAPTCHA binding/hosted signup and tracking follow-up remain. No agent settings/transport change. |
| Recovery | E45 fresh execution encrypted recovery authenticated/full readback PASS:12841108 DB bytes/10 runtime files. E41/E35/E37 recovery and qualified native94 evidence retained. No SQL/data restoration or automatic rollback; never restore over newer users/data or replay consumed operators. |

Production details retain their individual evidence dates. E22 was bounded
read-only preparation. E35 is the separately authorized inactive deployment,
with schema/application changes and explicit preservation checks. E41 is the
subsequent application-only release and preserves schema94/imported data. Neither
is full production/provider/owned-history acceptance. No public gates or provider flows
were activated; accepted Auth evidence retains its original owner-verified scope.

### C. Completed and deployed features

Acceptance applies only to the scope named in each row.

| ID | Feature / workstream | Priority | Status | Owner decision / dependency | Done / acceptance | Evidence | Verified | Next action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| DONE-01 | Storefront, EN/AR, RTL, SEO, brands and AI discovery foundation | P1 | DEPLOYED | Preserve current publication/privacy rules | Retained release reports and source establish these foundations; no claim of every hosted route's acceptance | E14; app/pages; server/routes | 2026-10-25 | Maintain through Beta regression checks |
| DONE-02 | Customer account/profile and secure entry improvements | P1 | DEPLOYED | Ordinary Auth/RLS; E15 access approvals consumed | Account pages/profile access deployed; historical owner page checks preserved | E15; R:app/pages/account/profile.vue | 2026-10-25 | Complete BETA-05 using authentic sessions |
| DONE-03 | Customer cart, checkout, recovery and stale-session isolation | P0 | DEPLOYED | E01 consumed; E51 reverified complete source on schema94 | Account-scoped state, two-tab/guest separation and stale-response guards deployed;29 fresh local checks PASS; hosted positive orders/recovery still held | E51; E01; E05; R:app/composables/useCustomerScope.js | 2026-10-26 | Preserve implementation; finish BETA-05 acceptance without unsafe checkout deployment |
| DONE-04 | Real Paymob CARD sale and signed callback | P0 | ACCEPTED | Preserve original sale and callback authority | One EGP2 LIVE sale durably reconciled; 3DS owner-reported; no raw replay/bank settlement claim | E02 | 2026-10-25 | Preserve; do not repeat a charge for this roadmap |
| DONE-05 | PDC User-Agent and dated-status compatibility | P0 | DEPLOYED | Client release approval consumed | Generic header and valid job-lifetime date filters deployed and retained in E01 | E03; R:server/utils/pdcShipping.js | 2026-10-25 | Preserve across Beta packaging |
| DONE-06 | Successful PDC API booking from production VPS | P1 | ACCEPTED | Diagnostic is independent of the original customer order | One static request returned200/AWB, zero retries/customer attachment; dynamic workflow not accepted | E03 | 2026-10-25 | Preserve private identifiers; follow SHIP-07 separately |
| DONE-07 | PDC inbound webhook security preparation | P1 | DEPLOYED | Both ingress operators consumed | Exact POST ingress active; missing-secret401; no valid callback or provider cutover | E04 | 2026-10-25 | Resolve SHIP-10 prerequisites |
| DONE-08 | Dashboard, Products, inventory and order foundations | P1 | DEPLOYED | Existing Products/Orders permissions and inventory ownership | Source, restore/release receipts and owner smoke establish retained capabilities; full acceptance remains bounded | E12; E13; E20; E21 | 2026-10-25 | Preserve; track missing acceptance in FUT-01 |
| DONE-09 | Premium PDP, finishing and Modern Footer | P2 | DEPLOYED | Preserve authored content, Classic fallback and site settings | Named releases and local/live checks recorded; hosted owner acceptance separate | E16 | 2026-10-25 | Complete FUT-02 without redesign |
| DONE-10 | Company-scoped six-zone tariff manager | P1 | DEPLOYED | Exact business import and rate verification still needed | Schema91 manager/history/revision controls deployed; no checkout reader or active tariffs | E09 | 2026-10-25 | Review SHIP-03 and SHIP-04 separately |
| DONE-11 | Private packing-video and normal COD foundations | P1 | DEPLOYED | Public COD remains excluded from CARD Beta | Migrations83–85/release receipts establish runtime; paid test packing owner-completed; no broad COD acceptance | E13; E02; E08 | 2026-10-25 | Complete ORDER-01/02 and keep Beta CARD-only |

<a id="d-implemented-locally-but-not-deployed"></a>

### D. Candidate deployment and remaining local work

W contains40 modified/untracked files at inspection. Preserve their exact bytes.
Main and the later branch have not been merged by this task.

E06 records69 focused passes,7 final policy-regression passes, independent native
PostgreSQL concurrency, local manual-AWB/packing/H3 checks, typecheck and a
Node22.23.1 build. Its review archive SHA256 is
`dc8a9673695b64d34fd3d380b0d0b7077a5b5e96ee83732d2d50233e3078916b`.
Full archive readback and1534 served asset checks passed;1428 retained client
files are included. **E06 did not run new-control browser acceptance.**
E31/34 later qualify the exact combined archive with eight EN/AR/theme/width
browser checks; hosted order/new-control acceptance remains scoped under BETA-05/11.
Two known baseline failures are documented in `preorders.test.mjs` and
`storefront-payments.test.mjs`; the full suite was not run. Do not call it green.
E35 deployed the combined92–94 archive through its compatible operator; that
approval is consumed. The original Beta worktree is preserved, not a second
application release waiting to deploy. Fee/scheduler/public activation remain held.

| ID | Feature / workstream | Priority | Status | Owner decision / dependency | Done / acceptance | Evidence | Verified | Next action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| LOCAL-01 | Public paid Beta candidate | P0 | DEPLOYED | Exact candidate deployed inactive; no public purchasing/hosted order acceptance | E06's stated local checks pass; scope excludes production activation | E06; W:docs/beta-launch-candidate.md; E35 | 2026-10-25 | Candidate deployed inactive; complete separate migration/signup/final purchasing acceptance under BETA-11 |
| LOCAL-02 | Migration92: zero-stock CARD backorders and paid stock release | P0 | DEPLOYED | Migration92 installed; eligible backorders remain gated, no invented stock | Published normal items; no invented stock; paid orders held until real atomic allocation | E07; W:supabase/migrations/20261024150000_card_backorders.sql; E35 | 2026-10-25 | Migration92 installed; accept real allocation/backorder behavior during approved order acceptance |
| LOCAL-03 | Migration93: unpaid expiry and reservation restoration | P0 | DEPLOYED | Migration93 installed; scheduler/secret/monitoring remain inactive | Release actual allocations once; protect active/paid/packed/dispatched/uncertain attempts; late success enters review | E07; W:supabase/migrations/20261024160000_unpaid_card_stock_release.sql; E35 | 2026-10-25 | Migration93/API installed inactive; qualify BETA-09 scheduler/secret/monitoring separately |
| LOCAL-04 | CARD-only public checkout protections | P0 | DEPLOYED | Private deployment policy and reviewed product exclusions | Restrict method/company/customer window; malformed policy closes access; persisted items revalidated | E06; W:server/utils/betaPurchase.js; E35 | 2026-10-25 | Guards deployed with purchasing closed; accept normal-flow controls under BETA-05/11 |
| LOCAL-05 | Manual PDC AWB recording | P1 | DEPLOYED | Administrator verifies actual AWB; paid/allocated/packed order | Existing RBAC/video/coverage/duplicate barriers preserved; uncertain dispatch cannot use fallback; label remains pending | E06; W:server/api/admin-shipping/orders/[id]/manual-awb.post.js; E35 | 2026-10-25 | Endpoint deployed; hosted RBAC/genuine manual-AWB acceptance remains ORDER-03, no invented shipment data |
| LOCAL-06 | Special-order notices and mixed-parcel hold | P0 | DEPLOYED | Historical E06 wording/code retained; OD-20261025-STOCK-01 supersedes automatic zero-stock labeling as future policy | Existing explicit special-order/mixed-parcel safeguards remain; new PROD-05 separates stock-independent selling and prevents quantity-driven labels; no code/settings change here | E38; E06; W:app/utils/backorder.js; E35 | 2026-10-25 | Review truthful current candidate wording under BETA-06; do not make post-Beta PROD-05 a launch dependency |
| LOCAL-07 | Configurable EGP50 Beta customer delivery fee | P0 | LOCAL PASS | Owner approved50; production still stores1 | Existing client_shipping_price owns fee; carrier costs/subsidy/VAT not inferred | E06; E10 | 2026-10-25 | Apply only through BETA-11's exact settings approval |
| LOCAL-08 | Cross-account source and documentation consolidation | P0 | LOCAL PASS | Qualified Beta snapshot preserved as2cd5418 in isolated history branch; originals untouched | Exact original40-file snapshot plus additive history source retained; no main/application merge or deployment implied | E23; E31; local/customer-history-launch-20261025 | 2026-10-25 | Preserve frozen1924ca0 and sealed inactive release; no overwrite/merge of existing work |

Candidate runtime inputs already documented in W's `.env.example`:
`NUXT_PUBLIC_PURCHASING_ENABLED`, `NUXT_PUBLIC_BETA_PURCHASING_ENABLED`,
private `NUXT_BETA_PURCHASE_POLICY`, and `NUXT_COMMERCE_WORKER_SECRET`.
Policy binds configured company/product exclusions and optional customer IDs/
maximum one-hour acceptance window. Secret must be32+ characters; do not record
values here. Private VPS directory settings remain deployment-owned.

### E. Current top priority — public paid Beta launch

Do these as bounded milestones. Existing payment success is preserved evidence;
it does not waive multi-customer, email, destination or recovery acceptance.

| ID | Feature / workstream | Priority | Status | Owner decision / dependency | Done / acceptance | Evidence | Verified | Next action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| BETA-01 | Supabase Auth custom SMTP using Brevo | P0 | ACCEPTED | Owner-verified full production recovery PASS; no repeat SMTP investigation | Auth/Brevo email received from verified sender; production reset and new-password login succeed. Confirmation belongs to BETA-02 | E25; E22 | 2026-10-25 | Preserve accepted transport and confirmation; proceed to inactive deployment/migration |
| BETA-02 | Signup confirmation, recovery and redirect acceptance | P0 | ACCEPTED | Owner recovery/confirmation production PASS; read-only exact confirmation/profile verified | Controlled recovery and signup-confirmation delivery/redemption/owned access accepted; unaided public signup belongs to BETA-03 | E25; E28; E24 | 2026-10-25 | Preserve accepted Auth results; proceed to guarded historical migration without repeat emails |
| BETA-03 | Public registration abuse controls and readiness | P0 | ACCEPTED | PUBLIC SIGNUP OPEN; exactf5 approval consumed/owner toggle and21:18 postflight PASS | Email confirmation required/email provider enabled; accepted CAPTCHA/signup/isolation retained; purchasing/PDC held; no fresh test accounts | E61; E59; E57; E50 | 2026-10-26 | Keep signup enabled/monitor delivery and abuse; proceed with guarded95 Beta release, no repeat approval/tests |
| BETA-04 | Legacy-customer identity protection for Beta | P0 | DEPLOYED | Verified identity protections retained; empty history browser C/deferred | No unverified email/guest linking; imported history immutable; actual order-bearing view deferred | E59; E58; E40 | 2026-10-26 | Preserve protection; no Connect/claim/new private window for launch |
| BETA-05 | Authentic A/B customer-order/session acceptance | P0 | LOCAL PASS | Accepted deployed session isolation; new native95 public-mode transaction proof PASS | Ownership/total/stock disposition/duplicate/paid confirmation native PASS; hosted new-customer transaction unaccepted | E59; E57; E58 | 2026-10-26 | One scoped new-customer normal CARD order/payment; no second paid order or repeated Auth/profile audit |
| BETA-06 | Legitimate publishing and fulfillment catalog | P0 | LOCAL PASS | Owner confirms entire catalog physically available/can ship at listed prices, no counts | Only published normal positive-price active-model genuine items; exclude test inventory, preserve drafts | E59; OD-20261026-STOCK-03 | 2026-10-26 | Use confirmed catalog with95 untracked mode; no SKU census or fabricated balances |
| BETA-07 | Owner-approved launch delivery and configurable EGP50 shipping | P0 | LOCAL PASS | Owner-managed delivery/all cities and governorates/EGP50 CONFIRMED | Prepare separate Manual company and reviewed coverage/fee; old PDC identity/barriers preserved | E59; OD-20261026-DELIVERY-02 | 2026-10-26 | Install approved Manual configuration through guarded Beta plan; PDC calls remain paused |
| BETA-08 | Merchant refund/cancellation and stock-reconciliation readiness | P0 | LOCAL PASS | Owner proposes direct transfer; basic local commercial closure/no phantom stock PASS | Manual evidence/consent/unique operation/reconciliation required; card refund automation deferred, no automatic ledger claimed | E59; OD-20261026-REFUND-02 | 2026-10-26 | Approve minimum manual remedy in Beta plan; preserve original capture and prevent duplicate reimbursement/reversal |
| BETA-09 | Expiry scheduler, exception monitoring and closure | P0 | PLANNED | Manual exception monitoring/kill switch critical; scheduler automation deferred | Preserve expiry worker/stock restoration; close new purchases without losing signed callbacks or owned receipts | E59; E06; E07 | 2026-10-26 | Staff15-minute review at launch; install scheduler later without reopening accepted tests |
| BETA-10 | Guarded inactive schema91→94 deployment preparation | P0 | DEPLOYED | Exact replacement4c332350 approved/executed once; catalog pause may end; seal consumed | Releasebc05eef266eeb7de/schema94 active, atomic92–94, all140 original projections/Auth preserved; backups/candidate/RLS/gates/public smoke PASS, history/claims0 | E35; E34; E33; E31 | 2026-10-25 | Never rerun consumed apply; E37 historical import/three-route change also completed; ordinary acceptance/notice/signup are next |
| BETA-11 | Normal CARD checkout and guarded public activation | P0 | BLOCKED | Local95 stock-independent CARD sale/packing qualified; one guarded Beta plan prepared | 95 operator/recovery and exact one real transaction/payment budget not sealed; no public activation | E59; E57; OD-20261026-BETA-01 | 2026-10-26 | Qualify smallest95 release plus Manual/50/normal catalog; one bounded new-customer purchase then conditional public activation |
| BETA-12 | Preserve LIVE payment, 3DS and callback reconciliation | P0 | ACCEPTED | Prior real LIVE card payment/signed callback accepted; preserved | No repeat integration charge; new native customer-to-paid flow PASS with0 external calls | E59; DONE-04; E02 | 2026-10-26 | Preserve binding; verify next single authorized genuine customer sale only |

### F. WordPress / WooCommerce migration

The archive stays **strictly read-only**. Never run its code or old automation.
The owner's2026-10-25 priority supersedes the older Beta-before-history sequence:
confirmation acceptance → guarded historical migration/identity safeguards →
public signup → final paid launch. Reuse the existing combined Beta/history
candidate. Its approved inactive92–94 deployment must precede history import;
deployment, import, signup and purchasing retain their separate approvals.

| ID | Feature / workstream | Priority | Status | Owner decision / dependency | Done / acceptance | Evidence | Verified | Next action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| MIG-01 | Source inventory and durable customer identity mappings | P0 | DEPLOYED | Source and final eligibility/import approved and executed once; actual Auth claims0 | 516 imported/513 conditionally eligible/3 held; one current verified match has no orders,512 later verified signups; zero Auth creation/hash import/automatic links/current edits | E37; E36; E30; E23 | 2026-10-25 | Preserve source/import receipts; verify explicit ordinary ownership without changing immutable flags |
| MIG-02 | Historical customer profiles and saved addresses | P0 | DEPLOYED | All516 archived customer snapshots imported; verified explicit claim required for reads | Every approved historical snapshot/address preserved; all140 original projections/current profiles/credentials unchanged | E37; E36; E23 | 2026-10-25 | Existing eligible customer accepts archived profile/empty order view; hosted acceptance remains pending |
| MIG-03 | Historical orders, customer order history and Woo metadata | P0 | DEPLOYED | Data/API/My Orders and three scoped routes live; claims0, hosted owned acceptance pending | 591 orders/6 refunds/1789 items/702 events reconciled exactly;459 orders/6 refunds eligible,1 held order/131 unlinked remain private; no live provider action | E37; E36; E35; E23 | 2026-10-25 | Accept hosted ordinary claim/list/detail/refresh with an eligible order-bearing customer after separately approved signup |
| MIG-04 | Product identity links, legacy URL continuity and post-migration SEO | P1 | PLANNED | Post-Beta source-product/URL mapping and authorized Search Console evidence; no Google access established | Preserve catalog links; valid one-to-one permanent redirects, no chains/loops/homepage dumping; audit indexation/trends/canonicals/hreflang/sitemap/robots/product data with dated real evidence | E38; E14; E11; L1 requirement10 | 2026-10-25 | Inventory old→new URLs read-only; later obtain scoped GSC exports/access and propose reviewed redirect exceptions; no duplicate catalog import |
| MIG-05 | Historical import safety and guarded acceptance | P0 | DEPLOYED | Exact3c9f5764 approval consumed;41 durable batches/completion and independent verification PASS | Fresh encrypted execution recovery/full readback; every immutable record and140 original projections preserved; no Auth/current-commerce/provider/notification writes; one scoped Caddy signal/0 app restart | E37; E36; seven operator tests | 2026-10-25 | Never rerun consumed apply/check expecting empty history; retain receipts and complete hosted ordinary-owner acceptance |

### G. Payment gateways

| ID | Feature / workstream | Priority | Status | Owner decision / dependency | Done / acceptance | Evidence | Verified | Next action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PAY-01 | Secure Dashboard Payment Gateways and Quick Setup configuration | P1 | PLANNED | Separate unit D1; active-owner authorization | Owner-only route/API, versioned encrypted secrets, presence-only responses, audited changes; explicit runtime fallback/source switch | E10; E19 | 2026-10-25 | Extend existing resolver/Setup without moving live secrets automatically |
| PAY-02 | Paymob Pixel/embedded on-site payment investigation | P2 | PLANNED | Preserve successful LIVE flow and verified callback path | Audit existing Pixel loader/integration first; qualify hosted embedding, lifecycle and 3DS before changing redirects | E10; paymob-report.md; REQ | 2026-10-25 | Compare existing embedded path with observed customer journey |
| PAY-03 | Paymob refund/void workflows and transaction reconciliation | P1 | PLANNED | BETA-08 manual readiness first; provider/account acceptance | Explicit approved money actions, durable operation ledger, uncertainty handling, refund callbacks/reconciliation and stock disposition | E06; E10; REQ | 2026-10-25 | Design against original transaction; no current refund API exists |
| PAY-04 | Generic future payment gateway adapters | P2 | PLANNED | Owner-selected provider and supported capability contract | Provider/config revision pinned per attempt; preserve original reconciliation keys and method availability controls | E10; REQ | 2026-10-25 | Add only when a concrete gateway is selected |
| PAY-05 | Dashboard merchant-transaction visibility issue | P2 | PLANNED | Owner-reported requirement; exact failing view unverified | Reproduce with secure intended merchant/session; reconcile known sale to local/provider view without another charge | REQ; E02 | 2026-10-25 | Capture read-only view/reproduction details privately |

### H. Products, inventory and backorders

**OD-20261025-STOCK-01, latest owner decision:** selling without recorded-stock
restrictions is a normal-purchasing policy, separate from backorders. Do not infer
“Available to order”, “Backorder”, “In Stock”, “1 left” or “Available now” merely
from recorded quantity. New global/per-product controls are PROD-05, post-Beta.
Existing code, SQL, labels, data and settings are not changed by this record.

The earlier special-order message remains historical: “Special order. We’ll confirm
availability and delivery timing before fulfillment.” Its automatic use for every
zero-stock item is superseded as policy. Genuine explicitly designated special
orders may still communicate accurate timing. Mixed-parcel safety and genuine-unit
allocation/cancellation controls remain; no immediate-dispatch promise or fake stock.
Current Beta catalog/wording review is BETA-06; PROD-05 is not a signup/paid-launch gate.

| ID | Feature / workstream | Priority | Status | Owner decision / dependency | Done / acceptance | Evidence | Verified | Next action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PROD-01 | Configurable zero-stock purchasing and truthful fulfillment | P0 | LOCAL PASS | 95 default-safe untracked CARD mode locally qualified; legacy tracked flow preserved | No count/quantity/serial fabrication; paid SKU packing/video still enforced | E59; LOCAL-02; OD-20261026-STOCK-03 | 2026-10-26 | Guarded95 release, then explicit mode activation; preserve all old order snapshots |
| PROD-02 | Product Manager reliability, publication and bulk operations | P1 | PLANNED | Preserve current compact UI and E12 contracts | Revision-safe sparse changes, current-page selection, recoverable partial receipts, Draft-first required fields and honest failures | E12; E21; REQ | 2026-10-25 | Reproduce remaining accepted defects before extending controls |
| PROD-03 | Image uploads and VPS media lifecycle | P1 | PLANNED | VPS-only files; extend reference guards for new tables | Validated public images, private evidence separation, authorized deletion/recovery and real upload acceptance | E12; REQ | 2026-10-25 | Verify remaining hosted upload/delete cases without replacing uploader |
| PROD-04 | Procurement and ERP inventory ownership | P1 | PLANNED | Built-in versus Daftra mode, genuine units and ERP-02 ownership matrix | Preserve single inventory owner; receipt/cost/QR links truthful; aggregate ERP stock never fabricates physical units; no inventory repair merely to sell | E38; E20; E07 | 2026-10-25 | Review procurement→paid-backorder release under current ERP mode; ERP-01/02 follow after Beta |

### I. Shipping companies and PDC

PDC remains one adapter within generic Shipping Companies. Product40 is the
current preferred configured service, not a reusable hardcoded default.
Book by weight; do not require dimensions. Administrator confirmation, real
stock allocation and packing precede an explicit booking. Payment alone does
not book. No automatic pickup scheduling; manual pickup remains the default.
PDC may create implicit pickup records; do not promise provider behavior absent evidence.

| ID | Feature / workstream | Priority | Status | Owner decision / dependency | Done / acceptance | Evidence | Verified | Next action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SHIP-01 | Modular companies, provider accounts and future carrier APIs | P1 | PLANNED | Separate A1 unit; preserve current account/jobs | Company/account revisions snapshot new jobs; old/uncertain jobs retain credentials/reference; no automatic reassignment | E10; REQ | 2026-10-25 | Design account binding without changing current PDC operations |
| SHIP-02 | Official PDC city/governorate IDs and searchable selectors | P1 | BLOCKED | E62 offline382 cityIDs/27 govnames reconciled; gov/zone IDs absent, cache-only30 parents unknown; PDC paused | LOC-01 local96 selectors support Manual independently; no coverage/tariff/API/booking inference; existing maps/cache immutable | E62; E59; OD-20261026-LOC-01 | 2026-10-26 | Retain unknown IDs/status issues for later;96 needs separate approval, not silently added to95 |
| SHIP-03 | Six-zone tariff verification and bounded draft import | P1 | BLOCKED | Effective date, Product40 applicability, rounding, bases/suburbs unverified | Owner confirms current prices/fee/VAT/surcharge rules; exact company/version import remains inactive until separately accepted | E09 | 2026-10-25 | Review owner package against authoritative current terms |
| SHIP-04 | Carrier cost, customer price, subsidy and rounding rules | P1 | PLANNED | Separate C1; verified tariffs and explicit owner strategy | Fixed/percentage/full-cost rules, optional cap, integer money/rounding and immutable cost/subsidy snapshots; no inferred fees | E10; REQ | 2026-10-25 | Specify pricing unit separately from Beta's fixed50 |
| SHIP-05 | Returning-customer free shipping and next-purchase promotion | P2 | PLANNED | Separate C2; owner eligibility/expiry/cancellation policy | Prior paid qualifying purchases; locked one-use grants; no double spend, perpetual regrant or unverified imported eligibility | E10; REQ | 2026-10-25 | Choose unlimited-repeat versus one-time policy explicitly |
| SHIP-06 | Private PDC PDF label templates and retrieval | P1 | PLANNED | Genuine assigned AWB; approved template and VPS directory | Authorized explicit PDF retrieval, safe validation/storage/viewing; diagnostic AWB never attached to customer order | E03; E13; REQ | 2026-10-25 | Qualify existing label path with separately approved real linkage |
| SHIP-07 | Normal Dashboard dynamic booking and tracking acceptance | P1 | BLOCKED | No eligible paid/packed unbooked customer candidate in latest packet | Exact-order approved Product40/weight booking, original REF/AWB linkage, private PDF and dated status; manual pickup | E03; E08; REQ | 2026-10-25 | Select legitimate eligible order read-only; do not reuse uncertain order |
| SHIP-08 | Date-filtered GetShipmentsStatus polling | P1 | DEPLOYED | New polls remain separately authorized | Required valid dates and matching saved-job lifetime deployed; no blind retries; live owned tracking acceptance incomplete | E03; R:server/utils/pdcLookups.js | 2026-10-25 | Reuse correction; accept polling within SHIP-07 |
| SHIP-09 | Manual pickup and optional daily pickup policy | P2 | PLANNED | Default manual; later explicit owner automation decision | Preserve no-pickup-scheduler default; define provider behavior and opt-in controls before scheduling anything | E03; REQ | 2026-10-25 | Document actual manual process; defer daily automation |
| SHIP-10 | PDC authenticated webhook mapping and provider cutover | P1 | BLOCKED | Owner requests webhook tracking and reports labels/pickups; not new technical acceptance | Provider still paused and uncertain incident preserved; Manual Beta does not depend on this cutover | E59; OD-20261026-TRACK-01; E04 | 2026-10-26 | Review latest redacted files when supplied; no provider calls/booking/retry without new exact authorization |
| SHIP-11 | PDC reverse shipments and returns | P1 | ON HOLD | Reverse type/account acceptance and after-sales scope | Verified reverse service, durable reference, private labels/status and authorized return flow; no automatic restock/refund | E17; pdc-shipping.md | 2026-10-25 | Resume only under separately approved reverse acceptance |
| SHIP-12 | Historical HTTP500s and original uncertain dispatch reconciliation | P1 | BLOCKED | Original provider outcome unresolved; diagnostic success is separate | Preserve all private incidents/REF/AWB evidence; reconcile exact original reference without reset/rebooking or alias invention | E03; E08; REQ | 2026-10-25 | Review existing authoritative evidence; no new booking to test a theory |

The User-Agent finding resolves an observed Node compatibility failure. It does
not explain every historical GetProducts500 or the provider's internal exception,
and does not reconcile the original uncertain customer dispatch. Static booking
success is not normal Dashboard fulfillment acceptance. Never blindly retry
uncertain shipment creation or attach an unrelated diagnostic/cancelled AWB.

### J. Orders and fulfillment

| ID | Feature / workstream | Priority | Status | Owner decision / dependency | Done / acceptance | Evidence | Verified | Next action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ORDER-01 | Administrator order confirmation and packing controls | P1 | DEPLOYED | Existing Orders permission, assigned real units and active packer | Confirmation/scan/video/Ready to Deliver guards exist; original paid test packing completed; full normal Beta fulfillment still separate | E13; E08 | 2026-10-25 | Preserve and accept with legitimate Beta order |
| ORDER-02 | Packing/confirmation videos under Orders → Documents | P1 | PLANNED | Existing private VPS video backend; post-Beta owner folder/naming, recording choices, limits and retention review | New sessions/YYYY-MM-DD/ORDER-CODE/VIDEO-NAME-PACKERFIRSTNAME.mp4 convention, server-bound staff/order/time/location/size/duration metadata, private authorized Orders Documents playback; preserve old bindings | E38; E13; REQ; L1 requirement5 | 2026-10-25 | Define capture/upload/transcoding, versioned paths, permissions and retention before implementation; no move/rename or Supabase bytes |
| ORDER-03 | AWB, shipment and tracking linkage/manual fallback | P1 | LOCAL PASS | LOCAL-05; genuine eligible packed order | Record verified manual AWB atomically; no uncertain barrier bypass or invented label; customer projection shows correct linkage | E06; E07; REQ | 2026-10-25 | Verify hosted RBAC and duplicate recovery after approved release |
| ORDER-04 | Customer order timeline and notifications | P1 | PLANNED | Real dated status evidence; channels separately approved | Accurate owned timeline; no invented intermediate states; idempotent producers and separately accepted notification delivery | E13; E18; REQ | 2026-10-25 | Audit actual order-event producers and customer status projections |
| ORDER-05 | Cancellation, refunds, returns and inventory restoration | P1 | PLANNED | BETA-08, LOCAL-03, PAY-03 and actual unit disposition | Separate financial/fulfillment state; restore only genuine allocations once; retain sale/refund/audit history | E06; E07; E17 | 2026-10-25 | Qualify unpaid and paid cases through respective reviewed procedures |

### K. Checkout and customer experience

| ID | Feature / workstream | Priority | Status | Owner decision / dependency | Done / acceptance | Evidence | Verified | Next action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CX-01 | Coupon POST /api/checkout/coupon HTTP403 | P1 | PLANNED | CARD Beta deliberately excludes coupons; ingress intentionally closed | Distinguish Caddy403 from loopback Nuxt400; add/review customer/purchase auth, authoritative totals and abuse limits before opening | E08; REQ | 2026-10-25 | Reuse focused finding; review route contract rather than broad allow rule |
| CX-02 | Related customer-route permissions | P1 | PLANNED | Configurable restrictive ingress and ordinary Auth/RBAC | Required authorized paths work; anonymous/foreign-account access denied; intentional holds remain explicit | E08; E15; E21 | 2026-10-25 | Map actual methods/routes for the next approved flow |
| CX-03 | Multiple saved customer addresses | P2 | PLANNED | Owner confirms scope; current profile stores one address | Owned address book/default selection, safe revisions and order snapshots; no legacy overwrite | E08; E11; REQ | 2026-10-25 | Define additive schema/UI after Beta |
| CX-04 | Cart persistence, recovery and multi-customer security acceptance | P0 | LOCAL PASS | Deployed cart/session isolation accepted; new native95 public-mode ownership/duplicate/paid confirmation PASS | No repeated profile switching/empty lists/403 claimed as new acceptance; one actual customer transaction pending | E59; E57; E58 | 2026-10-26 | Finish single scoped hosted new-customer transaction; no broad browser manual test set |
| CX-05 | Reliable EN/AR desktop/mobile checkout | P0 | PLANNED | Existing candidate needs hosted acceptance; new post-Beta toggles are not prerequisites | Accurate fulfillment/fee/error states across RTL/themes/widths; no false quantity-based availability promises, hydration errors or cross-account data | E38; E06; E14; REQ | 2026-10-25 | Qualify the exact current candidate and report label conflicts without implementing post-Beta features |
| CX-06 | Help Center, support, returns and warranty improvements | P2 | PLANNED | Existing ticket/article/claims contracts and owner policy | Preserve owned support/private evidence; review remaining accessibility, article helpfulness and communication needs | E17; E18; PROJECT_STATE.md Help Center entries; REQ | 2026-10-25 | Select one concrete improvement after Beta |

### L. Future features and retained unfinished commitments

These requirements remain visible when Beta takes priority. Earlier local
certification or pre-reinstall deployment does not establish current full-stack
acceptance. Do not revive already completed historical phases as new work.

| ID | Feature / workstream | Priority | Status | Owner decision / dependency | Done / acceptance | Evidence | Verified | Next action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| FUT-01 | Dashboard full authenticated/RBAC/browser-write-safety acceptance | P1 | BLOCKED | Secure active-role sessions and guarded test scope | Accept named roles/modules; functional owner smoke and public401/403 are insufficient; preserve unread evidence limits | E21; E12 | 2026-10-25 | Prepare smallest remaining authenticated acceptance scope |
| FUT-02 | Premium PDP/Footer owner acceptance | P2 | PLANNED | Secure owner browser and saved theme/content settings | Hosted persistence/favorites/sharing/package content accepted; no fabricated content or replacement layout | E16 | 2026-10-25 | Complete remaining owner cases without redesign |
| FUT-03 | QR/serialized inventory and packing extensions | P2 | PLANNED | Actual unit custody/ownership and scan authorization | Preserve current QR registry; validate real scans, retries and packing coverage; no invented ownership from aggregate stock/warranty claims | E13; E17; E20; REQ | 2026-10-25 | Inventory specific outstanding QR requirements before implementation |
| FUT-04 | Analytics, finance and reporting enhancements | P2 | PLANNED | Owner-selected metrics; exact financial source ownership | Reconciled transactions/shipping subsidies/COD/returns; authorized aggregate reporting, no fabricated wallet/ledger history | E20; cod-collections.md; REQ | 2026-10-25 | Define one report and its real data contract |
| FUT-05 | Central email, SMS and customer notifications activation | P1 | ON HOLD | Approved senders, credentials, worker infrastructure and provider acceptance | Retain dormant Brevo/Vodafone/order/PDC channels; idempotent event capture, no replay backlog, delivery/uncertainty/retention acceptance | E18; E06 | 2026-10-25 | Keep distinct from Auth SMTP; approve one channel/producer at a time |
| FUT-06 | After-sales warranty, reverse logistics and communications acceptance | P1 | ON HOLD | Policy/role/private-file/provider acceptance | Purchased rights immutable; stage-specific claims/returns decisions; no automatic financial or inventory side effects | E17 | 2026-10-25 | Reconcile remaining hosted acceptance before enabling policies |
| FUT-07 | Quick Setup portable installation/publication and recovery | P2 | LOCAL PASS | Fresh independent target; hosted/Linux/reboot acceptance separate | Preserve certified installer/publisher/release82 behavior and first-owner/RLS safety; include provider management without hardcoded identity | E19; E10 | 2026-10-25 | Plan actual independent-target acceptance; never use historical production operators |
| FUT-08 | ERP/Daftra, procurement, treasury and HR follow-up | P2 | PLANNED | Correct ERP owner; focused provider/mode work tracked once under ERP-01/02 | Retain existing modules/salary/payment command safety and procurement options; ERP-01 owns connection/data audit, ERP-02 mode repair; other finance/HR acceptance remains here | E38; E20; salary-payment-safety.md | 2026-10-25 | Prioritize stock controls after Beta, then ERP-01/02; select remaining finance/HR scope without duplicating those tasks |
| FUT-09 | Live Chat, OAuth, accessibility and Help Center follow-up | P2 | PLANNED | Focused live-chat audit/VPS acceptance delegated to CHAT-01; provider/retention approvals remain | Preserve conversations/support; CHAT-01 owns current chat isolation/reconnect/performance/files; OAuth/accessibility/article feedback remain this umbrella’s unfinished work | E38; live-chat-staging-acceptance.md; authentication-page.md | 2026-10-25 | Reuse current foundations, track chat only under CHAT-01 and select remaining OAuth/help scope after Beta |
| FUT-10 | Additional shipping/payment integrations and future discovery protocols | PARKED | ON HOLD | Concrete owner-selected service and explicit scope | Generic adapters/secure callbacks; advertise only implemented services; no speculative provider IDs or false capabilities | E10; E14; REQ | 2026-10-25 | Retain until owner selects integration |
| CONT-01 | Permanent cross-account roadmap and milestone continuity | P1 | LOCAL PASS | This documentation task; future accounts must update explicitly | A–O/tasks/evidence/conflicts/pointers maintained; old handoff bytes and other account's work preserved | This file; AGENTS.md; both handoffs | 2026-10-25 | Update with every completed milestone and new requirement |

### L1. Ten owner requirements — post-Beta

Recorded2026-10-25. **All ten are post-Beta priorities.** Public self-service
signup and real paid customer orders remain P0. None of these workstreams is a
new prerequisite for BETA-03/11. PROD-05 is first after public Beta. This task
records requirements and source findings only: no implementation, new test run,
provider diagnostic, storage migration, production write or activation.

| Owner requirement | Stable task IDs | Tracking decision |
| --- | --- | --- |
| 1. Sell without recorded-stock restriction | PROD-05 | New, distinct from existing PROD-01 backorders |
| 2. Dashboard Products grid/list | PROD-06 | New display-mode scope; preserve PROD-02 reliability |
| 3. Live Chat audit and activation | CHAT-01 | New focused workstream delegated from FUT-09 |
| 4. Documents area/sidebar/storage usage | DOC-01 | New; general Documents differs from ORDER-02 videos |
| 5. Packed KG and packing-session videos | ORDER-06; ORDER-02 | New weight task; extend existing planned video task |
| 6. Direct Store Settings navigation | DASH-01 | New navigation-only scope |
| 7. Overview Store Activity/Live on Store tiles | DASH-02 | New; reuse existing analysis components/data |
| 8. Full Daftara API/data audit | ERP-01 | New focused audit delegated from FUT-08 |
| 9. Local ERP ↔ Daftara ownership switch | ERP-02 | New focused compatibility/repair workstream |
| 10. Google trends/indexation/legacy redirects | MIG-04 | Extend existing legacy-URL task; do not duplicate it |

Nine new IDs below plus the updated original tasks give88 tasks. Original79 IDs,
unfinished commitments and dated evidence remain. “Verified” means2026-10-25
source/requirement inspection, not hosted acceptance or provider verification.

| ID | Feature / workstream | Priority | Status | Owner decision / dependency | Done / acceptance | Evidence | Verified | Next action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PROD-05 | Global/per-product normal selling without stock restriction | P0 | LOCAL PASS | Owner promotes GLOBAL normal-selling mode to current Beta; local95 implemented | Default tracking preserved; explicit untracked snapshot/no stock labels or hold; per-product inherit/allow/restrict remains B | E59; OD-20261026-STOCK-03; OD-20261025-STOCK-01 | 2026-10-26 | Deploy/activate global part through guarded Beta plan; keep per-product overrides and metadata follow-up later |
| PROD-06 | Dashboard Products grid/list preference | P2 | PLANNED | Post-Beta; reuse bounded Products/RBAC/bulk contracts | Both admin display modes retain editor/search/filter/sort/page/bulk/return continuity; responsive EN/AR/RTL/themes and bounded catalog performance | E38; L1 requirement2; PROD-02; E12 | 2026-10-25 | Reuse current listing data/controller; define preference/pagination continuity without storefront redesign |
| CHAT-01 | Live Chat isolation/performance audit and private VPS files | P1 | PLANNED | Post-Beta; legacy Supabase byte adapter must be reconciled before chat activation | Reliable conversations/reconnect/unreads/notifications/mobile; authorized bounded private VPS uploads/downloads/retention, no Supabase file bytes or storefront slowdown | E38; L1 requirement3; FUT-09 | 2026-10-25 | Audit existing chat/attachment contracts offline first; qualify isolated actors and bounded resources before separate activation |
| DOC-01 | Documents workspace/sidebar and cached private storage usage | P2 | PLANNED | Post-Beta; layout/access/accounting and legacy storage-provider scope review | Main area used effectively; desktop main sidebar expanded by default/manual collapse; real cached private-byte total/last-updated timestamp, no recursive page-load scan | E38; L1 requirement4; ORDER-02; PROD-03 | 2026-10-25 | Define sidebar state and authorized accounting roots/worker; inspect provider gap without migration or recursive scans |
| ORDER-06 | Actual package KG at packing/confirmation and PDC binding | P1 | PLANNED | Post-Beta enhancement; provider weight precision/limits and order/package authority; ORDER-01/02 | Positive precise actual KG persisted on correct package and snapshotted into explicit authorized booking; no checkout shipment/pickup or invented actual weight | E38; L1 requirement5; SHIP-07 | 2026-10-25 | Review existing default-weight path and define actual-weight save/booking contract with focused unit/retry tests |
| DASH-01 | Settings opens Store Settings without nested sidebar menus | P2 | PLANNED | Post-Beta navigation-only; preserve settings permissions/pages/direct routes | One direct Settings entry; all configuration still reachable within existing settings surfaces; EN/AR/RTL/mobile/active-state access intact | E38; L1 requirement6; E20 | 2026-10-25 | Map current navigation/settings keys and propose compact direct entry; delete no settings feature |
| DASH-02 | Overview Store Activity and separate Live on Store tile | P2 | PLANNED | Post-Beta; existing CustomerExperience/Overview data and permissions | Reused Store Activity on Overview plus small distinct live tile; accurate timestamped values, responsive themes/locales, bounded requests/subscriptions | E38; L1 requirement7; FUT-04 | 2026-10-25 | Reuse existing source/component contracts and set refresh/query budget; no invented live counts |
| ERP-01 | Daftara API connectivity, mappings and full data audit | P1 | PLANNED | Post-Beta; scoped credentials/provider capability evidence; read-only first | Explicit capability/read/write matrix for customers/products/inventory/accounts/invoices/bills/payments; pagination/rates/idempotency/reconciliation/recovery/monitoring; no unapproved provider write | E38; L1 requirement8; FUT-08; E20 | 2026-10-25 | Inventory current adapters/jobs and read-only diagnostics; verify actual provider documentation before any separately approved write test |
| ERP-02 | Local/Daftara mode compatibility and backend ownership enforcement | P1 | PLANNED | Post-Beta; old switching code incompletely accepted; ERP-01 and PROD-04 | Local modules work in Local mode; incompatible Procurement/Suppliers APIs and UI denied in Daftara mode; historical local data retained; explicit status/versioned switch/recovery | E38; L1 requirement9; FUT-08; E20 | 2026-10-25 | Build current module/API/SQL ownership matrix and safe switch/rollback fixtures; no mode/credentials/data changes now |

#### Requirement1 — PROD-05: normal selling, independent of recorded stock

- **Owner decision:** OD-20261025-STOCK-01 supersedes plans to automatically label
  every zero-stock product as a special order/backorder. No quantities or stock
  availability disclosures for products governed by this policy. Accurate separately
  chosen fulfillment communication remains; never promise immediate dispatch.
- **Existing status:** deployed source has global `allow_out_of_stock_purchases`,
  migration92 backorders, consent/messages and real-unit release safeguards. This
  is not the requested normal-selling global/per-product override. No such new
  controls have been qualified or enabled. Historical E06/LOCAL-06 evidence stays.
- **Policy acceptance:** Store Settings supplies “Sell without stock restriction”.
  Product Editor supplies “Enable selling without stock” with explicit inheritance:
  unset/reset = store default; explicit allow/restrict overrides that default.
  Document the effective-policy truth table. New independent stores default safely;
  migrate existing explicit settings only through reviewed configuration.
- **Purchase acceptance:** for legitimate enabled/published products under the
  effective allow policy, zero, missing/unknown or insufficient recorded quantities
  cannot alone reject Cart/quote/checkout/order creation. Published status, valid
  price, customer permission, selling-mode/legal-product constraints and independent
  purchase gates remain authoritative. Never mass-publish drafts or turn coming-soon
  or separately controlled preorder modes into normal sales accidentally.
- **Presentation acceptance:** cards/PDP/cart/checkout must not derive “Available
  to order”, “Backorder”, “In Stock”, “1 left” or “Available now” from quantity.
  Keep explicit genuine special-order communication independent. Align feeds and
  structured data with supported facts; sellability does not prove physical stock.
- **Security/data dependencies:** server and SQL share the effective policy and
  revision; stale quotes/cart submissions revalidate it. Do not add quantity1,
  fictional inventory, negative fake allocations or stock edits merely to sell.
  Reserve/release only real recorded allocations; payment/callback/idempotency and
  cancellation/refund guards remain. Unrecorded physical fulfillment/serialized
  custody needs an explicit truthful process under the active ERP owner.
- **Testing required:** all global × inherit/allow/restrict combinations; stock
  zero/null/unknown/insufficient/positive; variants, concurrent orders, stale quotes,
  retries, real-only cancellation release, published/draft/disabled and separate
  selling modes; EN/AR/RTL/themes/mobile and truthful structured data. Verify no
  stock-row mutation merely from enabling/saving policy. No such tests ran here.
- **Priority/dependencies/next:** P1, first after Beta; PROD-01/04, E12 and current
  checkout/payment contracts. No dependency edge to BETA-03/11. Current launch
  catalog/wording conflicts must be reported under BETA-06; this documentation
  neither activates the old labeling policy nor delays signup for new controls.

#### Requirement2 — PROD-06: Dashboard Products grid and list

- **Owner scope/status:** admin Dashboard only. Existing compact bounded table and
  responsive rows are in `app/pages/dashboard/products/index.vue`; a selectable
  grid/list pair is not qualified. Customer storefront layout is outside this task.
- **Acceptance:** quick display switch sharing one existing query/controller,
  editor links, URL/search/filter/sort/page state, current-page selection, sparse
  bulk commands, durable receipts and editor-return context. Reconcile selection
  safely when pagination/filter changes; never imply all matching products selected.
- **Tests/constraints:** EN/AR/RTL, Light/Dark/System, desktop/mobile, keyboard/focus,
  refresh/navigation/preference restoration, permission-denied and failed/empty
  requests. Persist a sensible per-admin/device view preference without leaking
  account state. Large catalogs remain server-paged/projected; no fetch-all, duplicate
  query stream or virtual inventory. Compare render/query budgets to the current list.
- **Priority/dependencies/next:** P2 post-Beta; PROD-02 and product-listing/bulk/save
  safety contracts. Reuse components/design; specify preference/selection behavior
  before implementation. Source inspection only, verified2026-10-25.

#### Requirement3 — CHAT-01: audit Live Chat before activation

- **Existing status:** conversations, messages, read/presence/typing/rate controls,
  customer/staff routes and Realtime client exist. `server/utils/liveChatAttachments.js`
  still uploads/downloads/removes bytes through Supabase Storage `chat-attachments`.
  This conflicts with the new VPS-only requirement; no hosted reliability/storage
  acceptance or chat activation is established by this source review.
- **Acceptance:** customer↔support message ordering/delivery, retries/reconnect,
  isolated conversation ownership, unread/read counts, notification behavior and
  mobile usage work with existing conversations preserved. Audit duplicate sends,
  stale responses, disconnects, background tabs and subscription teardown.
- **Private files:** all media/attachment bytes use deployment-configured private
  VPS roots and authorized streaming/downloads; Supabase may retain authorized
  metadata/Realtime only. Require authenticated authorized actors and conversation/
  message visibility checks on every read/write. Inventory existing anonymous-Auth
  visitor semantics before choosing activation policy; public file paths are denied.
- **Security/performance/tests:** validate type/content/size and multipart limits,
  safe generated paths/names, quotas, checksums, idempotent upload completion,
  retention/deletion/recovery and cross-customer/staff/anonymous denials. Bound
  message pages, polling/backoff, channel counts, timers, memory and upload buffering;
  benchmark active/idle/reconnect/mobile sessions without storefront slowdown.
- **Priority/dependencies/next:** P1 post-Beta; existing chat/RBAC/retention contracts.
  Audit current adapter and VPS transition privately; preserve old metadata/bytes
  until a separately reviewed migration, then qualify before explicit activation.
  Do not run a provider diagnostic, send notifications or move files now.

#### Requirement4 — DOC-01: Documents layout and storage usage

- **Existing status:** `app/pages/dashboard/documents.vue` has a file workspace and
  its own file-view panel toggle; Dashboard has separate navigation state. Do not
  confuse those controls. General document upload/download still references
  Supabase `admin-documents`; no true global VPS-usage total is qualified.
- **Layout acceptance:** use the available main area; desktop Dashboard navigation
  is expanded/visible by default on initial Documents entry. Preserve intentional
  manual collapse and appropriate preference. Keep the inner file navigation usable
  separately; mobile uses the existing accessible responsive/overlay behavior.
- **Usage acceptance:** show authorized total private media/document bytes near
  the bottom, readable units, calculation timestamp and stale/unavailable state.
  A never-calculated value is not zero. Define configured roots, pending uploads,
  duplicates/derived files/orphans and logical-byte versus capacity semantics;
  do not count legacy Supabase bytes as VPS usage without reconciliation.
- **Performance/security:** reuse a cached total or incremental accounting with
  bounded reconciliation, or an owner-configured nightly off-peak calculation.
  Configure time zone/cadence; no recursive VPS scan per request, unrestricted root
  walk, symlink escape or private path/list leakage. Summary permission must match
  its visibility scope. Preserve folder/document RBAC and existing records.
- **Testing/next:** sidebar first entry/manual state/EN/AR/RTL/themes/mobile;
  authorized total/timestamp/staleness, upload/delete accounting, interrupted jobs,
  large trees, permission denials and bounded request cost. P2 post-Beta; inspect
  provider coverage and design the accounting worker before implementation. No scan
  or storage migration now; this is not a new signup/checkout gate.

#### Requirement5 — ORDER-06 + ORDER-02: actual KG and private packing videos

- **Existing status:** authorized packing/confirmation and private VPS video
  upload/validation exist, with fixed `vps-v1/...` session/staff/order bindings.
  PDC configuration includes `default_weight_kg`; the requested persisted actual
  package-weight handoff is not qualified. Reuse ORDER-01 and private-video safety.
- **Weight acceptance:** staff enters actual packed KG for the correct order and
  package. Reject zero/negative/nonfinite values, wrong units and excessive precision;
  define exact decimal storage/conversion, provider-supported precision and bounds
  before coding. Save server-authoritatively with package identity, actor/time and
  revision; booking snapshots this actual value rather than silently substituting
  a default. Test decimals, units, rounding, multiple packages, stale edits/retries
  and concurrent confirmation. Never fabricate an actual measurement.
- **Shipment acceptance:** only explicit authorized Dashboard confirmation/booking
  can create a PDC shipment. Checkout/payment success creates none. No automatic
  pickup. Preserve real allocation, packing/video permission, existing references,
  uncertain-dispatch duplicate barriers and immutable booked-weight history.
- **Video acceptance:** new convention is
  `sessions/YYYY-MM-DD/ORDER-CODE/VIDEO-NAME-PACKERFIRSTNAME.mp4`.
  Use deployment time zone and server-derived safe order/staff values; include a
  dash followed by the actual packer's first name, plus collision-safe identifiers
  when needed. Block traversal, absolute paths, symlink escape and name spoofing.
  Metadata binds order/package/session, staff account, recording/upload times,
  private file location and duration/size when available.
- **Capture/storage decisions before implementation:** choose in-browser recording,
  existing-file upload or both; supported browser/device codecs, MP4 validation or
  bounded explicit conversion (never rename WebM as MP4), duration/size/concurrency/
  disk/CPU limits, retry/resume rules, access permissions and retention. Preserve
  existing limits unless separately reviewed. All bytes remain private VPS-only,
  with authorized Orders → Documents listing/playback/download; no Supabase bytes.
- **Compatibility/tests:** keep existing video bindings/paths readable; use a
  versioned adapter for new naming, with no bulk move/rename/relink now. Test
  staff/order isolation, first-name/collision/path cases, file content/size/duration,
  cancelled/interrupted recordings, authorized streaming/ranges and retention.
  P1 post-Beta; ORDER-02 is extended rather than duplicating the existing video task.

#### Requirement6 — DASH-01: simplify Settings navigation

- **Existing status:** `app/utils/dashboardNavigation.js` builds a Settings group
  with Store settings plus section children. This requested simplification is not
  implemented. Existing settings pages and permission contracts remain authoritative.
- **Acceptance:** clicking Settings opens Store Settings directly. Remove unnecessary
  sidebar nesting, while all existing configuration sections remain reachable
  through current settings surfaces/direct links. Preserve deep-linked tabs, active
  state, route guards/RBAC and allowed denied-role behavior; delete no configuration.
- **Tests/constraints/next:** map every existing settings key/route first; test
  direct entry and each deep link with permitted/denied roles, history/back,
  keyboard/focus, EN/AR/RTL/mobile/themes. P2 post-Beta, navigation-only scope;
  compact existing components, no general Dashboard redesign or permission bypass.

#### Requirement7 — DASH-02: Overview activity and live tile

- **Existing status:** `dashboard/analysis/CustomerExperience.vue` already renders
  Store Activity and a Live on Store metric. Overview uses existing summary/stat
  components. Reuse those functions/data rather than inventing a second analytics system.
- **Acceptance:** integrate Store Activity directly into Overview and show Live
  on Store in a small separate square/tile. Keep responsive compact layout, real
  authorized values, date/definition/freshness and loading/error/empty states.
  Unknown or unavailable metrics are not fabricated zeros or simulated live users.
- **Tests/performance/next:** preserve analysis access and existing data semantics;
  test EN/AR/RTL/themes/mobile, restricted roles, stale/error/reconnect states.
  Deduplicate fetches, bound polling/Realtime subscriptions and cache reuse; compare
  Overview query count/load time before/after. P2 post-Beta; define a reasonable
  refresh/load budget before moving the existing component.

#### Requirement8 — ERP-01: comprehensive Daftara API/data audit

- **Existing status:** code calls the provider Daftra; the owner also uses Daftara.
  `daftra.js`, `daftraSync.js`, credential storage, entity links and durable jobs
  exist. Current list wrappers cover selected resources; invoice export/issue code
  is not proof of full current provider support, valid credentials or live acceptance.
- **Read-only first:** privately inventory configuration presence/revisions and
  permission scope; never print credentials. Build an actual capability matrix
  from current provider documentation and approved account evidence, including
  customers/products/inventory/accounts/invoices/bills/payments. Label unsupported
  or unverified capabilities explicitly; do not assume endpoints from entity names.
- **Audit acceptance:** authentication/connectivity, retrieval, pagination/data
  caps/rate limits, field/account/currency/tax/customer/product/warehouse mappings,
  sync ownership/state, idempotency and uncertain outcomes, reconciliation,
  backoff/error handling, recovery and monitoring. Preserve all original ERP records.
- **Write boundary/tests:** classify endpoints by side effects, not just HTTP
  method. Existing sync can create/issue invoices; it is not a read-only diagnostic.
  First use synthetic fixtures/dry-runs and an explicit read-only allowlist. Any
  production send/create/update/invoice/payment needs a separate exact owner
  approval, test entity/mapping, durable receipts and reviewed recovery. No current
  credentials check or provider request is part of this documentation task.
- **Priority/dependencies/next:** P1 post-Beta; FUT-08, current encrypted secrets,
  adapters/jobs and ERP ownership. Inventory existing modules, then select one
  bounded read-only diagnostic; preserve production mode and records meanwhile.

#### Requirement9 — ERP-02: Local ERP ↔ Daftara switch

- **Existing status:** `erpState.js`, `useActiveErp`, navigation mode flags,
  `erpOwnership.js` guards and migration20261003120000 exist. The owner reports
  older-version switching has not been fully tested; source guards do not prove
  complete current UI/API/SQL coverage or safe live transition.
- **Acceptance:** Local mode retains relevant local modules. Daftara mode hides/
  disables incompatible Procurement/Suppliers and denies their writes in backend
  APIs/SQL/permissions, including stale tabs/direct requests/jobs. Define a complete
  module/domain/read/write matrix; retain compatible customer/shipping workflows.
- **Data/mode safety:** preserve historical local ERP records and authorized reads;
  never delete local data on switch. Provide clear active mode/health/status.
  Versioned authorized switching checks credential revision, mappings, queues and
  in-flight orders/reservations/jobs; no accidental duplicate sync or local writes.
  External outages never silently fall back to local ERP ownership.
- **Testing/recovery:** fixtures for Local→Daftara→Local, repeated/concurrent/stale
  mode changes, direct API and worker bypass attempts, provider downtime, queued
  effects and reconciliation. Define approved rollback/quiescence/recovery before
  live mode changes; avoid blind resync, finance writes or inventory recreation.
- **Priority/dependencies/next:** P1 post-Beta; ERP-01 capability evidence, PROD-04
  and existing RBAC/RLS/ownership contracts. Audit current routes/SQL guards,
  repair only proven gaps later, then separately qualify a reversible transition.

#### Requirement10 — MIG-04: Google ranking and legacy redirects

- **Existing status:** reusable canonical/hreflang/robots/sitemap/product-data
  foundation exists in `seo.js`, `usePageSeo`, `publicSeo` and indexing middleware.
  This is not evidence of current Google positions, Search Console access or
  completed WordPress→Nuxt redirect coverage. Expand original MIG-04, not a duplicate.
- **Evidence needed later:** read-only access to the verified Search Console
  property for the deployed canonical origin, or owner-authorized exports. Record
  property type/scope, observation/export date, comparison date ranges, query/page,
  search type and country/device filters. Obtain performance impressions/clicks/
  position trends where available, indexing/coverage/sitemap/structured-data issue
  exports and representative URL Inspection results. No passwords/tokens in docs.
  Without that access, label Google trends/positions/indexation **NOT MEASURED**;
  do not infer them from public HTTP or promise indexing/ranking.
- **URL acceptance:** read preserved WordPress URL/catalog links without running
  legacy code. Map product/category permalinks to the corresponding real published
  Nuxt identity, with exceptions for changed slugs/deleted/duplicate/missing targets.
  Propose valid one-to-one permanent redirects; preserve current URL conventions.
  Reject broken targets, chains/loops, open redirects, blanket homepage redirects,
  soft404s and private/draft leakage. Retired unmatched pages need an explicit
  correct404/410 policy rather than invented equivalents.
- **SEO acceptance/tests:** audit main products/categories and EN/AR canonicals,
  reciprocal hreflang, sitemap/robots/noindex, product structured data and real
  availability facts consistent with OD-20261025-STOCK-01. Test a bounded matrix of
  old/new/encoded/category/product/query/host-locale paths and redirect status/final
  targets offline first, then safe read-only public probes after scoped approval.
  Keep auth/account/dashboard private/noindex; do not request indexing or publish
  redirect rules as part of an evidence-only check.
- **Priority/dependencies/next:** P1 post-Beta; existing MIG-04 product identity
  mapping, published catalog and SEO foundation. Inventory exact old→new mapping
  and required GSC evidence; later present exception counts and a reviewed redirect
  plan. No Google/legacy-site/provider request or URL/config change now.

### L2. Post-Beta storage audit

| ID | Task | Priority | Status | Dependencies | Scope / acceptance | Evidence | Last verified | Next action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| STOR-01 | Supabase Storage versus VPS file-byte dependency audit | P1 | QUEUED | AFTER current public Beta milestone; owner read-only authorization | All six bucket counts/bytes/recency and ACTIVE/LEGACY/EMPTY; every active SDK/REST upload/read/signed URL/delete path, VPS workflow and private-access evidence; conditional integrity/backup/rollback migration plan only | E60; OD-20261026-STORAGE-01; docs/vps-storage-audit-plan.md | 2026-10-26 requirements only; production NOT AUDITED | Finish public Beta first, then execute targeted read-only audit; no changes, provider calls or invented bucket classifications |

### L3. Provider-neutral selected locations — offline work only

| ID | Task | Priority | Status | Dependencies | Scope / acceptance | Evidence | Last verified | Next action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| LOC-01 | Provider-neutral governed locations and dependent EN/AR selectors | P0 local milestone | LOCAL PASS | Separate96 source based on frozen95; no provider activation or coverage inference | Neutral core IDs/separate provider refs; controlled Dashboard preview/apply, server and SQL ID/parent validation, history/receipt preservation; defaultOFF | E62; OD-20261026-LOC-01; SHIP-02; docs/pdc-location-reference-review.md | 2026-10-26 local only | Keep96 separate/future sealed approval; original95 Beta remains next. Later hosted reference/selector acceptance stays open in DTR-19 |

### M. Risks and blockers

| Task | Actual blocker / why it matters | Evidence | Smallest next action |
| --- | --- | --- | --- |
| BETA-03 | E61 public signup OPEN; owner-only toggle and read-only postflight PASS; f5 consumed complete. | E61; E57 | Keep confirmation/CAPTCHA/login/recovery; purchasing held; preserve enabled signup in new95 guards. |
| MIG-01/02/03/05 | E37 history import/three-route change PASS; all41 receipts/original140 projections preserved, actual claims0. Hosted ordinary-owner acceptance pending; current matching verified identity has no orders. Three held identities/131 unlinked orders stay private. | E37; E36; E35 | Accept profile/empty view; order-bearing history needs approved signup. Never repeat source/deployment/import. |
| BETA-07 / SHIP-02 | E59 owner confirms Manual/all areas/EGP50; no business coverage blocker. | E59; OD-20261026-DELIVERY-02 | Configure through guarded Beta plan; PDC tracking separate/paused. |
| BETA-08 | E59 manual remedy/commercial closure local PASS; automation deferred. No real transfer/refund or automatic ledger acceptance claimed. | E59; OD-20261026-REFUND-02 | Review minimum evidence/consent/reconciliation process in the single Beta plan; no repeat merchant refund-access demand. |
| BETA-05 / CX-04 | E59 native public-mode two-owner/paid order proof PASS; deployed session isolation accepted. | E59; E57 | One scoped actual new-customer transaction, no repeated signup/profile or second paid order. |
| BETA-09/10/11 | E59 critical gates: guarded95 release/recovery, one new-customer transaction, staffed exceptions/kill switch and minimum manual remedy. | E59 | History/private housekeeping/notice/scheduler automation are deferred; accepted tests remain accepted. |
| LOCAL-08 | Main and original dirty worktree retain separate source/docs; exact combined archive is now deployed. Blind overwrite/merge can still lose prepared work. | E35; E23; source pins | Preserve1924ca0/724720a/40 original Beta files; consolidate only under separately reviewed source work. |
| BETA-06 / PROD-01 | E59 owner confirms catalog physically available/no counts;95 untracked mode local PASS. | E59; OD-20261026-STOCK-03 | Guarded95 release, no warehouse census or fake stock; exclude test product. |
| SHIP-12 | Original paid customer dispatch remains uncertain despite separate static success. Rebooking can create duplicate obligations. | E03; E08 | Preserve reference/barrier; reconcile original outcome without new shipment creation. |
| SHIP-03/04 | Draft tariff effective dates, current prices, Product40 terms, fee bases/rounding/suburbs unverified. EGP50 customer fee does not establish carrier cost. | E09; E10 | Review authoritative current commercial terms before tariff verification/import. |
| SHIP-07/10 | Dynamic paid/packed shipment acceptance and authenticated webhook cutover lack an eligible genuine linked REF/AWB; status/timezone questions remain. | E03; E04 | Review mapping/eligibility privately; no destination switch or static-AWB attachment. |
| FUT-01 / CONT-01 | Public smoke, local/native fixtures and owner reports have different evidentiary scope. External W files/private receipts are not durable main-branch source. | Evidence registry; E06; E21 | Preserve source hashes and consolidate reviewed documents/code during a separate milestone. |

Current E59 sequence: signup may open independently by exact owner approval; prepare
one95 untracked-sales/Manual50 release, one scoped new-customer transaction, then
conditional public CARD Beta activation. History inspection, private housekeeping,
notice polish, PDC tracking and scheduler automation are deferred. Accepted Auth,
cart isolation, payment/callback and packing results are retained. Existing data,
provider incident and callback authority are preserved; no shipment is automatic.

### N. Current next action — E62

Public signup is OPEN after exactf5 approval/owner toggle/read-only postflight.
[Activation receipt](public-signup-activation-receipt.md). Approval consumed complete;
no repeat signup, email, CAPTCHA or profile test. Preserve enabled signup and
confirmation/CAPTCHA/Brevo/origins/quotas. Purchasing remains held.

E62 offline location work and local commits are complete. The default-off96 source
and its data/edge routes need their own future sealed approval; original95 remains
byte-identical. [Deferred tests](DEFERRED_TEST_REGISTER.md) remain mandatory later.

The ONE purchasing milestone is [the guarded95 Beta plan](public-beta-minimum-launch.md):
source b37be43, default-safe stock-independent normal CARD sale and SKU packing,
Manual all-area delivery/EGP50, explicit recovery/kill switch, then one scoped actual
new-customer order/payment before conditional public opening. Local native15 tests,
typecheck and build PASS; candidate packaged. No target-bound executable Beta
approval until new95 operator/recovery and transaction budget are qualified/sealed.

### Historical E50 next-action text — superseded by E59

**Turnstile Auth acceptance complete for the tested scope. Next: guarded public signup launch readiness.**

- E50 [completed acceptance](turnstile-auth-acceptance-receipt.md): customer login,
  staff Dashboard login, recovery email and missing/invalid CAPTCHA rejection PASS.
  Exact7c1-request allowance executed/consumed;2f2-request allowance consumed.
  No repeats, further test email, Secret Key/configuration change or new Auth check.
- Public signup/purchasing remain DISABLED pending a separately approved launch
  milestone; PDC PAUSED. No activation phrase is ready or issued by Auth acceptance.
  Genuine new registration/confirmation has not been hosted-tested while signup is
  closed. Prepare one small signup-only plan and owner-controlled acceptance case,
  preserving existing Supabase accounts/CAPTCHA/redirects/confirmation/account isolation.
- Verify the existing historical owner profile/empty My Orders flow without calling
  it order-detail acceptance. Later order-bearing history needs an authorized actual
  verified customer, never impersonation, guest linking or an automatic claim.
  Keep original held/unlinked protections and separate purchase/provider gates.
- Read E45 app/runtime receipts and current Git/source audit before preparation;
  main has91 migrations, full source lineage94. Never rerun consumed7b/a8 operators,
  Auth helpers/imports or push/merge/reset/delete worktrees from historical notes.

- Read the [current exact release and readiness report](public-signup-release.md).
  [E41 deployment](public-signup-deployment-receipt.md) consumed the exact
  e9d1d4bb approval for5a38201292763325. Do not rerun apply or old-baseline check.
  The earlier notice-only574bb86 packet remains superseded/held. No new deployment
  approval is needed for this completed action; activation remains separate.
- The owner-controlled existing historical match has no orders. Owner performs
  ordinary My Orders → Connect previous orders → archived profile/empty list and
  refresh, reporting only the result. No account/password/claim action by Codex.
  Later order detail requires a legitimate authorized order-bearing customer;
  preserve all held/unlinked records and do not impersonate actual customers.
- E50 existing-account Turnstile Auth scope is ACCEPTED. CAPTCHA is enabled;
  the Secret Key remains only in Supabase. Do not repeat settings, successful
  owner tests, recovery email or consumed negative requests. Genuine new-customer
  signup/confirmation needs the next separately approved signup launch window.
  Accepted SMTP/recovery/confirmation stand; no403 investigation or test email.
- OD-20261026-AUTH-01 records owner-verified30/hour,60 seconds/address and30/5min/IP
  limits. Retain them for initial Beta; do not increase without observed demand,
  verified Brevo capacity and separate settings review. CAPTCHA is enabled and
  E50 tested existing-account Auth scope accepted; retain these limits.
- **ONE next purchasing milestone: BETA-07**, official PDC destination file and
  bounded mapping diff first. Retain separate EGP50/CARD/callbacks/zero-stock/
  Dashboard booking/manual refund/reconciliation/expiry/final real-order/closure
  gates under BETA-05–09/11/12. Do not bundle them or post-Beta work into signup.
- Production is5a38201292763325/schema94; e9d1d4bb code approval is consumed.
  Source70e929ee/deployment4c332350/
  import3c9f5764 and earlier Auth operators remain consumed; no replay or Git push.
  Current Beta stock contract is unchanged; OD-20261025-STOCK-01 stays post-Beta.
- Main retains current continuity; reviewed source is on the new isolated branch.
  Eleven worktrees preserve all original dirty bytes/refs. No broad merge or source
  switch. All88 task IDs (original79 plus9) remain.

### O. Change history and evidence preservation

| Date | Change / exact evidence boundary |
| --- | --- |
| 2026-10-01–15 | SEO/AI, provider/after-sales, product safety/import and installer milestones accumulated. Detailed reports retain each local/deployed/acceptance boundary. |
| 2026-10-17–20 | Browse-only launch, guarded Dashboard work and Ubuntu/Caddy/systemd restore superseded the older operational target. Owner restore/functional smoke differs from independent full security acceptance. |
| 2026-10-20 | Commerce foundation migrations83–85 deployed with purchases/providers held; private packing and COD foundations retained. |
| 2026-10-21–22 | Paymob/PDC foundations86–87, Modern Footer88 and Premium PDP89 deployed under separate receipts; later V6 lookup grant correction reached schema90. |
| 2026-10-23 | Tariff manager release `08b45ffac0e524c8`, schema91 deployed. Original broken retained-asset registry package stopped; approved repair deployed with byte checks. No business tariff import. |
| 2026-10-23 | Normal checkout/access corrections and later restricted releases replaced special-page testing. Consumed EGP101 scope was superseded by separately approved EGP2 opening/closure; do not reuse either. |
| 2026-10-23 | One real EGP2 card payment and signed-callback ledger reconciliation completed; owner performed checkout/3DS. Original PDC booking later entered uncertainty, preserving reference and duplicate barrier. |
| 2026-10-24 | User-Agent-only comparison established Node compatibility failure; generic header succeeded. One separate static VPS booking accepted. Dynamic customer workflow and original uncertain dispatch remain separate. |
| 2026-10-24 | Client correction release `2573cdf1504bf559` deployed at schema91, all gates held. Prior session artifact `9418a11903830ae5` became obsolete; never reuse its approval. |
| 2026-10-24 | Consolidated session release `58e3083f4aa6a1f8` deployed13:25 Riyadh; no SQL. Later two-account observation/owner switch report supersede old one-account text, without proving independent hosted orders. |
| 2026-10-24 | First webhook ingress install stopped because systemd lacked reload. Separate approved SIGUSR1 recovery completed15:00:56.337 Riyadh, unauthenticated POST401. Both operators consumed; provider cutover not accepted. |
| 2026-10-24 | Owner selected PDC/EGP50, legitimate backorders, approved special-order notice and mixed parcels shipped together. Historical identity/order imports deferred beyond Beta while preserving verified Supabase identities. |
| 2026-10-24 | W candidate/migrations92–93 locally qualified. SMTP management inspection403 and LIVE Refund/Void access remain unverified. Local review archive has no deployment/activation authority. |
| 2026-10-25 | Master roadmap created from main, later branch, W source and retained receipts. New requirements preserved under stable IDs. AGENTS/README/both handoffs receive additive pointers; no implementation, merge, production change or push. |
| 2026-10-25 | BETA-01 read-only preparation recorded configuration403 and prepared tests. Its configuration-access-first prerequisite is superseded by the priority reset below;403 never established broken SMTP. |
| 2026-10-25 | Owner priority reset: recovery for existing Test B first, controlled confirmation next, then customer/history migration before public signup/orders. Recovery email approved. Qualified local history implementation/dry-run extends preserved Beta source to94 migrations; no production deployment/import/activation or push. All79 task requirements remain intact. |
| 2026-10-25 | Owner reports successful Brevo recovery delivery, failed localhost redirect and old Site URL localhost/empty Redirect URLs. Exact four EN/AR entries documented; corrected save not independently observed. Actual login/installed SDK pass7 focused checks including PKCE recovery/confirmation callbacks. No app change, email, production write, deployment or push by Codex. Prior one-email scope consumed; next step save configuration, then freshly approved recovery. |
| 2026-10-25 | Owner-verified production recovery PASS supersedes the failed localhost attempt: correct sender, production reset, password changed, new-password login; all Auth URL values saved. AUTH-RECOVER-B-01 and BETA-01 transport ACCEPTED; BETA-02 remains IN PROGRESS for confirmation. New external mailbox selected privately, identity not yet created. Recipient-bound one-identity/one-email plan and disabled helper prepared; ten focused local checks PASS. No creation/send, configuration write, deployment/import, public activation or push ran. |
| 2026-10-25 | Explicit owner scope executed once: zero target/legacy email conflicts, one ordinary unconfirmed Auth identity/profile created via supported Admin API without invitation or supplied password, one genuine signup-confirmation/PKCE request accepted from a separate visible signed-out Chrome window. Confirmation timestamp recorded; owner receipt/redemption pending. Prior identity/profile/settings/order/payment/shipment fingerprints unchanged; signup/purchasing held. Both scopes consumed; retained browser/profile is for owner link redemption, not a retry. No deployment/import/public activation/push. |
| 2026-10-25 | Owner confirms mailbox receipt and account access; fresh read-only exact UUID/email/profile checks establish confirmation ACCEPTED. Brevo sendibt3.com/tr/cl rewriting recorded as Auth-specific tracking follow-up; no SMTP/provider change. Refreshed encrypted migration target has three confirmed customers; qualified payload/counts unchanged,12 source/31 evidence/91 migration hashes verified. Source/cutoff/exception packet sealed for owner review; no deployment/import/activation/push. |
| 2026-10-25 | Exact source/cutoff/exception approval70e929ee9934b1e04d149266819ef2e3403be2a3cd27c03491803ebf837608d8 recorded in a separate private receipt; original sealed packet/template retained.663 application inputs/all94 migration hashes frozen for local inactive release preparation. BETA-10 IN PROGRESS; no deployable archive/operator qualification claimed. Claims remain0; no deploy/import, production settings, email, activation or push. |
| 2026-10-25 | BETA-10 LOCAL PASS: exact inactive91→94 archivebc05eef266eeb7de and local operator724720a sealed under6474587b004ab0a5ac9d55e04e55f1e57a73760ced15b4dd26f3314a353a801d. Eight new tests/build/exact archive15 HTTP/1534 assets/8 browser checks and fresh restored-data upgrade/rollback pass; reuse existing69 Beta/20 history/typecheck. Auth/old commerce/callback safeguards, encrypted recovery/readback and saved-plan read-only check pass. Managed Vault0 rows excluded locally only. Production remains58e3083/schema91; signup/purchasing/providers closed; no deploy/import/push. All79 task IDs/worktrees preserved. |
| 2026-10-25 | Owner access/release requirements mapped to existing BETA-03/04/10/11 and MIG-01/03/05; all79 IDs/status counts preserved. Original-email verified signup/recovery, no incompatible hashes/current identity overwrite, ordinary My Orders claim/history and generic EN/AR login guidance specified. Notice is the next small release before public signup; sealed91→94/archive/approval unchanged. All seven worktrees/five branches inventoried;40 Beta files match preserved snapshot, four historical fixture files excluded. A deploy → B import/ownership → C signup → D PDC/checkout → E purchasing recorded. No app code, deployment/import/activation/email/push. |
| 2026-10-25 | Exact owner deployment approval6474587 recorded; final preflight STOP on catalog data newer than the sealed baseline. No execution intent/apply/migration/restart. Runtime/schema/Auth/other business projections unchanged. Same archive/app/operator retained; replacement workspace has fresh encrypted full-readback backup and actual native restore/91→94/rollback/replay-refusal PASS. Further catalog edits appeared between observations. Catalog-pause confirmation pending before replacement sealing/approval; no source reapproval. BETA-10 IN PROGRESS;79 IDs preserved, no production writes/import/activation/push. |
| 2026-10-25 | Owner confirmed catalog pause. Final paused snapshot captured45 fewer specs/45 more audit rows after E33 backup; other protected state unchanged. New encrypted backup/full readback and actual native restore/91→94/rollback/replay-refusal PASS. Same archive/app/operator sealed under replacement4c332350ae6fea14f9dabf1cc0b10d87750f5c2950fcff84b8538b570e1e9650; read-only seal preflight/saved local integrity PASS. BETA-10 LOCAL PASS, exact replacement deployment approval pending; old6474587 held before intent. All79 IDs/status counts preserved; no production write/deploy/import/activation/push. |
| 2026-10-25 | Exact owner4c332350 approval executed once: releasebc05eef266eeb7de/schema94 deployed21:31:49.255 Riyadh, atomic92–94/all140 original projections/Auth PASS, history/claims0, one restart, Caddy/runtime/media/private files unchanged. Fresh execution backup/full readback, candidate/gates and public9 HTTP/6 asset checks PASS. Prepared41-batch import check PASS read-only; owned history not exercised, anonymous public403 retained. LOCAL-01–06/BETA-10 DEPLOYED;79 IDs preserved, catalog pause may end. No historical import, signup/purchase/provider activation, email or push; separate eligibility/import/signup/purchasing gates remain. |
| 2026-10-25 | E36 final source-bound eligibility/payload sealed for ONE import approval3c9f5764:516 customers/591 orders/6 refunds/1789 items/702 events;513 conditional identities (1 current verified/512 future signup),3 held;131 unlinked orders remain private. Fresh exported-snapshot encrypted recovery/full readback and native94 restore/final41 shared-helper batches pass,140 original projections preserved; ordinary EN/AR component/denial/replay/immutability tests and seven operator checks PASS. One-line three-route Caddy proposal/parser/diff qualified but not applied; exact approval includes at most one signal, no app/schema deploy. Operator de5c414 committed locally;663 application inputs unchanged. Live seal read-only PASS; false template/no approval receipt/intent/import/routing write/Auth creation/email/provider/public activation/push. All79 IDs/status counts preserved. |
| 2026-10-25 | E37: exact owner3c9f5764 approval executed once23:07:33.882 Riyadh, historical import PASS.41 batches/516 customers/591 orders/6 refunds/1789 items/702 events;513 conditional identities/3 held, actual claims0. All140 original projections preserved per batch and unchanged in independent post-import comparison; three confirmed users/profiles intact. Fresh encrypted execution backup/full readback (11043268 DB bytes/10 files), full immutable-record reconciliation and11 independent route checks/Auth gate checks PASS. Three exact history routes loaded/one Caddy SIGUSR1/same PIDs/0 app restart or schema deployment; other runtime files/signed callbacks preserved. MIG-01/02/03/05 and BETA-04 DEPLOYED, hosted ordinary acceptance pending; all79 IDs retained. No Auth creation/password/current-commerce/email/provider/public activation/push. Import consumed; next small EN/AR notice release before signup. |
| 2026-10-25 | E38/E39: ten owner post-Beta requirements recorded in full, original79 task IDs retained and9 new stable IDs added (88 total). OD-20261025-STOCK-01 supersedes automatic zero-stock special-order labels as planning policy; normal stock-independent selling is distinct from backorders, no code/settings/inventory change. Existing ORDER-02/MIG-04 extended; FUT-08/09 delegate focused scope. P0 signup/paid checkout unchanged; all ten remain post-Beta. Complete local read-only Git audit found9 worktrees/6 branches, source/main divergence, local-only commits and unique detached context; reviewed documentation committed locally, unrelated Auth source/dirty fixtures preserved. No fetch/merge/rebase/cherry-pick/switch/cleanup/push, implementation or production/provider action. |
| 2026-10-26 | E40 / OD-20261026-AUTH-01: prepared one replacement EN/AR returning notice plus optional Turnstile app release; customer signup/login/reset and Dashboard password login supported without RBAC/design change.28 focused/33 current local security-session checks incl A/B browsers/6 guards/native94 retained PASS; exact archive5a38201292763325/36 screenshots/1640 asset bytes, official public dummy widgets only. Owner verified30/hour/60s and30-per5min/IP limits, CAPTCHA/leaked-password protection off; keep30 initially, no Management API403/SMTP repeat. Existing historical match bound read-only to owner-accepted recovery account,0 orders; hosted profile/empty view and authorized order-bearing acceptance pending, no impersonation. First notice-only seal held/unapproved, original9 worktrees preserved plus2 isolated additions; current source3001cd6. Exact inactive release recovery/seal in report; no production deployment/activation, Auth/password/claim/email/payment/shipment or push. BETA-03 BLOCKED for actual widget/configuration/hosted acceptance; all88 IDs retained. |
| 2026-10-26 | E41 exact ownere9d1d4bb approval executed once. Notice/optional Turnstile release5a38201292763325/source3001cd6 completed2026-10-26 02:02:04.416 Riyadh; schema94 unchanged,0 SQL/1 app restart. Exact read-only preflight, fresh execution encrypted recovery/full readback (12822782 DB bytes/10 files), private candidate,1533 retained assets and schema/Auth/business/history/ownership/public postflights PASS. Runtime/Caddy/credentials/media/private files/signed callbacks unchanged; signup/notice/CAPTCHA config/purchasing/provider initiation held. Approval CONSUMED_COMPLETE, no rerun/retry/rollback, Auth/password/claim/email/import/provider/worker/push action. Local qualification reused, no rebuild. BETA-03 activation still BLOCKED for real public widget binding/separate config/hosted acceptance;88 tasks retained, both handoffs updated. |

Non-sensitive fingerprints captured during this review:

| Evidence | SHA256 |
| --- | --- |
| E01 private deployment receipt | `d4aad8cda7ee18810223f605a387086a04bdf4734187f0cda32f62649bca55a1` |
| E03 private client deployment receipt | `c88128ad7fbf46547d25136b134d549da01e7ced0488ac01e935955f2ecce162` |
| E04 private signal execution receipt | `02539b4f7d62a010669809313c4be5738102fcfb3cb39d3be324cce4adc34c2f` |
| E06 private validation.json | `5f9ef44c33d8ffd91b3fcf7b18cdf6041e79ee6bba975e1c568ae3f1dfe5c6e3` |
| W Beta candidate guide | `66e262939dc9791804f42bb14d91a64854ddf196c861902c80433c43c7830b58` |
| W manual refund guide | `66a1194c421bd92a87912fb65cd222426ea5cd756b0e2a90d9808f00e8186fe2` |
| W migration92 | `bb2f5f3c137f10d22a9810c9ccfe2710a768fdbe7c772ac7b57e48e1fe74c470` |
| W migration93 | `09b87054c66f1f35e49b1d25292e795570dadb03123b98da28348f94bc550987` |

Recompute fingerprints when intentionally updating evidence. Preserve previous
release/incident references privately. This index includes no customer names,
emails, addresses, order/AWB identifiers, credentials or raw incident payloads.

| 2026-10-26 | E42 / OD-20261026-AUTH-02: owner public Site Key/Managed/canonical hostname received; secret kept private. Actual deployed-origin anonymous tab widget PASS,6 Cloudflare requests/token boolean only,0 Auth submissions/production writes; owner-observed failed local preview retained without diagnosing cause.29 new focused checks PASS; all759 app inputs identical to deployed3001cd6 incl session isolation,94 migrations; no new app deployment. New isolated runtime-only operator9d6508c permits2 public env values/1 restart, fresh encrypted12835600-byte DB/10-file runtime recovery/full readback and sealing read-only checks PASS. Seala8aec16a72d59972812a459c00b3e7b1029c6ebe8257e60e3ef642b03ce66c67 ready/pending, expires09:24:22.724 Riyadh; no intent. Supabase enforcement/hosted Auth/ordinary signup still separate, public signup/purchases/PDC held. Original11 worktrees/79 opening dirty bytes and heads/indexes preserved;12 total/9 branches, original46 source paths/detachedc3775e8 intact, main91 remains. All88 task IDs/statuses retained, both handoffs updated, no push. |

| 2026-10-26 | E43: exact ownera8 frontend-config approval executed once/exit1/consumedSTOPPED. Initial preflight PASS; fresh DB12839012-byte authenticated/full readback, runtime recovery failed before tar from omitted archive_bytes. No candidate/staging/runtime mutation/restart; pinned read-only03:36:32.931 proof preserves exact release/process/runtime/Caddy/output/media/private/schema94/Auth/history/ownership. Public values empty, signup/purchases/PDC closed. No retry/rollback/provider/Auth action/push; original evidence/tools frozen. |
| 2026-10-26 | E44: isolated31ecdd2 fixes read-only backup adapter without changing sealed activation plan; actual shared remote regression plus30 focused checks PASS.759 application inputs incl session isolation identical to deployed3001cd6/schema94. Replacement frontend-only packet7b9038186919a03ca16138845e90642dffdc53a49cd0eaa303654fdc9a413f15 sealed/ready/pending/no intent; fresh12839997-byte DB/10-file runtime full readback verified03:40:02.140/expires09:40:02.140 Riyadh. Same2 public values/1 restart requires NEW exact approval because first attempt is consumed. All12 opening worktrees/source preserved;13 total/10 branches, original46 source paths and detachedc3775e8 retained. All88 IDs/statuses and both handoffs updated, no production configuration/enforcement/signup/purchasing/PDC activation or push. |

| 2026-10-26 | E45 exact owner7b frontend approval executed once/exit0/PASS/CONSUMED_COMPLETE, receipt03:48:38.214862 Riyadh.2 public runtime values/root0600/1 app restart, same5a/source3001cd6/schema94. Fresh execution12841108-byte DB/10 runtime files encrypted full readback, private candidate and mandatory preservation/public postflight PASS.30 focused/unchanged artifact/session/native94/build proof retained. Real configured EN/AR320 RTL Dark recovery/actual Dashboard password-form tokens/translated labels qualified; inspection-only locale/selector omissions corrected with incomplete proof retained. No Auth submissions/secret/Supabase setting/email/account/password/claim/payment/shipping/push. Signup/purchases/PDC/notice held, server enforcement off; operator/check never rerun. |
| 2026-10-26 | E46 prepared owner-manual Supabase Turnstile enforcement acceptance plan2f716d6351e8dc638817af08f2776792796fd79fef66b8c933174d074ed67f34; separate exact approval pending. Secret entered directly in Supabase only after approval, max2 public-anon no-email negative Auth requests after owner configuration confirmation, existing owner customer/staff logins/max1 recovery email/no redemption/password change; manual CAPTCHA disable once on legitimate lockout/stop review. No new users/claims/public signup/purchasing/PDC/runtime/schema/provider/SMTP/quota/push action. No setting/secret/Auth request performed now. All88 IDs/statuses/13 worktrees/10 branches and both handoffs preserved/updated; main91 vs deployed94 retained. |

| 2026-10-26 | E47 owner exact2f enforcement acceptance approval received and owner reported CAPTCHA enabled, Secret kept in Supabase. Fresh read-only preflights PASS (same5a/process/runtime/schema94/759 inputs, protected schema/Auth/business/history/ownership, public settings/gates). Exactly2 anonymous no-email negative password requests/no sessions: first missing token400 with unretained reason, helper stopped; native SDK contract review found diagnostic omitted API-version header, storefront unaffected. Only the unused distinct approved invalid-token case ran once after review,400/captcha_failed/no session PASS; no missing retry/helper rerun/third request.3 guard+4 SDK/error/public-key tests PASS; diagnostics/key-format pre-request failures retained, no production source change. Positive owner customer/staff/recovery results and missing-token reason qualification pending. No agent settings/ManagementAPI/secret/email/account/password/claim/providers/public signup/purchasing/PDC/push; all88 IDs/statuses and both handoffs retained. |

| 2026-10-26 | E48 prepared one-request missing-token qualification7c232640a8433b84a167e0bfea6a59cd5ad0cb21337e2d9441417a31f7087017; native SDK missing payload/API-version mocked-fetch test PASS. Requires pending owner positive customer/staff/recovery acceptance and new exact one-request authorization; no third request, key entry, settings/deploy/restart/provider/signup/purchasing/PDC/push. E47 original budget stays2/2 used and first denial reason remains unqualified. All88 IDs/statuses preserved; both handoffs updated. |

| 2026-10-26 | E49 owner customer login PASS/Dashboard PASS/recovery email RECEIVED, each applicable test once in fresh private windows without password/credential changes. Recorded owner-observed hosted functional acceptance; no session inspection or repeat test/email. Fresh read-only evaluation same5a/runtime/process/output/759 inputs and closed signup/purchasing gates,0 new Auth password requests/emails/settings/deploy/restarts. Full Turnstile closure still has missing-token-specific reason gap; E48 positive prerequisite satisfied, one separately approved request now next, original2f2/2 allowance consumed with evidence gap/no retry/third request. Public signup/purchasing disabled until separate launch/PDC paused per owner. All88 IDs/statuses, both handoffs/13 worktrees/10 branches preserved; main91 vs correct94 source, no push. |

| 2026-10-26 | E50 exact owner7c one-request qualification executed once/exit0/PASS at11:51:32.836 Riyadh,400/structuredcaptcha_failed/no session. Exactly1/1 new scope,0 email/Secret/settings/deploy/restart/schema/provider/activation/push. Fresh disabled signup/required confirmation/configured key and CartCheckout403/history401 pass. E49 owner customer/staff/recovery plus E47 invalid denial and this missing denial accept all five bounded existing-account Auth cases. Original2f2/2 and separate7c1/1 consumed; original STOP/unqualified receipt retained/no rerun/retry. BETA-03 remains BLOCKED for separate public-signup launch readiness/genuine new registration and historical acceptance, not a CAPTCHA gap. Same5a/source3001cd6/schema94/759 app inputs, all88 task IDs/statuses and both handoffs preserved. Public signup/purchasing disabled until separate approval, PDC paused. |
