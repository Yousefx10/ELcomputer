# Reusable ecommerce platform

Each business supplies its own branding, domains and configuration.
Follow [AGENTS.md](AGENTS.md) before changing the project.

Use [PROJECT_STATE.md](PROJECT_STATE.md) for current verified status.
Use [CODEX_HANDOFF.md](CODEX_HANDOFF.md) when switching Codex accounts.
Historical entries describe earlier targets and are not execution instructions.

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
Paymob entry is pending. Follow the
[masked verification and Paymob preparation](docs/pdc-connection-paymob-preparation.md).
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

For the current application candidate, use Node 22.23.1 and npm 10.9.8.
See [reproducible builds](docs/dependency-reproducibility.md) for the clean-install
procedure, lockfile correction and release authority.
