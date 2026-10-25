# Customer access requirements and pending release inventory

**Current handover inventory:** [complete Git audit](GIT_WORKTREE_SYNC_AUDIT.md)
records nine worktrees/six local branches. The documentation commit adding that
report records current schema94/import results; only the consumed Auth helper and
redirect test remain untracked on main. Earlier pending-file counts/lists below
are historical pre-audit observations. The ten new requirements are post-Beta;
all original79 tasks remain, plus9 new IDs (88 total). P0 signup/paid checkout unchanged.

**StageB production import PASS — 2026-10-25,23:07:33.882 Riyadh.**
[Import receipt](customer-history-import-receipt.md):3c9f5764 consumed,41 batches,
all140 original projections and current users/profiles preserved;513 conditional
identities/3 held, claims0. Three exact history routes loaded once. No app/schema
redeploy or public activation. Hosted profile/owned-order acceptance remains pending.
Next Codex work is the small notice release specified below, before public signup.
Historical readiness statements retain their original scope; no import retry.

Owner requirements recorded 2026-10-25, Asia/Riyadh.
**INACTIVE RELEASE DEPLOYED — schema94; history import subsequently passed.**
The replacement4c332350 approval executed once at21:31:49.255 Riyadh. Release
bc05eef266eeb7de preserved existing customers/commerce/catalog/callbacks. Recovery,
candidate, data/Auth/gate and public smoke checks passed. The deployment pause can
end. [Deployment result](inactive-history-release.md#production-result-and-consumed-approval).
Import approval is consumed; signup and public purchasing still need separate approvals.
All79 roadmap IDs remain; these requirements extend existing tasks.

**StageB pre-import qualification, now executed under that approval:**
[final history packet](customer-history-final-import.md), seal3c9f5764,41 batches.
Final516 customer snapshots include513 conditionally eligible identities and3 held;
1 current verified match/512 later verified signups. No Auth creation or automatic
linking.131 guest/missing-excluded orders remain unlinked. The same approval includes
three required history API routes/one Caddy signal; no app/schema redeploy.
Import/routing completed under that exact approval. Ordinary hosted acceptance follows.

## Release order and scope

| Order | Milestone | Existing tasks / gate |
| --- | --- | --- |
| A | Deploy the qualified inactive91→94 application/schema — complete | BETA-10 DEPLOYED; seal4c332350 consumed, never rerun |
| B | Import reviewed customer/history records; verify ordinary-customer ownership | MIG-01/02/03/05, BETA-04; Import/three-route approval consumed; all41 batches PASS; hosted ordinary acceptance pending |
| C | Open normal public signup/login/recovery | BETA-03; returning-customer notice released first, identity/abuse acceptance and separate signup approval |
| D | Complete PDC delivery and paid-checkout acceptance | BETA-05/06/07/08/09/12, BETA-11; approved bounded tests, merchant refund/reconciliation and order acceptance |
| E | Enable real public purchasing | BETA-11; separate exact purchasing approval |

Existing customer login/recovery stays available throughout. StageB can verify
profile ownership with an existing verified matching customer; that account has
no historical orders. Hosted order/detail acceptance requires a separately approved
controlled order-bearing signup or an eligible customer after public signup.
No account creation is part of import. Other historical customers gain ordinary account
access atC and then connect their reviewed history themselves.
Payment success never creates a shipment. PDC booking stays administrator-controlled
after order confirmation and existing packing/uncertainty safeguards.

The [inactive deployment packet](inactive-history-release.md) has deployed.
Adding login code would change its frozen application hashes and compiled archive,
requiring another build, archive/browser qualification and seal. Keep this exact
release recorded as consumed. The returning-customer notice is the **next
small application release afterA, beforeC**, under BETA-03. It may be prepared
alongside the data review, but cannot delayA or collect unrelated enhancements.
It is specified here, not implemented or qualified yet. Do not represent this
notice as part of archivebc05eef266eeb7de.

## Original-email access and identity protection

- Historical customers use the email registered on the previous website.
  If no current account exists, they register, create a new password and verify
  their mailbox. Customers already registered here use normal login or recovery.
  These choices are explained universally; the UI does not identify account type.
- Import no legacy passwords/hashes. All518 inspected hashes use the incompatible
  WordPress `$wp$2y$` pre-hash format. No direct Supabase hash import is qualified.
  Existing Supabase UUIDs, passwords, email identities and newer profiles remain.
- Account creation and recovery use the existing supported Auth flows. Do not
  require administrator account creation, send bulk invitations, auto-confirm
  emails, reset existing passwords or duplicate current identities for migration.
- A verified, active, unique current identity explicitly claims only an approved
  matching registered legacy identity. The server derives the UUID from the
  authenticated session. Changed-email, duplicate, privileged, unverified and
  other-account exceptions stay held for evidence review.
- Never link guest/unlinked orders through billing/contact email alone. Preserve
  the110 guest plus21 excluded/missing associations privately and unlinked.
  The two privileged legacy users stay excluded. Preserve the date conflict and
  comparison-snapshot exceptions already accepted in the source packet.
- The final payload freezes513 prospectively eligible legacy IDs/source evidence
  and3 held records before immutable import. The exact owner import approval also
  approves that eligibility. The preserved zero-claim preview is not an import
  candidate; never import it and replay changed customer flags. No source reapproval.

## Returning-customer notice — next small release

Keep the existing login form, layout, theme tokens and responsive behavior.
Use the existing EN/AR catalogs and mode controls; add no new auth page or identity
lookup. Show this compact notice on login/signup for stores with this migration
enabled through reviewed site/runtime configuration. Default it off elsewhere;
never hardcode a store, domain, mailbox or project into reusable application logic.
Release the code before signup activation; enable the notice with the reviewed
store signup rollout so customers are not directed into closed registration.

| Purpose | English | العربية |
| --- | --- | --- |
| Notice heading | Customers from our previous website | عملاء موقعنا السابق |
| Returning customer | Register with your original email and create a new password. | سجّل ببريدك الإلكتروني الأصلي وأنشئ كلمة مرور جديدة. |
| Current platform customer | If you already registered here, use Forgot Password. | إذا سجّلت هنا من قبل، استخدم «نسيت كلمة المرور». |
| Failed login guidance | Check your email and password, or use Forgot Password. | تحقق من البريد وكلمة المرور، أو استخدم «نسيت كلمة المرور». |
| Returning-customer reminder after failure | Previous website customers should register with their original email. | لعملاء الموقع السابق، سجّل باستخدام بريدك الإلكتروني الأصلي. |

After a failed password-login attempt, provide the same applicable guidance for
unknown, existing and historical emails. Show no email-match result, legacy status,
account-existence hint, raw provider error or different recovery recommendation
based on a lookup. Keep generic credential errors and current rate/abuse controls.
Use existing Create Account/Forgot Password actions; preserve email validation,
PKCE, confirmation, recovery redirects and disabled public signup until approval.
Do not change Auth/SMTP settings or provider/templates as part of this notice.

Focused acceptance for that release: EN/AR, RTL, desktop/mobile, Light/Dark/System,
both actions/keyboard focus, mode changes, notice disabled on another store, and
identical guidance across synthetic failed-login identities. Verify no extra
existence-check request or historical lookup. Preserve the accepted confirmation
and recovery flows; local tests do not authorize real emails.

## Ordinary-customer My Orders acceptance

The sealed application already mounts `AccountHistoricalOrders` in
`app/pages/account/orders/index.vue`: My Account → My Orders → Previous orders.
Its ordinary **Connect previous orders / ربط الطلبات السابقة** button submits
`POST /api/account/history/claim` with `{confirmed:true}`. It sends no user-selected
UUID, email, legacy ID or order ID. The server requires a confirmed authenticated
customer and the approved source/identity rules. No Dashboard role is required.

After approved import and a successful verified claim, the same view loads owned
orders and details, payment/refund history, items, archived profile/addresses and
fulfillment observations. Current and historical orders remain distinct; history
cannot trigger payment, inventory, dispatch, shipping or notification operations.
Current profiles and order records are never overwritten by archived values.

Before access acceptance, an ordinary eligible customer must complete login,
open My Orders, connect previous orders, view an owned list/detail and refresh.
Verify recorded money/currency, items, addresses and history against the approved
snapshot. An existing verified matching customer can provide the initialB check;
repeat the complete self-service path with a newly verified returning customer
whenC is approved. No administrator-only acceptance can replace these checks.

Also verify anonymous/unconfirmed/inactive, another customer/direct ID, guest-email
and held/changed-email cases remain denied or empty without disclosing private
records. Switch accounts during pending reads/claims; late responses must remain
hidden. Reuse passing history SQL/API/UI checks now; hosted ordinary-customer
acceptance remains pending approved import and ordinary authenticated checks.
Deployment is complete; local tests do not establish owned-history acceptance.

## Included and intentionally deferred work

Opening inventory scope: all seven then-registered Git worktrees, five local branches, dirty/
untracked files and the69-path combined source delta from foundation6440669.
Local tracking refs were inspected without fetching or pushing. Production
deployment receipts/archive hashes, rather than branch age alone, identify live
work. Private backup/diagnostic archives are retained evidence, not extra releases.
A subsequent eighth detached worktree at724720a prepares the same archive against
the refreshed catalog baseline. It is a replacement packet, not another feature
candidate. No existing dirty worktree was changed or discarded.

| Location / source | Inventory result | Disposition |
| --- | --- | --- |
| Combined inactive branch724720a | Clean; app1924ca0 plus compatible operator; exact archivebc05eef266eeb7de | Same application now deployed by replacement packet; original6474587 held, no separate release to deploy |
| Refreshed inactive detached724720a | Clean; archivebc05eef266eeb7de/schema94 deployed under4c332350 | Consumed once; recovery/candidate/data/Auth/gates/public smoke PASS; no import or activation |
| Final import operatorde5c414 | Ninth worktree, clean local branch; seven new operator/test files only | Final history/three-route packet executed once; no app/schema deployment |
| History branch1924ca0 | Clean; source and41-batch offline rehearsal | Same application deployed above; original zero-claim preview/tools retained only; final3c9f5764 import completed once |
| Original Beta worktree6440669 |40 pending paths; all40 bytes match preserved snapshot2cd5418 | Already represented in the combined source; no second Beta release or destructive cleanup |
| Main documentation commit, parentf4f47f1 | Current receipts/roadmap/audit committed; two Auth source files remain untracked | Current Git audit supersedes the historical pending list; no app source merged or deployed |
| Modern Footer certified82 contextc3775e8 | Clean | Retained historical qualification context; no pending application delta |
| Modern Footer failure replay8181953 | Four pending test/helper paths | Historical diagnostic fixtures; intentionally excluded, preserved |
| Premium PDP baseline69952dd | Clean | Retained historical baseline; no pending application delta |
| Older local branches6f66bb4 and6440669 | Foundation/history refs; their upstream names remain recorded | No separate new release inferred; preserve refs and use exact archive receipts |

Included Beta scope: truthful backorders/consent, CARD-only policy, configured
delivery-fee support, paid stock release, unpaid expiry API, Dashboard processing
and guarded manual-AWB recording. Shipping fee/settings, expiry scheduling, live
provider initiation and public gates are **not activated** by this deployment.
No draft products are published. Signed Paymob callbacks remain supported.

Included history scope: private migration94 tables/RLS/service RPCs, authenticated
history list/detail/claim routes, ordinary My Orders UI, offline planning/import
tools and tests. No historical rows, Auth accounts, claims, profile changes,
notifications or provider operations are executed by deploying this source.

Deferred by explicit gate: the returning-customer notice described above; remaining hosted
history acceptance; normal public signup; PDC destination/EGP50 settings;
merchant manual refund/reconciliation; scheduler/final order and payment acceptance;
then public purchasing. Other existing79-task requirements retain their status.
The inactive archive is deployed. Keep the next small notice release focused;
do not create another qualified application backlog or mix unrelated enhancements.

Private inventory: `../customer-migration-inactive-release-20261025/owner-requirements-inventory-before.json`.
It binds the opening worktree heads/file hashes and the complete69-path source
delta. The following file lists make every dirty path reviewable.

## Pending file lists

Before the audit documentation commit, main had14 pending path entries, including this report, README and the final
import packet and production receipt. Existing files and
consumed Auth helper/test are preserved outside the sealed runtime archive.

```text
 M CODEX_HANDOFF.md
 M PROJECT_STATE.md
 M README.md
 M docs/ELCOMPUTER_MASTER_ROADMAP.md
 M docs/auth-email-acceptance.md
 M docs/customer-migration-release.md
 M docs/wordpress-customer-migration.md
?? docs/customer-access-release-plan.md
?? docs/customer-history-final-import.md
?? docs/customer-history-import-receipt.md
?? docs/customer-migration-approval.md
?? docs/inactive-history-release.md
?? scripts/auth-email-acceptance/confirmation-browser.mjs
?? tests/auth-redirect-flow.test.mjs
```

Original Beta worktree: all40 pending paths below match preserved2cd5418.
They are already represented by the combined source; this is not40 new releases.

```text
 M .env.example
 M CODEX_HANDOFF.md
 M PROJECT_STATE.md
 M README.md
 M app/components/cards/ProductCard.vue
 M app/components/dashboard/OrderDetailsDialog.vue
 M app/components/product/Classic.vue
 M app/components/product/Premium.vue
 M app/composables/usePurchaseAccess.js
 M app/pages/account/orders/[id].vue
 M app/pages/cart.vue
 M app/pages/checkout/index.vue
 M app/pages/checkout/summary/[id].vue
 M app/pages/dashboard/settings.vue
 M app/pages/products/[slug].vue
 M app/utils/seo.js
 M app/utils/siteContentDefaults.js
 M app/utils/uiMessageKeys.json
 M i18n/locales/ar.json
 M i18n/locales/en.json
 M nuxt.config.ts
 M server/api/account/orders/[id].get.js
 M server/api/checkout/shipping.get.js
 M server/api/payments/capabilities.get.js
 M server/utils/checkoutCommand.js
 M server/utils/normalPurchase.js
 M server/utils/payments/index.js
 M tests/premium-product-page.test.mjs
?? app/utils/backorder.js
?? docs/beta-launch-candidate.md
?? docs/beta-refund-operations.md
?? server/api/admin-orders/[id]/release-backorder.post.js
?? server/api/admin-shipping/orders/[id]/manual-awb.post.js
?? server/api/internal/commerce/expire-unpaid.post.js
?? server/utils/betaPurchase.js
?? supabase/migrations/20261024150000_card_backorders.sql
?? supabase/migrations/20261024160000_unpaid_card_stock_release.sql
?? tests/beta-manual-awb.test.mjs
?? tests/beta-purchase.test.mjs
?? tests/card-backorders.test.mjs
```

Historical failure-replay fixture changes, intentionally excluded:

```text
 M tests/daftra-erp-database.test.mjs
 M tests/helpers/dashboardAccessFixture.mjs
 M tests/preorders.test.mjs
?? tests/helpers/footerH3AutoImports.mjs
```

## Exact next guarded milestone

The deployment is complete and its seal consumed. The catalog pause can end.
Freeze privately reviewed legacy ownership eligibility/evidence and the final
immutable payload, refresh current94 target/recovery bindings, then prepare the
exact historical import approval. Source approval is complete; do not repeat it.

The installed-schema prepared import check PASS covers41 batches only. Claims
remain0; importing that preview would expose no history. Ordinary authenticated
history reachability/claim/list/detail and denied access still need guarded
acceptance; public anonymous403 does not prove that flow works. Keep signup,
purchasing and provider initiation closed. The notice is the next small release
before signup. No historical import or public activation has run.
