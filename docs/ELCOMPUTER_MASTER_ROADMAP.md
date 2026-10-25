# ELcomputer master roadmap

Authoritative development and continuity index for both Codex accounts.
Last evidence review: **2026-10-25, Asia/Riyadh**.
Latest retained production observation: **2026-10-24**. No live probe ran here.

**Priority: public paid Beta. Production purchasing and registration remain closed.**
Latest recorded production: **`58e3083f4aa6a1f8`, schema91**.
The isolated Beta candidate targets schema93; it is not deployed.
Next task: **BETA-01 — verify effective Supabase Auth SMTP readiness with Brevo**.

**79 tracked tasks.** Priority: P0 25; P1 39; P2 14; PARKED 1.
Status: PLANNED 35; IN PROGRESS 0; LOCAL PASS 11; DEPLOYED 11;
ACCEPTED 2; BLOCKED 16; ON HOLD 4. Count each task row once;
dependent tasks can cover different acceptance stages of the same feature.

Navigate: [overview](#a-project-overview), [production](#b-current-production-baseline),
[deployed](#c-completed-and-deployed-features), [local](#d-implemented-locally-but-not-deployed),
[Beta](#e-current-top-priority--public-paid-beta-launch),
[migration](#f-wordpress--woocommerce-migration), [payments](#g-payment-gateways),
[products](#h-products-inventory-and-backorders), [shipping](#i-shipping-companies-and-pdc),
[orders](#j-orders-and-fulfillment), [checkout](#k-checkout-and-customer-experience),
[future](#l-future-features-and-retained-unfinished-commitments),
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

### A. Project overview

ELcomputer is an independent deployment of a reusable ecommerce platform.
Nuxt4/Vue3 provide storefront, account and Dashboard surfaces. Supabase provides
PostgreSQL, Authentication and structured metadata. **The VPS owns all files**,
including public media and authorized private packing videos, shipping labels
and order documents. Current infrastructure uses Ubuntu, Caddy and systemd's
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
| Application | E01: `58e3083f4aa6a1f8`, activated 2026-10-24 at 13:25:02.849 Riyadh. Consolidates customer session isolation and preserves deployed PDC corrections. Exact approval consumed. |
| Schema | 91 applied migration identities. Latest: `20261023010000_shipping_tariff_drafts.sql`. E01/E03 preserved schema91. Current main has91 files; W has93. All91 historical migration files match byte-for-byte. |
| Storefront | Healthy recorded runtime; browse-only. E01 hosted smoke:8 HTTP checks,37 asset hashes,3 browser checks,4 protected-route observations; no page exceptions. No fresh 2026-10-25 uptime claim. |
| Dashboard/accounts | Existing Dashboard/products/inventory/orders and owner-reported creation/Draft/upload/profile checks retained. Login/profile access is deployed. Two confirmed active customer profiles were later observed; B has no admin record. Owner reports account switching passed. Independent hosted order-isolation/RBAC acceptance remains incomplete. |
| Public gates | Signup disabled, confirmation required. New public purchases, ordinary checkout/coupon ingress and outbound payment/shipping initiation remain held. Saved enabled payment-method/provider settings do not open those gates. |
| Paymob | Existing LIVE card credentials retained privately. One EGP2 sale succeeded through normal checkout and signed-callback reconciliation. Keep exact signed POST ingress, original keys and owned receipt/status reads available for late events. No new initiation authorized. Refund/void readiness unverified. |
| PDC | Product40 preferred; provider configuration may be enabled while outbound runtime gates remain closed. Generic User-Agent and dated status lookup correction deployed in `2573cdf1504bf559`, preserved by E01. One production static API booking succeeded; normal dynamic Dashboard booking remains unaccepted. Original uncertain dispatch remains guarded. |
| PDC inbound security | E04: exact POST ingress loaded at15:00:56.337 Riyadh on 2026-10-24. Missing-secret probe401; no authenticated callback or registration change. Earlier pending-reload STOP is resolved. Provider mapping/timezone/cutover remains blocked. |
| Delivery/tariffs | PDC is the only configured checkout company. Latest stored customer fee EGP1 is historical test configuration. Owner-approved configurable Beta fee EGP50 is local/unapplied. Schema91 tariff manager deployed; no business import/checkout tariff activation established. |
| Notifications | Separate central Brevo adapter disabled; later inspection found no approved senders, key or retained delivery activity. SMS/order automation remains dormant. These facts do not establish effective Supabase Auth SMTP. |
| Recovery | E01/E03 record verified encrypted execution backups and preserved schema/security/runtime/media/incidents/retained assets. Backups from completed releases are historical recovery evidence, not fresh approval for another release. |

Production details above are evidence-backed **recorded state**, not a fresh live
audit. No SSH, SQL, settings change, provider request, email, deployment or Git
push ran during roadmap creation.

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

### D. Implemented locally but not deployed

W contains40 modified/untracked files at inspection. Preserve their exact bytes.
Main and the later branch have not been merged by this task.

E06 records69 focused passes,7 final policy-regression passes, independent native
PostgreSQL concurrency, local manual-AWB/packing/H3 checks, typecheck and a
Node22.23.1 build. Its review archive SHA256 is
`dc8a9673695b64d34fd3d380b0d0b7077a5b5e96ee83732d2d50233e3078916b`.
Full archive readback and1534 served asset checks passed;1428 retained client
files are included. **New-control browser acceptance was not run.**
Two known baseline failures are documented in `preorders.test.mjs` and
`storefront-payments.test.mjs`; the full suite was not run. Do not call it green.
There is no executable production approval or schema91→93 operator yet.

| ID | Feature / workstream | Priority | Status | Owner decision / dependency | Done / acceptance | Evidence | Verified | Next action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| LOCAL-01 | Public paid Beta candidate | P0 | LOCAL PASS | Candidate source/artifact only; no hosted acceptance | E06's stated local checks pass; scope excludes production activation | E06; W:docs/beta-launch-candidate.md | 2026-10-25 | Preserve candidate; complete BETA-10/11 |
| LOCAL-02 | Migration92: zero-stock CARD backorders and paid stock release | P0 | LOCAL PASS | Owner policy allows eligible backorders; built-in inventory | Published normal items; no invented stock; paid orders held until real atomic allocation | E07; W:supabase/migrations/20261024150000_card_backorders.sql | 2026-10-25 | Include exact migration in BETA-10 |
| LOCAL-03 | Migration93: unpaid expiry and reservation restoration | P0 | LOCAL PASS | Loopback scheduler/secret/monitoring required | Release actual allocations once; protect active/paid/packed/dispatched/uncertain attempts; late success enters review | E07; W:supabase/migrations/20261024160000_unpaid_card_stock_release.sql | 2026-10-25 | Qualify deployment and BETA-09 operations |
| LOCAL-04 | CARD-only public checkout protections | P0 | LOCAL PASS | Private deployment policy and reviewed product exclusions | Restrict method/company/customer window; malformed policy closes access; persisted items revalidated | E06; W:server/utils/betaPurchase.js | 2026-10-25 | Accept normal-flow guards under BETA-05/11 |
| LOCAL-05 | Manual PDC AWB recording | P1 | LOCAL PASS | Administrator verifies actual AWB; paid/allocated/packed order | Existing RBAC/video/coverage/duplicate barriers preserved; uncertain dispatch cannot use fallback; label remains pending | E06; W:server/api/admin-shipping/orders/[id]/manual-awb.post.js | 2026-10-25 | Accept ORDER-03 separately without manufacturing shipment data |
| LOCAL-06 | Special-order notices and mixed-parcel hold | P0 | LOCAL PASS | Owner approved wording and shipping together | Both PDP styles, Cart and Checkout disclose before payment; EN/AR settings editable; accepted terms retained | E06; W:app/utils/backorder.js | 2026-10-25 | Verify new controls in hosted browser |
| LOCAL-07 | Configurable EGP50 Beta customer delivery fee | P0 | LOCAL PASS | Owner approved50; production still stores1 | Existing client_shipping_price owns fee; carrier costs/subsidy/VAT not inferred | E06; E10 | 2026-10-25 | Apply only through BETA-11's exact settings approval |
| LOCAL-08 | Cross-account source and documentation consolidation | P0 | BLOCKED | Main older than production; W dirty; both accounts' work must survive | Review branch/W deltas and bindings; preserve history, incidents and91 migration hashes | E01–E07; Git branch/worktree status | 2026-10-25 | Plan reviewed source freeze within BETA-10; no incidental merge |

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
| BETA-01 | Supabase Auth custom SMTP using Brevo | P0 | BLOCKED | Existing management read403; owner secure console inspection needed | Establish effective custom SMTP, verified sender/domain and configured transport privately; keep signup closed | E06; W:docs/beta-launch-candidate.md | 2026-10-25 | Inspect intended project's Auth SMTP settings read-only |
| BETA-02 | Signup confirmation, recovery and redirect acceptance | P0 | BLOCKED | BETA-01; explicit external-send approval | External-mailbox verification/recovery complete on narrow configured origins; no token leakage or open redirects | E06; E15; app/pages/login.vue | 2026-10-25 | Review effective allowlist; prepare approved delivery cases |
| BETA-03 | Public registration abuse controls and readiness | P0 | BLOCKED | BETA-02/04; hosted rate-limit/CAPTCHA evidence absent | Confirm effective limits/bot controls and ordinary confirmed-customer defaults before enabling signup | E06; E08 | 2026-10-25 | Record hosted controls without changing them |
| BETA-04 | Legacy-customer identity protection for Beta | P0 | PLANNED | Owner accepted verified new identities with history deferred | Preserve existing UUIDs/credentials; ordinary signup/recovery; no guest-email ownership or silent legacy linking | E06; E11 | 2026-10-25 | Record conflict handling and acceptance cases; retain full migration |
| BETA-05 | Authentic A/B customer-order/session acceptance | P0 | BLOCKED | Candidate deployed inactive; exact bounded access approval | Same-browser/two-tab customer data isolation, independent owned orders/recovery, denied cross-account access; held cases remain held | E05; E06 | 2026-10-25 | Prepare no-charge two-existing-account window; intention ingress closed |
| BETA-06 | Legitimate publishing and backorder catalog | P0 | PLANNED | Owner reviews actual products/prices and backorder policy | Eligible published normal products have truthful terms/consent; exclude test/preorder; preserve stock and bulk receipts | E06; E07; E12 | 2026-10-25 | Review private eligible-model list; do not mass-publish |
| BETA-07 | Official PDC destinations and EGP50 configuration | P0 | BLOCKED | Updated official owner location file missing; LOCAL-07 unapplied | Validate exact IDs against accepted cache, approve bounded diff and supported destinations; apply configurable50 separately | E06; E09; REQ | 2026-10-25 | Obtain official file privately and prepare review-only mapping diff |
| BETA-08 | Merchant refund/cancellation and stock-reconciliation readiness | P0 | BLOCKED | LIVE Refund/Void entitlement unverified; owner finance decision | Confirm merchant access read-only; approve full-refund procedure/private operation log and actual-stock disposition; no status-only refund claim | E06; W:docs/beta-refund-operations.md | 2026-10-25 | Inspect existing successful transaction read-only; submit no money action |
| BETA-09 | Expiry scheduler, exception monitoring and closure | P0 | PLANNED | LOCAL-03 deployed; dedicated secret/loopback scheduler | Bounded worker, repeat-safe releases, late-callback review,15-minute Beta monitoring; closure stops new orders while preserving receipts | E06; E07 | 2026-10-25 | Prepare scheduler/runbook/alerts without installing or activating |
| BETA-10 | Guarded inactive schema91→93 deployment preparation | P0 | BLOCKED | Reviewed W/branch source freeze and new exact operator/backups | Seal matching app/92–93, retained assets, native/new-control browser checks, schema compatibility, fresh recovery and disabled gates | E06; E07; E19 | 2026-10-25 | After prerequisite review, prepare one concrete inactive release; request approval last |
| BETA-11 | Normal CARD checkout and guarded public activation | P0 | BLOCKED | BETA-01–10; distinct deployment/settings/activation approvals | Hosted order acceptance; approved catalog/cities/fee; ready monitoring/refunds; enable purchasing last; paid status only from signed callback | E02; E06; REQ | 2026-10-25 | Keep closed; present exact activation and emergency-closure packet |
| BETA-12 | Preserve LIVE payment, 3DS and callback reconciliation | P0 | PLANNED | DONE-04 retained; no incidental repeat charge | Candidate preserves HMAC/context/idempotency and owned reads; any new real sale has separate authorization and durable reconciliation | E02; E06; server/utils/payments | 2026-10-25 | Verify preserved code/config bindings during BETA-10 |

### F. WordPress / WooCommerce migration

The archive stays **strictly read-only**. Never run its code or old automation.
Beta may precede historical import using ordinary verified Supabase identities;
this changes sequencing, not the migration requirement. E06 supersedes E11's
older full-migration-before-signup language for the bounded Beta policy only.

| ID | Feature / workstream | Priority | Status | Owner decision / dependency | Done / acceptance | Evidence | Verified | Next action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| MIG-01 | Source inventory and durable customer identity mappings | P1 | PLANNED | Approved snapshot/cutoff and identity-conflict decisions | Fingerprinted sources; verified source-user→Auth UUID mapping; concurrent/retry-safe receipts; no auto-confirmation/role changes | E11; REQ | 2026-10-25 | Prepare encrypted offline inventory/dry-run |
| MIG-02 | Historical customer profiles and saved addresses | P1 | PLANNED | MIG-01; owner conflict resolution | Preserve provenance/missing values; never overwrite newer Supabase profiles, credentials or addresses | E11; REQ | 2026-10-25 | Compare source fields against current verified mappings read-only |
| MIG-03 | Historical orders, customer order history and Woo metadata | P1 | PLANNED | MIG-01; separate immutable historical representation | Preserve original items/money/refunds/dates/metadata; scope customer reads; leave guest orders unassigned without proof | E11; REQ | 2026-10-25 | Design bounded historical projection and exact metadata inventory |
| MIG-04 | Product identity links and legacy URL continuity | P1 | PLANNED | Existing catalog mapping and final source reconciliation | Reuse source-product links; no duplicate catalog import; complete accepted URL/redirect/media mapping where needed | E11; PROJECT_STATE.md historical cutover entries | 2026-10-25 | Locate existing mapping/URL inventory and reconcile differences |
| MIG-05 | Historical import safety and guarded acceptance | P1 | PLANNED | MIG-01–04; exact production-import approval | No payments/bookings/stock deductions/cash postings/emails/notifications; count/value reconciliation, isolation, backups and partial receipts | E11; REQ | 2026-10-25 | Test disposable fixtures; present exact dry-run before import |

### G. Payment gateways

| ID | Feature / workstream | Priority | Status | Owner decision / dependency | Done / acceptance | Evidence | Verified | Next action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PAY-01 | Secure Dashboard Payment Gateways and Quick Setup configuration | P1 | PLANNED | Separate unit D1; active-owner authorization | Owner-only route/API, versioned encrypted secrets, presence-only responses, audited changes; explicit runtime fallback/source switch | E10; E19 | 2026-10-25 | Extend existing resolver/Setup without moving live secrets automatically |
| PAY-02 | Paymob Pixel/embedded on-site payment investigation | P2 | PLANNED | Preserve successful LIVE flow and verified callback path | Audit existing Pixel loader/integration first; qualify hosted embedding, lifecycle and 3DS before changing redirects | E10; paymob-report.md; REQ | 2026-10-25 | Compare existing embedded path with observed customer journey |
| PAY-03 | Paymob refund/void workflows and transaction reconciliation | P1 | PLANNED | BETA-08 manual readiness first; provider/account acceptance | Explicit approved money actions, durable operation ledger, uncertainty handling, refund callbacks/reconciliation and stock disposition | E06; E10; REQ | 2026-10-25 | Design against original transaction; no current refund API exists |
| PAY-04 | Generic future payment gateway adapters | P2 | PLANNED | Owner-selected provider and supported capability contract | Provider/config revision pinned per attempt; preserve original reconciliation keys and method availability controls | E10; REQ | 2026-10-25 | Add only when a concrete gateway is selected |
| PAY-05 | Dashboard merchant-transaction visibility issue | P2 | PLANNED | Owner-reported requirement; exact failing view unverified | Reproduce with secure intended merchant/session; reconcile known sale to local/provider view without another charge | REQ; E02 | 2026-10-25 | Capture read-only view/reproduction details privately |

### H. Products, inventory and backorders

Owner-approved special-order notice: “Special order. We’ll confirm availability
and delivery timing before fulfillment.” Mixed orders wait until all actual
items are available or sourced unless the owner explicitly changes policy.
Zero recorded stock alone does not block an eligible approved backorder.

| ID | Feature / workstream | Priority | Status | Owner decision / dependency | Done / acceptance | Evidence | Verified | Next action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PROD-01 | Configurable zero-stock purchasing and truthful fulfillment | P0 | LOCAL PASS | LOCAL-02/06; allow_out_of_stock_purchases remains owner-controlled | Distinguish real stock/special orders; retain consent; paid procurement/release; no fictional quantities or partial mixed-parcel release | E06; E07; REQ | 2026-10-25 | Complete Beta hosted acceptance using approved real catalog |
| PROD-02 | Product Manager reliability, publication and bulk operations | P1 | PLANNED | Preserve current compact UI and E12 contracts | Revision-safe sparse changes, current-page selection, recoverable partial receipts, Draft-first required fields and honest failures | E12; E21; REQ | 2026-10-25 | Reproduce remaining accepted defects before extending controls |
| PROD-03 | Image uploads and VPS media lifecycle | P1 | PLANNED | VPS-only files; extend reference guards for new tables | Validated public images, private evidence separation, authorized deletion/recovery and real upload acceptance | E12; REQ | 2026-10-25 | Verify remaining hosted upload/delete cases without replacing uploader |
| PROD-04 | Procurement and ERP inventory ownership | P1 | PLANNED | Built-in versus Daftra mode and genuine received units | Preserve single inventory owner; receipt/cost/QR links truthful; aggregate ERP stock never fabricates physical units | E20; E07 | 2026-10-25 | Review procurement→paid-backorder release acceptance |

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
| ORDER-02 | Packing/confirmation videos under Orders → Documents | P1 | PLANNED | Current private-video backend; owner retention policy | Expose relevant videos/files in requested order document view, authorized private VPS playback/download and retention; inspect existing linkage first | E13; REQ | 2026-10-25 | Audit dialog/Documents integration; qualify remaining UI/private access |
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
| CX-05 | Reliable EN/AR desktop/mobile checkout | P0 | PLANNED | New candidate controls need browser acceptance | Truthful special-order/fee/error states across RTL/themes/widths; no hydration errors or cross-account data | E06; E14; REQ | 2026-10-25 | Qualify exact candidate browser then hosted acceptance |
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
| FUT-08 | ERP/Daftra, procurement, treasury and HR follow-up | P2 | PLANNED | Correct ERP owner and explicit provider/config scope | Retain existing modules, salary/payment command safety and procurement options; separately accept hosted sync/concurrency/finance flows | E20; salary-payment-safety.md | 2026-10-25 | Identify one unfinished accepted ERP/finance requirement |
| FUT-09 | Live Chat, OAuth, accessibility and Help Center follow-up | P2 | PLANNED | Existing policy/provider/retention approvals | Preserve deployed chat/support; review current guest Auth/Realtime/private-file/device acceptance, OAuth configuration and article feedback needs | live-chat-staging-acceptance.md; authentication-page.md; PROJECT_STATE.md | 2026-10-25 | Reconcile current target before reviving historical phase instructions |
| FUT-10 | Additional shipping/payment integrations and future discovery protocols | PARKED | ON HOLD | Concrete owner-selected service and explicit scope | Generic adapters/secure callbacks; advertise only implemented services; no speculative provider IDs or false capabilities | E10; E14; REQ | 2026-10-25 | Retain until owner selects integration |
| CONT-01 | Permanent cross-account roadmap and milestone continuity | P1 | LOCAL PASS | This documentation task; future accounts must update explicitly | A–O/tasks/evidence/conflicts/pointers maintained; old handoff bytes and other account's work preserved | This file; AGENTS.md; both handoffs | 2026-10-25 | Update with every completed milestone and new requirement |

### M. Risks and blockers

| Task | Actual blocker / why it matters | Evidence | Smallest next action |
| --- | --- | --- | --- |
| BETA-01/02/03 | Effective Auth SMTP, external verification/recovery, redirects and abuse controls unverified. Existing management token returned403. Central Brevo readiness cannot substitute. | E06 email inspection,2026-10-24 | Owner/authorized account inspects intended Auth SMTP and URL/rate-limit settings privately; no send/change yet. |
| BETA-07 / SHIP-02 | Updated official location file missing. Free text,411-city API cache and six-zone tariffs are different evidence; unsafe mapping can accept unsupported delivery. | E06; E02 | Obtain official file, validate exact IDs and present bounded diff. |
| BETA-08 | Merchant LIVE Refund/Void access and procedure not accepted. Local cancellation does not return funds. | E06 refund guide | Inspect intended LIVE merchant permissions/current transaction read-only. |
| BETA-05 / CX-04 | Owner-reported switching passed, but independent hosted order/cart/recovery cases remain incomplete or held. | E05; later E06 | Bind two existing ordinary accounts and an approved no-charge acceptance window. |
| BETA-09/10/11 | Candidate lacks production operator/approval, new-control browser acceptance, scheduler and staffed exception process. Schema91-only operators cannot apply92–93. | E06; E07 | Prepare one compatible inactive release and operations packet after prerequisite review. |
| LOCAL-08 | Main is behind the recorded deployment; newer branch and dirty W contain separate work. Blind overwrite/merge can lose fixes or release the wrong source. | Git inspection; E01–E07 | Review exact deltas/source pins and preserve all work before a source freeze. |
| BETA-06 / PROD-01 | Catalog review is not publication or physical inventory. Private review found239 model rows,223 normal product candidates; test stock records do not prove real units. | E06 | Owner reviews exact products/prices and eligible truthful backorders; no dummy stock. |
| SHIP-12 | Original paid customer dispatch remains uncertain despite separate static success. Rebooking can create duplicate obligations. | E03; E08 | Preserve reference/barrier; reconcile original outcome without new shipment creation. |
| SHIP-03/04 | Draft tariff effective dates, current prices, Product40 terms, fee bases/rounding/suburbs unverified. EGP50 customer fee does not establish carrier cost. | E09; E10 | Review authoritative current commercial terms before tariff verification/import. |
| SHIP-07/10 | Dynamic paid/packed shipment acceptance and authenticated webhook cutover lack an eligible genuine linked REF/AWB; status/timezone questions remain. | E03; E04 | Review mapping/eligibility privately; no destination switch or static-AWB attachment. |
| FUT-01 / CONT-01 | Public smoke, local/native fixtures and owner reports have different evidentiary scope. External W files/private receipts are not durable main-branch source. | Evidence registry; E06; E21 | Preserve source hashes and consolidate reviewed documents/code during a separate milestone. |

Public Beta's required sequence remains: Auth readiness and identity protections,
official delivery/refund readiness, exact inactive deployment, bounded no-charge
customer acceptance, reviewed settings/scheduler/monitoring, then explicit public
activation. New money actions and shipment bookings retain separate approvals.

### N. Next exact action

**BETA-01: verify effective Supabase Auth SMTP readiness using Brevo.**

- Responsible: next active Codex account, Auth/continuity workstream; owner uses
  secure Supabase/Brevo account surfaces where access is unavailable to Codex.
- Prerequisites: read this roadmap and both handoffs; identify the intended
  deployment privately; retain disabled signup and required confirmation.
- Scope: inspect effective Auth custom SMTP, sender/domain verification and
  current transport configuration without revealing credentials. Also record
  the intended origin/redirect and hosted abuse-control readiness for BETA-02/03.
- Definition of done: durable secret-free evidence identifies configured/unconfigured
  state and remaining owner action; both handoffs/roadmap updated. A blocked API
  read or unrelated central email configuration is not a successful SMTP check.
- Approval: read-only inspection and documentation need no new production-write
  approval. Any SMTP/URL/rate-limit change, authentication email or signup activation
  requires its own concrete reviewed approval. External delivery belongs to BETA-02.
- Stop boundary: no provider transaction, test email, credential change, deployment,
  migration, public activation or Git push in this documentation task.

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
