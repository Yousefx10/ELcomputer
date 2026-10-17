# Reusable ecommerce platform

Each business supplies its own branding, domains and configuration.
Follow [AGENTS.md](AGENTS.md) before changing the project.

Use [PROJECT_STATE.md](PROJECT_STATE.md) for current verified status.
Use [CODEX_HANDOFF.md](CODEX_HANDOFF.md) when switching Codex accounts.
Historical entries describe earlier targets and are not execution instructions.

ADM-01 ingress is deployed. Existing-owner sign-in works.
Final acceptance is blocked by a Procurement RPC projection error.
See PROJECT_STATE.md for verified status and remaining checks.
The accepted Release 82 browse-only storefront remains live.
See [the ingress correction](docs/dashboard-access-ingress.md) for its narrow
route/method rules, existing authorization and configurable deployment binding.

For the current application candidate, use Node 22.23.1 and npm 10.9.8.
See [reproducible builds](docs/dependency-reproducibility.md) for the clean-install
procedure, lockfile correction and release authority.
