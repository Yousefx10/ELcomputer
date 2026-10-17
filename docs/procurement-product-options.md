# Procurement product options

The product-options RPC projection includes its existing `created_at` field.
The query still filters serialized products, orders newest first and returns
at most 30 rows. Search, selected-product retention, active option filtering,
staff permissions and draft visibility are unchanged.

With this table-returning RPC and projection, omitting the ordered timestamp
causes actual PostgREST error `42703`. The products table already contains it.
This is a query correction, not a missing migration or a general SQL ordering rule.
PostgREST uses the returned table's foreign keys for
[table-valued function embeddings](https://docs.postgrest.org/en/stable/references/api/resource_embedding.html#foreign-key-joins-on-table-valued-functions).

## Focused native regression

Use the existing disposable PostgreSQL/PostgREST fixture:

```sh
node --test tests/procurement-product-options-native.test.mjs \
  tests/catalog-rest-security.test.mjs tests/catalog-confidentiality.test.mjs
```

Existing test-tool configuration:

| Variable | Value |
| --- | --- |
| `EMAIL_REVIEW_PG_BIN` | Absolute native PostgreSQL binary directory |
| `EMAIL_REVIEW_PG_DRIVER` | Absolute installed `pg` driver entrypoint |
| `CATALOG_REVIEW_POSTGREST_BIN` | Absolute checksum-verified PostgREST executable |

Supply any platform library search path required by those isolated tools.
No new application setting, domain, Auth origin or environment variable is needed.
Without native tools, the native cases explicitly skip; that is not acceptance.

The new regression executes the component's existing loader through the actual
Supabase query builder and native PostgREST. It applies all 82 immutable migrations
before PostgREST builds its relationship cache. It reproduces the old error,
then verifies ordering, the 30-row bound, title/SKU/slug search, variant embedding,
active option normalization, selected-product retention and existing draft scope.
Anonymous, customer and inactive actors remain denied. Before/after snapshots
confirm the reads do not change catalog, permissions or business rows.

The local database, users and signed JWTs are disposable fixtures. Auth claim
functions and managed-platform scaffolding are explicit fixture adaptations.
These results do not establish production Auth, hosted schema-cache behavior
or authenticated production query success.

## Prepared authenticated production read

Run only during separately authorized owner acceptance. Use the existing owner
page and session. Do not sign in, refresh, log out or request credentials during
this read-only phase. If no valid existing session is available, stop this phase;
session creation/rotation belongs to the separately approved Auth acceptance.

The reviewed operational evidence contains `authenticated-query-readonly.mjs`.
Its exported `validateExistingOwnerProcurement(page, binding)` procedure:

1. Requires exact configured HTTPS site/backend origins and the canonical page.
2. Installs a browser transport guard before reading the existing session.
3. Allows only GET/HEAD/OPTIONS. Backend paths are limited to existing-user,
   active-admin and `catalog_staff_products` reads. All mutations are aborted,
   including automatic Auth refresh, login audits, uploads and other RPCs.
4. Verifies the existing user and active owner through existing Auth/RLS contracts.
   There is no supplied owner ID, elevated credential or permission exception.
5. Executes the corrected component query as GET, with the same projection,
   serialization filter, ordering, embedding and 30-row limit. The RPC is STABLE;
   changing its HTTP method for this read does not authorize a mutation.
6. Returns only status, error code, row count and invariant results. Credentials,
   session tokens, headers, request bodies and returned business data stay in memory.
7. Removes only its own transport guard. It performs no login, refresh, logout,
   navigation, Save, receipt, publication or cleanup operation.

The caller supplies `siteOrigin` and `supabaseOrigin` from the reviewed deployment
binding, plus `componentSource` from the validated committed component. The helper
has no store/domain/project binding. Preserve the surrounding acceptance write
guard. Disable browser tracing, HAR, video, screenshots and session-state export.
Record only its sanitized return value; stop on any failure or unexpected drift.
Do not create production negative-test accounts. Retain existing isolated role
tests and live anonymous/invalid-token denial evidence.

## Application-only deployment boundary

Preserve the original certified Release 82 output, certificate, source checkpoint,
runtime environment, service hardening/retry policy, ingress and rollback evidence.
The new application candidate is a separate application-only correction on schema
82. It must not be relabeled as the original unchanged Release 82 certificate.

Before separate deployment approval, bind the focused commit, complete application
input hashes, locked dependencies, local build/runtime, candidate archive hash,
current runtime/environment identities and exact rollback target in the deployment
plan. Preserve old hashed assets for open clients. No migration or SQL deployment
is part of this change.

A failed clean `npm ci` blocks release packaging. Report dependency/lock resolver
drift separately; this timestamp-only correction does not authorize lockfile edits,
dependency upgrades or resolver flags that bypass the existing installation contract.
An installed-workspace typecheck is useful source validation, not a reproducible
locked-dependency build or deployable candidate.

A later approved deployment must validate a separate private candidate runtime
before switching the existing application release. Keep the accepted Nginx routing
unchanged. Switching application output requires separately reviewed runtime
activation; no service restart is authorized by these preparation instructions.
Keep registration, checkout, COD and payments disabled throughout.

Rollback is separately reviewed: restore the exact retained application release
pointer and activate that existing output, without changing database/security,
ingress, environment or media. It restores the known Procurement bug too. On a
failed or ambiguous activation, stop and diagnose read-only; never automatically
retry, roll back, rebuild production or restore a database.

After deployment, finish Procurement, AR dashboard, Warehouses, serialized
Inventory, navigation/Back, refresh-token rotation and logout acceptance. Preserve
the already passed EN Overview, Products/editor and session persistence evidence.
Repeat the prepared read-only production verifier after approved session/audit
acceptance. Favicon work and customer/order migration remain outside this scope.
