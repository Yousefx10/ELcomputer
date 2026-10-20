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
inventory and shipping. Its migration83 and application changes are local only.
Verified stock, delivery settings and controlled acceptance remain required.
The [private packing-video workflow](docs/private-packing-videos.md) is implemented
and validated locally. Its migration84 and VPS configuration are not deployed.
The [normal COD cash workflow](docs/cod-collections.md) is implemented locally.
Its migration85 separates customer cash receipts from treasury reconciliation.
Public activation still requires owner-controlled acceptance.

The [guarded commerce release](docs/commerce-foundation-release.md) is prepared
for one owner approval. It binds migrations83–85 to the existing Caddy/systemd
deployment and preserves disabled checkout. Nothing has been deployed.
Use that exact sealed action for this release; the older PM2 scripts target
a retired deployment. Both current handoffs record validation and recovery.

After release, address the four reported access errors, then existing Paymob/PDC.
WordPress accounts, addresses and orders remain a required launch workstream.

For the current application candidate, use Node 22.23.1 and npm 10.9.8.
See [reproducible builds](docs/dependency-reproducibility.md) for the clean-install
procedure, lockfile correction and release authority.
