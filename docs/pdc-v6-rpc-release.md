> DEPLOYED AND CONSUMED:881aadcfd4942ef8/schema90.
> [Deployment receipt](pdc-v6-deployment-receipt.md).
> Preparation/approval commands below are historical. Never rerun this plan.

# PDC V6 correction with original server RPC access

This supersedes the incomplete schema89 application-only candidate. Production
remains the deployed Premium finishing release, schema89. No PDC approval exists.

The completed audit found an independent, confirmed access regression: migration65
revoked the original server EXECUTE grants on lookup and refresh RPCs. The new
migration90 restores only those two grants to `service_role`. Owners, definitions,
search paths, RBAC, RLS, browser denials, throttling and all data remain unchanged.
See [the compatibility audit](pdc-v6-compatibility.md).

The application archive remains byte-identical to the completed PDC build of
`82ec667`. No second build is necessary for this SQL-only correction. The extracted
archive passes21 HTTP replay checks over native disposable PostgreSQL/PostgREST
with migration90 and synthetic Auth/provider responses. Private failed fixture
attempts and the confirmed pre90 access failure remain preserved.

Only `scripts/pdc-v6-rpc-release/operator.mjs` may execute the complete release.
Earlier PDP/footer/live-sales operators and the incomplete PDC operator stay intact.

1. `prepare-from-artifact CANDIDATE QUALIFICATION NEW_DIRECTORY` verifies the exact
   archive, independent extraction, source preservation, authenticated encrypted
   preparation backups, completed tests and migration90's committed bytes. It then
   rechecks the accepted production runtime/schema89/data/Auth/settings/holds and
   creates a new format6 final plan. It performs no production write or staging.
2. `check PLAN` verifies every input, backup/readback, single-use marker and current
   protected production baseline. It remains entirely read-only.
3. Separately explicit owner approval must name the complete new seal and89→90
   scope. Only then may `apply PLAN --approved EXACT_SEAL` consume the plan once.
4. Apply records intent before preflight, obtains fresh verified encrypted backups,
   stages the exact application and tests it privately against89. A bounded SQL
   transaction locks protected data, validates the exact checkpoint and function
   ACLs, grants only the two original server capabilities, records migration90,
   verifies unchanged data/Auth and every other schema/RLS/ACL/function, then commits.
5. A fresh private candidate90 and read-only preservation check precede application
   activation. Public health/holds, Auth/settings, media and database preservation
   follow. No provider request, cache sync, callback registration or activation runs.

A failure records STOP. SQL uncertainty or a committed90 followed by an application
failure requires independent read-only reconciliation and a separately reviewed
recovery plan. Never repeat the consumed intent, replay90, automatically retry or
restore the database. An application-only recovery preserves90 and newer data.

The only future schema differences are those two service-only EXECUTE grants and
one migration-history row. No business data, credentials, saved Product ID40,
382 city aliases, status mappings, media, Classic/Premium settings, either footer,
Caddy/systemd configuration or disabled commerce/provider gates may change.

Hosted merchant acceptance, controlled live lookups, optional booking fields,
status mapping/timezone, callback cutover and token rotation remain separate gates.
This release does not activate shipping or purchasing. No Git push.
