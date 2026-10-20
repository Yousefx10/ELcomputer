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
Checkout and providers remain disabled. Owner browser smoke is pending.
The release action has completed; do not rerun it. The older PM2 scripts target
a retired deployment. Both current handoffs record evidence and recovery.

Next, accept the account access correction, then existing Paymob/PDC Quick Setup.
WordPress accounts, addresses and orders remain a required launch workstream.
The [access correction and provider readiness review](docs/customer-access-provider-readiness.md)
now identifies the exact Caddy denials and remaining activation gates.
The narrow Caddy correction is deployed; [browser acceptance](docs/customer-access-release-receipt.md)
remains pending. Nuxt and schema 85 are unchanged. The PDC lookup fix stays local.
Live Paymob charging and PDC booking remain blocked.

For the current application candidate, use Node 22.23.1 and npm 10.9.8.
See [reproducible builds](docs/dependency-reproducibility.md) for the clean-install
procedure, lockfile correction and release authority.
