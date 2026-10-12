# Portability and first-owner primitives, version 1

This follow-on describes migration `20261012160000_quick_setup_installation_bootstrap.sql`
after the immutable `clean-v1` checkpoint. It is not a replacement baseline or
an installer. `manifest.json` binds the original baseline manifest, migration
hash, post-upgrade public catalog hash and private schema/ACL definitions.

The owned compiler is `scripts/certify-installation-bootstrap.mjs`. Without
arguments it checks reproducibility; `--write` explicitly regenerates this
follow-on directory only. It accepts no connection URL or remote target.
The source-70 compiler remains pinned to its original checkpoint.

The native laboratory uses PostgreSQL 17, real Supautils policy delegation,
the non-superuser `postgres` migration login and pinned Supabase CLI 2.109.1.
Managed Auth/Storage/Realtime schemas are disposable contract fixtures.
Hosted service acceptance remains Milestone 3 work.

See [the implementation contract](../../../docs/installation-bootstrap.md).
