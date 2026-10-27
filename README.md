# MON-01 automatic payment monitoring active - E103, 28 October 2026

The [final timer completion](docs/mon01-final-timer-completion-receipt.md) passed.
The existing five-minute timer is active; two automatic reports verified.
Production remains b4b502a03207713a/schema98; zero additional app restarts.
Alerts are Dashboard-first; email OFF. Keep staffed Dashboard/fulfillment coverage.
Both2649 and3149 provider outcomes remain UNVERIFIED. Kill budget1; PDC PAUSED.
Owner Dashboard observation is pending. All execution approvals are consumed.

# MON-01 observer corrected; final timer approval ready - E102, 28 October 2026

The [final timer review](docs/mon01-final-timer-completion-review.md) is ready.
27 focused checks and read-only host qualification pass. No approval or activation.
Production remains b4b502a03207713a/schema98; zero app restarts required.
Timer disabled; keep staffed15-minute payment checks. New pending2649 remains
provider-unverified. CARD/Manual50/signup LIVE; PDC PAUSED; email OFF.

# MON-01 observer stop; timer disabled - E101, 28 October 2026

The [timer completion was consumed](docs/mon01-timer-completion-stop-receipt.md).
One scheduled worker succeeded; its observer failed and disabled the timer once.
Production remains b4b502a03207713a/schema98; zero additional app restarts.
Keep staffed15-minute monitoring. Never replay any consumed operator.
CARD/signup/Manual EGP50 remain available; PDC PAUSED; email OFF.

# MON-01 timer completion ready for separate approval - E100, 28 October 2026

The [existing-timer completion](docs/mon01-timer-completion-review.md) is prepared.
No approval or activation exists. Production remains b4b502a03207713a/schema98.
Zero app restarts are proposed; keep staffed15-minute payment monitoring.
The original installer and journal recovery are consumed. Never replay them.

# MON-01 partial deployment; timer completion blocked - E99, 28 October 2026

Current production is `b4b502a03207713a`, schema98. Public CARD Beta remains live.
The [recovery stopped after cutover](docs/mon01-journal-recovery-stop-receipt.md).
One app restart was consumed; timer remains disabled. Never replay recovery.
Staffed monitoring is still required; the original emergency-close budget remains1.
Email OFF; signup OPEN; Manual EGP50; PDC PAUSED. Deferred tests remain open.
Earlier dated production/readiness summaries below are historical.

# Public CARD Beta ACTIVE — E90, 27 October2026

[Activation verified](docs/public-card-beta-activation-receipt.md): public CARD checkout
and owner-managed Manual EGP50 are OPEN. Signup OPEN; PDC PAUSED; coupons disabled.
Currenta402/schema98 unchanged. Staff payment checks every15min; one approved
emergency kill remains available. DTR-33 and all other deferred work remain open.
The dated milestones below are historical.

# Current purchasing status — E89, 27 October 2026

The [genuine EGP5 payment](docs/egp5-genuine-payment-verification.md) is VERIFIED.
The restricted grant is CLOSED; callbacks and owned receipts remain available.
[Public CARD Beta](docs/public-card-beta-activation-review.md) is ready for separate approval.
Signup OPEN; purchasing OFF; PDC PAUSED. Currenta402/schema98.
DTR-33 records the browser discrepancy; all original32 rows remain intact.
The milestones below are retained as dated history.

# Reusable ecommerce platform

Each business supplies its own branding, domains and configuration.
Follow [AGENTS.md](AGENTS.md) before changing the project.

**Public customer signup is OPEN; public purchasing is disabled.**
[Signup activation](docs/public-signup-activation-receipt.md) passed2026-10-26;
email confirmation and accepted Turnstile/Brevo controls remain. Do not repeat
accepted signup, CAPTCHA, login/recovery or owner-payment tests.

Start with [the master roadmap](docs/ELCOMPUTER_MASTER_ROADMAP.md),
[PROJECT_STATE.md](PROJECT_STATE.md) and [CODEX_HANDOFF.md](CODEX_HANDOFF.md).
Use the [consolidated deferred-test register](docs/DEFERRED_TEST_REGISTER.md) for
uncompleted acceptance. Deferral does not waive later completion.

Current production is `a402cf24a9685e0d`, schema98.
The [PDP/cart repair deployed](docs/pdp-cart-repair-deployment-receipt.md) with one app restart.
Its approval is consumed. The original EGP5 window expired at14:21:33 Riyadh,27 October.
The [restricted EGP5 window](docs/egp5-purchase-window-activation-receipt.md) expired
at **15:59:04 Riyadh,27 October2026**. Genuine owner acceptance is pending.
[Exposed-session revocation](docs/session-exposure-checkout-receipt.md) is verified.
The [secure EGP5 window](docs/egp5-secure-checkout-window-activation-receipt.md) is ACTIVE until **17:50:56 Riyadh,27 October2026**.
Activation is consumed; authorized runtime-only closure remains pending.
The owner [reported a checkout rejection](docs/egp5-checkout-rejection-review.md); diagnosis is pending the browser request.
FRE5 remains unchanged. Public purchasing stays disabled.
The prior EGP50 grant is closed. Public purchasing remains disabled.
Password recovery remains owner-accepted.
The earlier [schema95 stop](docs/schema95-deployment-stop-receipt.md) and
[asset recovery](docs/schema95-asset-recovery-review.md) are historical evidence.
Never replay schema95 or a consumed operator. Offline
[location reference/selectors](docs/pdc-location-reference-review.md) are a separate
local96 branch, with no PDC API calls or provider activation. PDC remains PAUSED.
The [historical import](docs/customer-history-import-receipt.md) remains accepted;
identity linkage is verified and explicit, never based on unverified email.

Before account switching or Git integration, read the
[Git/worktree audit](docs/GIT_WORKTREE_SYNC_AUDIT.md). Main is the continuity
checkout with91 migrations; it is not the full release source. Preserve all
worktrees and both accounts' commits. No automatic merge, rebase, cleanup or push.
The roadmap retains89 tasks and adds LOC-01 for90.

The release summaries below are dated historical evidence, not current activation
instructions. Public signup is already open; commerce/provider approvals are separate.

The [Shipping Company tariff manager](docs/shipping-tariffs.md) is
[deployed](docs/shipping-tariff-deployment-receipt.md) as `08b45ffac0e524c8`, schema91.
The owner-supplied six-zone package remains an unverified inactive draft import;
no business import or checkout price change ran. The approved packaging repair
preserves all retained client bytes; production asset checks pass. Its deployment
approval is consumed. The existing restricted purchase capability remains inactive.
The [modular payment/shipping plan](docs/modular-payment-shipping-plan.md) keeps
provider accounts, gateways, subsidies and loyalty independent. They are not
prerequisites for the separately approved first real payment/shipment.

The [Premium PDP finishing enhancements](docs/premium-product-finishing.md) add
favorites, sharing, package contents, support access and curated tags.
They reuse existing presentation metadata and services. Premium finishing release
`ea0dcc850b3a7d35` [deployed](docs/premium-product-finishing-deployment-receipt.md) with schema89 unchanged.
Its exact archive passed 425 browser checks; live smoke passed107 checks.
Hosted owner acceptance remains pending.

The [PDC V6 correction and focused compatibility review](docs/pdc-v6-compatibility.md)
accept the newly support-confirmed product fields. The [complete release](docs/pdc-v6-deployment-receipt.md) is deployed as
`881aadcfd4942ef8`, schema90, including two restored server RPC grants.
Independent preservation and107 live browser checks pass. All commerce gates remain held.
[Live GetProducts acceptance](docs/pdc-live-getproducts-acceptance.md) passed:
one GET, HTTP200, General36 and High Value40 normalized; saved40 unchanged.
Dashboard HTTP lookup, GetCities, webhook and shipment acceptance remain pending.
[Webhook cutover](docs/pdc-webhook-cutover-plan.md) also needs separate approval.

The [original WordPress/PDC contract review](docs/pdc-wordpress-contract-review.md)
found112 orders with matching booking and polling evidence. The
[controlled acceptance plan](docs/provider-controlled-acceptance.md) permits initial
PDC polling while its webhook remains disabled. The application-only shipment
correction [deployed](docs/pdc-shipment-contract-deployment-receipt.md) as
`03aa6e565f5b5ad3`, schema90 unchanged, with all gates held. Its plan is consumed. Verified physical stock,
delivery eligibility and owner-approved transaction details are still missing.
The [first real shipment checklist](docs/pdc-first-live-shipment-checklist.md)
records the completed release, exact Dashboard
setup and why a new COD0 order currently uses the existing card-payment path.

The [controlled purchasing review](docs/controlled-purchase-readiness.md) identifies
the current runtime and Caddy holds. TESTproduct2026 is intentionally EGP1. The owner reports one real unit exists;
its value and parcel details remain private and pending. The50 entered units do
not establish50 physical units. Existing LIVE Paymob credentials remain runtime-only.
A one-account/order purchase capability is qualified and
[deployed inactive](docs/controlled-purchase-deployment-receipt.md) as
`1088e036c4f81048`, schema90. Its approval is consumed. No purchase grant,
callback access, charging or shipping was enabled.

The owner reports the Ubuntu/Caddy/Nuxt restore and production health passed.
Dashboard login, product creation, Draft saving and VPS uploads also passed.
The storefront remains browse-only; purchases and signup are disabled.
The [COD purchase preparation](docs/cod-first-purchase.md) reuses existing checkout,
inventory and shipping. Its migration83 and application are deployed.
Verified stock, delivery settings and controlled acceptance remain required.
The [private packing-video workflow](docs/private-packing-videos.md) is implemented
with migration84 and private VPS runtime deployed.
The [normal COD cash workflow](docs/cod-collections.md) is deployed.
Its migration85 separates customer cash receipts from treasury reconciliation.
Public activation still requires owner-controlled acceptance.

The owner-approved [commerce foundation release](docs/commerce-foundation-release-receipt.md)
passed with migrations83–85 on the existing Caddy/systemd deployment.
Checkout and providers remain disabled. Real-order workflow acceptance is separate.
The release action has completed; do not rerun it. The older PM2 scripts target
a retired deployment. Both current handoffs record evidence and recovery.

The [Paymob/PDC disabled production release](docs/live-sales-release-receipt.md)
passed: release `d2d7a8029b473e4a`, schema87, with purchases and providers off.
Owner browser acceptance passed. Do not rerun the release.
Follow the [existing-account configuration guide](docs/provider-configuration.md)
for personal secret entry. PDC is saved and disabled. Its
[approved one-run diagnostic](docs/pdc-readonly-diagnostic-receipt.md) stopped at
GetProducts HTTP500; no retry or city lookup ran.
The owner's Paymob LIVE inputs are loaded. The
[controlled app restart](docs/paymob-controlled-restart.md)
is complete. The owner ran all phases; independent read-only
[restart acceptance](docs/paymob-controlled-restart-receipt.md) passed with credentials
loaded and all gates off. [PDC HTTP500 local review](docs/pdc-http500-local-review.md)
found the cause remains unknown. The [bounded PDC capture](docs/pdc-getproducts-capture-preparation.md)
helper is approved and [independently staged](docs/pdc-getproducts-capture-staging-receipt.md).
The owner consumed its single attempt: HTTP200 / RESPONSE_SCHEMA_REJECTED.
[Encrypted archive verification and analysis](docs/pdc-getproducts-capture-analysis.md)
are complete. The [offline schema audit](docs/pdc-getproducts-schema-audit.md) and
[deep investigation](docs/pdc-getproducts-deep-investigation.md) record the earlier
unknown contract. New support-confirmed fields now have a
[tested local correction](docs/pdc-v6-compatibility.md), plus a confirmed server
RPC access correction. The [complete release](docs/pdc-v6-deployment-receipt.md)
is deployed at schema90. The separate [live GetProducts acceptance](docs/pdc-live-getproducts-acceptance.md)
passed with one request and zero retries. Other provider acceptance remains pending.
The original HTTP500 remains unexplained. Historical and current diagnostic approvals
are consumed. No further request is authorized. The earlier
[root-console validation](docs/paymob-owner-validation.md) remains recorded. Follow the
[masked verification and Paymob preparation](docs/pdc-connection-paymob-preparation.md).
[Offline Paymob recovery](docs/paymob-offline-recovery.md) found agreeing LIVE/TEST
keys, HMAC and card IDs. Current-account confirmation remains owner-only.
Historical PDC inputs are now available through
[protected offline recovery](docs/pdc-offline-recovery.md); no automatic production copy ran.
The [readiness guide](docs/live-sales-readiness.md) covers controlled configuration.
The [first attempt stopped during preflight](docs/live-sales-release-blocked-receipt.md).
The [Auth metadata correction](docs/live-sales-auth-preflight-resolution.md) enabled
the separately approved deployment while preserving identity/security drift guards.
The [sealed preparation receipt](docs/live-sales-release-preparation.md) records
verified backups and retained assets. Its earlier command must not be rerun.
The [WordPress migration plan](docs/wordpress-customer-migration.md) preserves
current Auth identities and separates historical orders from commerce effects.
The [access correction and provider readiness review](docs/customer-access-provider-readiness.md)
now identifies the exact Caddy denials and remaining activation gates.
Both Caddy corrections are deployed. The owner reports all six account-page checks pass.
The [account entry release receipt](docs/customer-account-entry-release-receipt.md)
records the earlier access execution, acceptance and recovery.
Migrations86–87 and their matching application are now deployed.
Live charging, real booking and checkout remain disabled.

The [Modern Footer replacement](docs/modern-footer.md) is deployed.
Its [validation receipt](docs/modern-footer-validation.md) records responsive,
localized Dashboard persistence and SSR checks. The [sealed 87→88 release](docs/modern-footer-release.md)
passed: release `d1b10bb664e15a67`, schema88. Purchases, signup and providers remain off.
Live responsive/theme checks passed at the original deployment. The owner has since
configured Modern content and contrasting theme logos. Authenticated Dashboard
acceptance remains separate from anonymous and local fixture verification.
The release is consumed; do not rerun its commands. Historical operators stay unchanged.
The [Modern Footer design refinement](docs/modern-footer-refinement.md) is deployed:
larger branding, balanced columns and compact utility/legal rows.
Its [approved application-only release](docs/modern-footer-refinement-release.md)
`40ebcf1f6d50a143` preserves schema88, saved content, Classic and all existing gates.
The exact local artifact passes 533 browser checks/107 screenshots. Live review
passes 318 checks/18 screenshots across EN/AR, three widths and Light/Dark/System.
No page/hydration errors occurred; the existing chat-status 403 remains.
The refinement plan is consumed. Owner Dashboard checks remain separate.
The [Premium Product Page milestone](docs/premium-product-page.md) is deployed as
`cda41a7a13e0b61d`, application `a2e47a5`, schema89. Classic remains selected until the
owner chooses Premium in Dashboard Settings → Product page. Both share existing
commerce and SEO authority; Product Editor manages presentation media/relationships.
The [application-only release](docs/premium-product-release.md) applied no SQL and
preserved products/media/Auth, both footers, credentials and disabled gates. Its
23 release checks, nine remote checks and266 qualified-artifact browser checks pass.
Live anonymous verification passes279 checks/22 screenshots across EN/AR, widths
and themes, with no runtime/hydration errors. Analytics writes were blocked by the
browser harness; the existing chat-status403 remains. Hosted owner acceptance is
pending. See [validation](docs/premium-product-validation.md) for evidence boundaries
and full-suite qualification. All three PDP plans are consumed. No Git push.
Do not use the retired PM2 deployment scripts for this Caddy/systemd target.

For the current application candidate, use Node 22.23.1 and npm 10.9.8.
See [reproducible builds](docs/dependency-reproducibility.md) for the clean-install
procedure, lockfile correction and release authority.
