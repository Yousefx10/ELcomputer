# Release 82 production schema installation

This is a database-only preparation profile for `amighioggheqddyypgcl`.
Execution requires separate owner approval of the frozen plan.
It does not authorize catalog imports, deployment, media publication or DNS changes.

## Authority and isolation

The existing `scripts/elcomputer-install.mjs` engine remains authoritative.
The production manifest must opt into `elcomputer-production-82-metadata-only-v2`.
Its exact profile digest binds the project, direct database endpoint,
`https://elcomputer.net` origin, release certificate and metadata-only file policy.
No other project, origin, laboratory profile or connection pooler qualifies.

Without that explicit binding, production remains a protected target.
The demo project `zsqhuwgoasrexdnamlks` remains excluded in all cases.
A protected, reviewed additional reservation policy is mandatory.
Existing clean-source, pinned-tool, verified-TLS, empty-target, exclusion,
database-lock, checkpoint and exact confirmation checks remain in force.
Publication and deployment guards receive no additional authority.

Production `plan`, `check` and `verify` database connections default to read-only.
Their API transport permits only GET and HEAD requests.
Session settings and advisory locks do not change database records.

The production project has the dashboard's `public.rls_auto_enable()` helper.
Its complete definition hash, owner, ACL, search path and active event trigger
are pinned by this profile. No other existing function qualifies.
At baseline installation, the helper moves to `extensions` in the same transaction.
The event trigger keeps its function identity and remains enabled.
The original frozen SQL then runs its empty-public-schema guard unchanged.
A baseline failure also rolls back the helper's namespace move.
Subsequent connections reject helper or trigger drift.

## API-key compatibility

The Data API OpenAPI root can require a server secret key.
The installer now reads metadata with the server key.
It separately authenticates the public key using a bounded missing-relation GET.
Only the expected `404 / PGRST205` response passes that check.
This supports both existing JWT keys and current opaque Supabase keys.
Credentials remain in protected files outside Git and installation receipts.

## Certified migration sequence

The unchanged release certificate is `release-82-v1`:
`f6a9d75166154f5c1c2bd91b306f7a61157857d5a5b41d6442f95fafa047eeae`.
All 82 historical SQL files and certified application inputs remain unchanged.

The installer follows its existing sequence:

1. Move the reviewed auto-RLS helper and apply the clean baseline atomically.
2. Adopt the exact historical migration identities 1–70.
3. Apply migration 71 through the pinned Supabase CLI.
4. Verify baseline schema, grants, RLS and empty business tables.
5. Create and verify six empty private compatibility buckets through Storage APIs.
6. Create the first owner through Auth and seal bootstrap.
7. Apply migrations 72–82 individually, verifying each stage and history.
8. Verify the final schema, owner, empty catalog and private buckets.

No demo seed, copied production database or backup schema is used.
The installer stops if unknown relations, users, history or objects appear.
Signups and anonymous sign-ins must remain disabled during installation.
Customer signup readiness requires separate launch configuration and acceptance.

## File architecture and temporary compatibility metadata

Confirmed architecture: Supabase stores PostgreSQL data, Auth and structured
metadata only. **All production files belong on VPS**, including packing videos,
documents, support/chat/Claims attachments and shipping labels.
PostgreSQL retains file paths, ownership, relationships and metadata.

Schema installation and first-owner creation do not upload files.
The installer requires six private bucket definitions for compatibility checks.
They may be created empty; verification requires zero `storage.objects` rows.
The unused video bucket definition stays within the Free API's metadata limits.
That value is not a supported production video size or a storage solution.
No 50 MB video workflow is approved or enabled.

The production installer transport now permits only bucket metadata GET/HEAD,
bucket-definition creation, read-only Auth/Data API requests and first-owner
creation. It denies Storage object routes for every key, including service keys:
file upload/download, signed-upload token creation, resumable/S3 access, copy,
move and deletion. Historical migration and bootstrap SQL remains byte-identical.

**Boundary:** this is an installer transport restriction, not a project-wide
Supabase Storage API shutdown. Production credentials must remain outside all
existing application/upload runtimes. Installing a deny RLS policy alone would
not constrain a service role with BYPASSRLS. No production application connection,
deployment, staff operation or provider activation is authorized by this profile.

Until the VPS private-file adapter is implemented and accepted, production packing
videos, documents, support/chat/Claims attachments and shipping-label file flows
must remain unavailable through the production application. Do not silently turn
off evidence requirements or claim those business workflows are launch-ready.
The demo remains separate and unchanged.

Catalog database import can proceed independently after its own approval.
Existing catalog transfer/import stores product and media references in PostgreSQL,
uses the VPS image/path guards, and does not upload files to Supabase Storage.
WordPress media copy/publication and private-file adaptation remain separate work.
Neither requires rewriting the certified release 82 migrations for installation.

## Execution and recovery

Prepare a clean, unlinked source checkout containing this adapter.
Run `plan` and `check` with protected production manifests and credentials.
Bind approval to the resulting project, installation UUID and plan digest.
Use `apply --plan ... --credentials-file ... --owner-file ... --confirm ...`
only after that approval. Never substitute `supabase db push --linked`.

Retain the protected plan, complete checkpoint chain, receipt and source checkout.
An interrupted transaction rolls back that transaction only.
Committed baseline, migration history, Auth users and buckets are not undone.
The certified installer has no automatic destructive down-migration.

After a failure, stop and use `check` to inspect the exact installation.
An approved `resume` reconciles verified work and runs only pending stages.
Unknown history or ambiguous Auth creation requires investigation, never reset.
Retiring or resetting even an empty production project requires separate approval.

After schema verification, proceed with the separately approved WordPress import.
Private-file VPS adaptation is not a prerequisite for catalog database import.
It is a prerequisite for enabling the affected production file workflows.
WordPress remains authoritative until its independently approved cutover.
