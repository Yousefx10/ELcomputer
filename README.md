# Reusable ecommerce platform

Each business supplies its own branding, domains and configuration.
Follow [AGENTS.md](AGENTS.md) before changing the project.

Use [PROJECT_STATE.md](PROJECT_STATE.md) for current verified status.
Use [CODEX_HANDOFF.md](CODEX_HANDOFF.md) when switching Codex accounts.
Historical entries describe earlier targets and are not execution instructions.

The [Shipping Company tariff manager](docs/shipping-tariffs.md) is implemented
locally with proposed migration91. The [owner-supplied six-zone package](docs/operations/shipping-tariffs/README.md)
imports as an unverified draft; it does not change checkout prices. Production
remains schema90. The [modular payment/shipping plan](docs/modular-payment-shipping-plan.md)
keeps provider accounts, gateway settings, subsidies and promotions independent.
The existing deployed path can support the separately approved first real test.

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
the current runtime and Caddy holds. TESTproduct2026/EGP1/50 units are test data,
not verified physical stock. Existing LIVE Paymob credentials remain runtime-only.
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
