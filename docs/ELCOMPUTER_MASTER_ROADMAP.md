# ELcomputer master roadmap

Authoritative development and continuity index for both Codex accounts.
Last evidence review: **2026-10-25, Asia/Riyadh**.
Latest production evidence: **2026-10-25**, owner-verified recovery/confirmation
plus read-only identity, release/schema/gate checks and fresh backup evidence.
Other release/acceptance evidence retains its original date and scope.

**Priority: public paid Beta. Production purchasing and registration remain closed.**
Latest recorded production: **`bc05eef266eeb7de`, schema94**, deployed
2026-10-25 at21:31:49.255 Riyadh. The combined Beta/history application is live
inactive for public commerce; the historical import subsequently passed at
23:07:33.882 Riyadh. Prior58e3083/schema91 is retained.
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

Current owner priority: **A inactive deployment → B historical import/verified
ownership → C public signup/login → D PDC/paid-checkout acceptance → E public
purchasing.** Existing customer login/recovery stays available. The next small
release adds EN/AR returning-customer guidance beforeC; it does not change the
sealed91→94 archive. [Requirements, copy and pending-work inventory](customer-access-release-plan.md)
extend existing tasks. Email acceptance is complete; no repeated investigation.

**Latest owner decisions:** all ten additional workstreams are **POST-BETA**.
They do not gate public signup or paid checkout. Stock-selling controls are first
among post-Beta work; unrestricted selling is independent of backorders. Zero
recorded stock must not itself produce stock quantities, availability claims or
special-order labels under the new policy. Current code/settings remain unchanged.
See [the ten requirements](#l1-ten-owner-requirements--post-beta) and
[Git handover audit](GIT_WORKTREE_SYNC_AUDIT.md). This milestone is documentation
and local read-only inspection only; no feature/provider/production action.

**88 tracked tasks: all original79 retained, plus9 new stable IDs.**
Priority: P0 29; P1 40; P2 18; PARKED 1.
Status: PLANNED 40; IN PROGRESS 0; LOCAL PASS 6; DEPLOYED 23;
ACCEPTED 4; BLOCKED 11; ON HOLD 4. Count each task row once;
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
| Application | E35: `bc05eef266eeb7de`, activated2026-10-25 at21:31:49.255 Riyadh, systemd storefront active after one restart. Exact4c332350 approval consumed; never rerun. Old58e3083 retained for separately reviewed application recovery. |
| Schema | E35:94 exact migration identities verified; only92–94 applied atomically, original91 ledger preserved. History schema/RLS/service-only RPCs installed. E37 imported516 customers/597 order-refund records/1789 items/41 batches; claims0. Main retains91 files; qualified/deployed source1924ca0 contains94. |
| Storefront | E35 current runtime/public smoke PASS: EN/AR home/login200, Cart/Checkout403, six retained/fresh asset bytes match. Earlier local exact archive/browser evidence retained; no new hosted browser/order acceptance inferred. |
| Dashboard/accounts | E35 preserves all three current confirmed customer profiles/Auth security and existing order data. Existing Dashboard/product/profile and owner switch acceptance retained; independent hosted order-isolation/RBAC/owned-history acceptance remains pending. |
| Public gates | E35 live Auth/signup disabled, confirmation required; purchasing/grants/Paymob/PDC initiation closed. Cart/Checkout403. Anonymous history GET/claim POST and capabilities403 publicly; private candidate denied401 and flags false. E37 loads three exact history routes: anonymous/invalid token401, disallowed methods/source403. Hosted owned acceptance pending. |
| Paymob | Existing LIVE card credentials retained privately. One EGP2 sale succeeded through normal checkout and signed-callback reconciliation. Keep exact signed POST ingress, original keys and owned receipt/status reads available for late events. No new initiation authorized. Refund/void readiness unverified. |
| PDC | Product40 preferred; provider configuration may be enabled while outbound runtime gates remain closed. Generic User-Agent and dated status lookup correction deployed in `2573cdf1504bf559`, preserved by E01. One production static API booking succeeded; normal dynamic Dashboard booking remains unaccepted. Original uncertain dispatch remains guarded. |
| PDC inbound security | E04: exact POST ingress loaded at15:00:56.337 Riyadh on 2026-10-24. Missing-secret probe401; no authenticated callback or registration change. Earlier pending-reload STOP is resolved. Provider mapping/timezone/cutover remains blocked. |
| Delivery/tariffs | PDC configured checkout company; current EGP1 fee unchanged. Configurable EGP50 support is deployed inactive; owner-approved50 setting remains unapplied. No business tariff import/checkout tariff activation. Shipment initiation remains closed and booking administrator-controlled. |
| Notifications / recovery | Central Brevo adapter/SMS remain dormant per prior evidence. Auth/Brevo recovery and controlled confirmation ACCEPTED; production redirect/account access passed. Site URL/four redirects saved. Effective abuse limits/tracking follow-up remain for public signup readiness. No agent settings/transport change. |
| Recovery | E35 fresh encrypted execution backups:10935391 DB plaintext bytes/10 runtime files, authenticated decryption/full readback PASS. Sealed target backup restored locally with91→94/rollback/replay-refusal PASS (Vault0 excluded locally only). Keep schema94 after committed SQL; never restore over newer users/data. E37 adds authenticated/full-readback execution backup11043268 DB bytes/10 runtime files before the successful import, retaining E36 native94/final41-batch recovery proof. Consumed import must not be retried. |

Production details retain their individual evidence dates. E22 was bounded
read-only preparation. E35 is the separately authorized inactive deployment,
with schema/application changes and explicit preservation checks. It is not full
production/provider/owned-history acceptance. No public gates or provider flows
were activated; accepted Auth evidence retains its original owner-verified scope.

### C. Completed and deployed features

Acceptance applies only to the scope named in each row.

| ID | Feature / workstream | Priority | Status | Owner decision / dependency | Done / acceptance | Evidence | Verified | Next action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| DONE-01 | Storefront, EN/AR, RTL, SEO, brands and AI discovery foundation | P1 | DEPLOYED | Preserve current publication/privacy rules | Retained release reports and source establish these foundations; no claim of every hosted route's acceptance | E14; app/pages; server/routes | 2026-10-25 | Maintain through Beta regression checks |
| DONE-02 | Customer account/profile and secure entry improvements | P1 | DEPLOYED | Ordinary Auth/RLS; E15 access approvals consumed | Account pages/profile access deployed; historical owner page checks preserved | E15; R:app/pages/account/profile.vue | 2026-10-25 | Complete BETA-05 using authentic sessions |
| DONE-03 | Customer cart, checkout, recovery and stale-session isolation | P0 | DEPLOYED | E01 approval consumed; owner switch report is bounded | Account-scoped state and stale-response guards deployed; independent order creation still pending | E01; E05; R:app/composables/useCustomerScope.js | 2026-10-25 | Run BETA-05 after approved candidate deployment |
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
| BETA-03 | Public registration abuse controls and readiness | P0 | PLANNED | Email accepted; migration safeguards and signup approval pending; notice follows inactive deployment before public signup | Normal signup/login/recovery; EN/AR original-email/new-password notice and Forgot Password guidance; generic failed-login help without identity lookup/disclosure; responsive/RTL/themes; restrictive origins/verification/abuse controls and Auth tracking follow-up | E32; E23; E28; current Auth/source contracts | 2026-10-25 | Release only the small returning-customer notice afterA/beforeC; accept original-email self-service path, then request signup approval; preserve sealed91→94 |
| BETA-04 | Legacy-customer identity protection for Beta | P0 | DEPLOYED | Final source-bound eligibility approved/imported; hosted ordinary-customer acceptance pending | 513 conditional identities/3 held, claims0; three current users/credentials/profiles preserved; original registered-email verification and explicit runtime claim required; no guest-email linking | E37; E36; E32; E23 | 2026-10-25 | Accept existing matching customer profile/empty view; order-bearing acceptance needs approved ordinary signup; never repeat import |
| BETA-05 | Authentic A/B customer-order/session acceptance | P0 | BLOCKED | Candidate deployed inactive; exact bounded access approval | Same-browser/two-tab customer data isolation, independent owned orders/recovery, denied cross-account access; held cases remain held | E05; E06 | 2026-10-25 | Prepare no-charge two-existing-account window; intention ingress closed |
| BETA-06 | Legitimate publishing and fulfillment catalog | P0 | PLANNED | Owner reviews actual products/prices/fulfillment; OD-20261025-STOCK-01 is the latest labeling decision | Only legitimate published products; no fabricated stock, mass draft publication or quantity-derived availability promises; separate true special-order behavior from post-Beta unrestricted selling | E38; E06; E07; E12 | 2026-10-25 | Review supported launch catalog/accurate terms; identify any candidate label conflict explicitly without pulling PROD-05 into Beta |
| BETA-07 | Official PDC destinations and EGP50 configuration | P0 | BLOCKED | Updated official owner location file missing; LOCAL-07 unapplied | Validate exact IDs against accepted cache, approve bounded diff and supported destinations; apply configurable50 separately | E06; E09; REQ | 2026-10-25 | Obtain official file privately and prepare review-only mapping diff |
| BETA-08 | Merchant refund/cancellation and stock-reconciliation readiness | P0 | BLOCKED | LIVE Refund/Void entitlement unverified; owner finance decision | Confirm merchant access read-only; approve full-refund procedure/private operation log and actual-stock disposition; no status-only refund claim | E06; W:docs/beta-refund-operations.md | 2026-10-25 | Inspect existing successful transaction read-only; submit no money action |
| BETA-09 | Expiry scheduler, exception monitoring and closure | P0 | PLANNED | LOCAL-03 deployed; dedicated secret/loopback scheduler | Bounded worker, repeat-safe releases, late-callback review,15-minute Beta monitoring; closure stops new orders while preserving receipts | E06; E07 | 2026-10-25 | Prepare scheduler/runbook/alerts without installing or activating |
| BETA-10 | Guarded inactive schema91→94 deployment preparation | P0 | DEPLOYED | Exact replacement4c332350 approved/executed once; catalog pause may end; seal consumed | Releasebc05eef266eeb7de/schema94 active, atomic92–94, all140 original projections/Auth preserved; backups/candidate/RLS/gates/public smoke PASS, history/claims0 | E35; E34; E33; E31 | 2026-10-25 | Never rerun consumed apply; E37 historical import/three-route change also completed; ordinary acceptance/notice/signup are next |
| BETA-11 | Normal CARD checkout and guarded public activation | P0 | BLOCKED | Email, migration safeguards, catalog/delivery/refund/final order acceptance; separate import/signup/purchasing approvals | Normal verified customers can order CARD-only; preserve Paymob signed authority, fixed configurable50 and admin-controlled PDC booking | E23; E02; E06; owner priority reset | 2026-10-25 | Complete migration/signup sequence, then enable purchasing last under exact approval |
| BETA-12 | Preserve LIVE payment, 3DS and callback reconciliation | P0 | PLANNED | DONE-04 retained; no incidental repeat charge | Candidate preserves HMAC/context/idempotency and owned reads; any new real sale has separate authorization and durable reconciliation | E35; E02; E06; server/utils/payments | 2026-10-25 | Preserve verified source/DB/ingress bindings; collect reconciliation on the next separately approved real sale, no incidental repeat charge |

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
| PROD-01 | Configurable zero-stock purchasing and truthful fulfillment | P0 | LOCAL PASS | Existing Beta backorder implementation is distinct from new post-Beta PROD-05; latest owner labeling decision applies | Preserve real allocation/paid procurement/release/cancellation safeguards; do not misrepresent this older coupled backorder option as unrestricted normal selling | E38; E06; E07; REQ | 2026-10-25 | Accept the existing approved Beta scope; record labeling conflicts in product review, never invent quantities or block signup on PROD-05 |
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
| SHIP-02 | Official city/governorate IDs and searchable selectors | P1 | BLOCKED | BETA-07 owner file; accepted cache and exact matching | Validate official file/diff; selectable exact IDs; reject duplicates/ambiguity and unsupported destinations | E06; REQ | 2026-10-25 | Receive updated file; keep API cache and tariff zones distinct |
| SHIP-03 | Six-zone tariff verification and bounded draft import | P1 | BLOCKED | Effective date, Product40 applicability, rounding, bases/suburbs unverified | Owner confirms current prices/fee/VAT/surcharge rules; exact company/version import remains inactive until separately accepted | E09 | 2026-10-25 | Review owner package against authoritative current terms |
| SHIP-04 | Carrier cost, customer price, subsidy and rounding rules | P1 | PLANNED | Separate C1; verified tariffs and explicit owner strategy | Fixed/percentage/full-cost rules, optional cap, integer money/rounding and immutable cost/subsidy snapshots; no inferred fees | E10; REQ | 2026-10-25 | Specify pricing unit separately from Beta's fixed50 |
| SHIP-05 | Returning-customer free shipping and next-purchase promotion | P2 | PLANNED | Separate C2; owner eligibility/expiry/cancellation policy | Prior paid qualifying purchases; locked one-use grants; no double spend, perpetual regrant or unverified imported eligibility | E10; REQ | 2026-10-25 | Choose unlimited-repeat versus one-time policy explicitly |
| SHIP-06 | Private PDC PDF label templates and retrieval | P1 | PLANNED | Genuine assigned AWB; approved template and VPS directory | Authorized explicit PDF retrieval, safe validation/storage/viewing; diagnostic AWB never attached to customer order | E03; E13; REQ | 2026-10-25 | Qualify existing label path with separately approved real linkage |
| SHIP-07 | Normal Dashboard dynamic booking and tracking acceptance | P1 | BLOCKED | No eligible paid/packed unbooked customer candidate in latest packet | Exact-order approved Product40/weight booking, original REF/AWB linkage, private PDF and dated status; manual pickup | E03; E08; REQ | 2026-10-25 | Select legitimate eligible order read-only; do not reuse uncertain order |
| SHIP-08 | Date-filtered GetShipmentsStatus polling | P1 | DEPLOYED | New polls remain separately authorized | Required valid dates and matching saved-job lifetime deployed; no blind retries; live owned tracking acceptance incomplete | E03; R:server/utils/pdcLookups.js | 2026-10-25 | Reuse correction; accept polling within SHIP-07 |
| SHIP-09 | Manual pickup and optional daily pickup policy | P2 | PLANNED | Default manual; later explicit owner automation decision | Preserve no-pickup-scheduler default; define provider behavior and opt-in controls before scheduling anything | E03; REQ | 2026-10-25 | Document actual manual process; defer daily automation |
| SHIP-10 | PDC authenticated webhook mapping and provider cutover | P1 | BLOCKED | Mapping/timezone review and genuine assigned customer REF/AWB | Secret auth, exact match, deduplication/date ordering/status projection accepted; neutral unresolved IDs; separate destination approval | E04; pdc-webhook-cutover-plan.md | 2026-10-25 | Resolve account-specific status/timezone questions; do not register provider |
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
| CX-04 | Cart persistence, recovery and multi-customer security acceptance | P0 | BLOCKED | DONE-03 deployed; BETA-05 held paths and authentic sessions | Positive basket separation, refresh/two-tab/recovery/late-response cases accepted; do not infer pass from empty carts | E05; E06 | 2026-10-25 | Complete BETA-05 evidence; preserve per-customer pending commands |
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
| PROD-05 | Global/per-product normal selling without stock restriction | P1 | PLANNED | First post-Beta; OD-20261025-STOCK-01; price/publication/ERP/inventory contracts | Explicit global default and inherit/allow/restrict product override; server-authoritative normal purchase despite zero/unknown/insufficient quantity, no quantity-derived claims or fake inventory | E38; L1 requirement1; PROD-01/04; E12 | 2026-10-25 | Design policy/revision and genuine allocation/cancellation rules after Beta; no toggle or stock change now |
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

### M. Risks and blockers

| Task | Actual blocker / why it matters | Evidence | Smallest next action |
| --- | --- | --- | --- |
| BETA-03 | Controlled confirmation/recovery ACCEPTED; inactive94 deployed. Returning notice/generic help, public self-service/abuse and tracking follow-up remain. | E35; E32; E28 | Prepare the small notice before signup; retain deployed migration safeguards and complete scoped signup approval separately. |
| MIG-01/02/03/05 | E37 history import/three-route change PASS; all41 receipts/original140 projections preserved, actual claims0. Hosted ordinary-owner acceptance pending; current matching verified identity has no orders. Three held identities/131 unlinked orders stay private. | E37; E36; E35 | Accept profile/empty view; order-bearing history needs approved signup. Never repeat source/deployment/import. |
| BETA-07 / SHIP-02 | Updated official location file missing. Free text,411-city API cache and six-zone tariffs are different evidence; unsafe mapping can accept unsupported delivery. | E06; E02 | Obtain official file, validate exact IDs and present bounded diff. |
| BETA-08 | Merchant LIVE Refund/Void access and procedure not accepted. Local cancellation does not return funds. | E06 refund guide | Inspect intended LIVE merchant permissions/current transaction read-only. |
| BETA-05 / CX-04 | Switching and Test B recovery are owner-accepted; independent hosted order/cart/cross-account cases remain incomplete or held. | E05; E06; E25 | Preserve recovery PASS; use a bounded existing-account order/session acceptance window later. |
| BETA-09/10/11 | E35 inactive deployment complete. Public activation still requires owned-history/signup, scheduler/monitoring, catalog/delivery/merchant refund and final order acceptance. | E35; E06; E07 | Keep gates closed and prepare each remaining bounded acceptance/approval; never rerun deployed4c332350. |
| LOCAL-08 | Main and original dirty worktree retain separate source/docs; exact combined archive is now deployed. Blind overwrite/merge can still lose prepared work. | E35; E23; source pins | Preserve1924ca0/724720a/40 original Beta files; consolidate only under separately reviewed source work. |
| BETA-06 / PROD-01 | Catalog review is not publication or physical inventory. Private review found239 model rows,223 normal product candidates; test stock records do not prove real units. | E06 | Owner reviews exact products/prices and eligible truthful backorders; no dummy stock. |
| SHIP-12 | Original paid customer dispatch remains uncertain despite separate static success. Rebooking can create duplicate obligations. | E03; E08 | Preserve reference/barrier; reconcile original outcome without new shipment creation. |
| SHIP-03/04 | Draft tariff effective dates, current prices, Product40 terms, fee bases/rounding/suburbs unverified. EGP50 customer fee does not establish carrier cost. | E09; E10 | Review authoritative current commercial terms before tariff verification/import. |
| SHIP-07/10 | Dynamic paid/packed shipment acceptance and authenticated webhook cutover lack an eligible genuine linked REF/AWB; status/timezone questions remain. | E03; E04 | Review mapping/eligibility privately; no destination switch or static-AWB attachment. |
| FUT-01 / CONT-01 | Public smoke, local/native fixtures and owner reports have different evidentiary scope. External W files/private receipts are not durable main-branch source. | Evidence registry; E06; E21 | Preserve source hashes and consolidate reviewed documents/code during a separate milestone. |

The owner's required sequence is inactive deployment, historical import/verified
ordinary ownership, public signup/login, PDC/paid-checkout acceptance, then public
purchasing. Returning-customer guidance is the next small release before signup.
Email acceptance is complete. Import, signup and purchasing retain separate
approvals. Payment success never creates a shipment automatically.

### N. Next exact action

**Historical import PASS. Prepare the small EN/AR returning-customer notice release.**

- [Import receipt](customer-history-import-receipt.md): exact3c9f5764 owner approval
  executed once23:07:33.882 Riyadh. All41 batches/516 customers/591 orders/6 refunds/
  1789 items/702 events reconciled. Three required history routes loaded, one
  Caddy signal/0 app restart/0 schema deployment. No further import approval needed.
- All140 original projections match the fresh execution backup after import;
  three confirmed users/profiles and current orders/catalog preserved.41 durable
  database/local receipts, backup/full readback, completion and independent11 route
  checks PASS. Signup/purchasing/provider initiation stay CLOSED; confirmation required.
- Ownership remains explicit:513 conditionally eligible identities/3 held, claims0.
  131 orders remain unlinked/private; no billing-email linking or automatic Auth
  account creation. The current verified match has no orders; owner can accept
  its archived profile/empty view through My Account → My Orders → Connect previous
  orders. Hosted order-detail acceptance needs one separately authorized controlled
  order-bearing signup, or an eligible customer after public signup approval.
- Codex next prepares only the [specified returning notice/generic login help](customer-access-release-plan.md#returning-customer-notice--next-small-release),
  preserving EN/AR/RTL/themes/responsiveness and accepted Auth flows. No identity
  lookup, provider/settings change or unrelated enhancement. Its exact deployment
  remains separately approved; keep signup guidance off until registration is open.
- Then public self-service/abuse readiness and separate signup approval; order-bearing
  history acceptance, PDC/delivery/EGP50/manual merchant refund/reconciliation/
  unpaid-expiry/final normal checkout acceptance; separate purchasing approval.
  PDC booking stays administrator-controlled after confirmation.
- Source70e929ee/deployment4c332350/import3c9f5764 are complete and cannot be reused.
  Never rerun pre-import check/apply expecting empty tables. Preserve immutable
  records and receipts; source-hide/routing reversal needs separate scoped review.
  No automatic retry/delete/full restore over newer users or orders. All original79
  tasks remain, plus9 post-Beta IDs (88 total); none blocks public activation.
- Before Codex2 takeover, read the committed [Git audit](GIT_WORKTREE_SYNC_AUDIT.md).
  Same-workspace account switching needs no merge/push. Main code still has91
  migrations; use reviewed deployed-source lineage for the next P0 notice release,
  preserving dirty worktrees and the newest main documentation. This documentation
  task performs no implementation/production action.

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
