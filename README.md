# Reusable ecommerce platform

Each business supplies its own branding, domains and configuration.
Follow [AGENTS.md](AGENTS.md) before changing the project.

Use [PROJECT_STATE.md](PROJECT_STATE.md) for current verified status.
Use [CODEX_HANDOFF.md](CODEX_HANDOFF.md) when switching Codex accounts.
Historical entries describe earlier targets and are not execution instructions.

The [Premium PDP finishing enhancements](docs/premium-product-finishing.md) add
favorites, sharing, package contents, support access and curated tags.
They reuse schema89 and existing services. Release `ea0dcc850b3a7d35` is
[sealed for owner approval](docs/premium-product-finishing-release.md). Its exact
archive passes 425 browser checks. Production remains unchanged until approval.

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
are complete. The [offline schema audit](docs/pdc-getproducts-schema-audit.md)
found no verified live row schema. The [deep investigation](docs/pdc-getproducts-deep-investigation.md)
narrows the causes and prepares a tested [schema-only proposal](docs/pdc-getproducts-schema-diagnostic-proposal.md).
It needs separate approval; support remains a fallback. No correction for the live
failure is confirmed. Both diagnostic approvals
are consumed. No retry is authorized. The earlier
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
