# clean-v1 database foundation

Local Phase 3 Milestone 1 bundle. Source checkpoint: 70 unchanged migrations.

Read [the certification report](../../../docs/clean-install-baseline.md).
`manifest.json` binds the SQL, permissions, seeds, buckets and source inventory.

This is not an existing-project migration or a remote installer. The laboratory
compiler creates and destroys its own databases. It accepts no database URL.
Never run this consolidated DDL against an initialized installation.

Migration 71, portable application fallbacks, first-owner bootstrap, hosted
capability acceptance and guarded publication remain required before a new
merchant installation. Storage bucket definitions are for later API creation.
